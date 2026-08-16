<#
.SYNOPSIS
    OOrum Uravum - Full Build and Deploy Package Script (Windows PowerShell)

.DESCRIPTION
    Builds all three apps (backend, CMS, frontend) and assembles the deploy/
    folder with production-ready packages + ZIPs ready for upload to cPanel.

    Run from the project root:
        .\scripts\build-deploy.ps1

    Optional flags:
        -BackendOnly    Build and package backend only
        -CmsOnly        Build and package CMS only
        -FrontendOnly   Build and package frontend only
        -SkipInstall    Skip npm install steps (use existing node_modules)
        -SkipZip        Skip ZIP creation (just prepare folder structure)

.NOTES
    Requirements: Node.js v22, npm, PowerShell 5+
    Output:       deploy/backend.zip, deploy/cms.zip, deploy/frontend.zip
#>

param(
    [switch]$BackendOnly,
    [switch]$CmsOnly,
    [switch]$FrontendOnly,
    [switch]$SkipInstall,
    [switch]$SkipZip
)

$ErrorActionPreference = "Stop"
$ROOT = Split-Path -Parent $PSScriptRoot

# --- Helpers -----------------------------------------------------------------

function Write-Step($msg) {
    Write-Host ""
    Write-Host "==> $msg" -ForegroundColor Cyan
}

function Write-Ok($msg) {
    Write-Host "    OK: $msg" -ForegroundColor Green
}

function Write-Warn($msg) {
    Write-Host "    WARN: $msg" -ForegroundColor Yellow
}

function Invoke-Cmd($cmd, $workDir = $ROOT) {
    Push-Location $workDir
    try {
        Invoke-Expression $cmd
        if ($LASTEXITCODE -ne 0) {
            throw "Command failed (exit $LASTEXITCODE): $cmd"
        }
    } finally {
        Pop-Location
    }
}

# Fix Windows absolute paths baked into Next.js standalone builds
function Fix-WindowsPaths($file, $projectSubPath) {
    if (-not (Test-Path $file)) { return }
    $content = Get-Content $file -Raw -Encoding UTF8
    # Build all variants of the Windows path to replace
    $escapedRoot = [regex]::Escape($ROOT)
    $fwdRoot = $ROOT.Replace('\', '/')
    $escapedFwd = [regex]::Escape($fwdRoot)
    $dblRoot = $ROOT.Replace('\', '\\')
    $escapedDbl = [regex]::Escape($dblRoot)
    $content = $content -replace ($escapedRoot + '\\' + [regex]::Escape($projectSubPath)), ''
    $content = $content -replace ($escapedRoot + '/' + [regex]::Escape($projectSubPath.Replace('\','/'))), ''
    $content = $content -replace ($escapedDbl + '\\\\' + [regex]::Escape($projectSubPath.Replace('\','\\'))), ''
    $content = $content -replace ($escapedFwd + '/' + [regex]::Escape($projectSubPath.Replace('\','/'))), ''
    Set-Content $file $content -Encoding UTF8 -NoNewline
}

# --- Determine what to build -------------------------------------------------

$buildAll   = -not ($BackendOnly -or $CmsOnly -or $FrontendOnly)
$doBackend  = $buildAll -or $BackendOnly
$doCms      = $buildAll -or $CmsOnly
$doFrontend = $buildAll -or $FrontendOnly

Write-Host ""
Write-Host "============================================" -ForegroundColor Magenta
Write-Host "  OOrum Uravum - Build and Deploy Packager" -ForegroundColor Magenta
Write-Host "============================================" -ForegroundColor Magenta
Write-Host "  Root:        $ROOT"
Write-Host "  Backend:     $doBackend"
Write-Host "  CMS:         $doCms"
Write-Host "  Frontend:    $doFrontend"
Write-Host "  SkipInstall: $SkipInstall"
Write-Host "  SkipZip:     $SkipZip"

# --- Clean and recreate deploy folder ----------------------------------------

Write-Step "Preparing deploy/ folder"
$DEPLOY = Join-Path $ROOT "deploy"
if ($buildAll) {
    if (Test-Path $DEPLOY) {
        Remove-Item $DEPLOY -Recurse -Force
        Write-Ok "Removed old deploy/"
    }
    New-Item -ItemType Directory -Path $DEPLOY | Out-Null
} else {
    if (-not (Test-Path $DEPLOY)) {
        New-Item -ItemType Directory -Path $DEPLOY | Out-Null
    }
}

# =============================================================================
# BACKEND
# =============================================================================

if ($doBackend) {
    Write-Step "Building backend"
    $BE_SRC  = Join-Path $ROOT "backend"
    $BE_DEST = Join-Path $DEPLOY "backend"

    if (Test-Path $BE_DEST) { Remove-Item $BE_DEST -Recurse -Force }
    New-Item -ItemType Directory -Path $BE_DEST | Out-Null

    # Prisma schema lives at root prisma/ but postinstall expects backend/prisma/
    # Copy it in before npm install so 'prisma generate' can find it
    $rootPrisma    = Join-Path $ROOT "prisma"
    $backendPrisma = Join-Path $BE_SRC "prisma"
    if ((Test-Path $rootPrisma) -and (-not (Test-Path $backendPrisma))) {
        Copy-Item $rootPrisma $backendPrisma -Recurse
        Write-Ok "Copied root prisma/ into backend/prisma/ for postinstall"
        $cleanupBackendPrisma = $true
    } else {
        $cleanupBackendPrisma = $false
    }

    # Install dependencies
    if (-not $SkipInstall) {
        Write-Step "backend: npm install"
        Invoke-Cmd "npm install" $BE_SRC
        Write-Ok "npm install done"
    }

    # Remove the temporary prisma copy from backend/ (keep source tree clean)
    if ($cleanupBackendPrisma -and (Test-Path $backendPrisma)) {
        Remove-Item $backendPrisma -Recurse -Force
        Write-Ok "Cleaned up temporary backend/prisma/"
    }

    # Compile TypeScript
    Write-Step "backend: npm run build"
    Invoke-Cmd "npm run build" $BE_SRC
    Write-Ok "TypeScript compiled"

    # Copy build artefacts
    Write-Step "backend: copying files"
    Copy-Item (Join-Path $BE_SRC "dist")              $BE_DEST -Recurse
    Copy-Item (Join-Path $BE_SRC "app.js")            $BE_DEST
    Copy-Item (Join-Path $BE_SRC "package.json")      $BE_DEST
    $pkgLock = Join-Path $BE_SRC "package-lock.json"
    if (Test-Path $pkgLock) {
        Copy-Item $pkgLock $BE_DEST
    }

    # Copy prisma schema + migrations into deploy/backend/prisma/
    # (needed on cPanel so postinstall can run prisma generate there too)
    $prismaSrc = $null
    foreach ($candidate in @(
        (Join-Path $BE_SRC "prisma"),
        (Join-Path $ROOT "prisma")
    )) {
        if (Test-Path $candidate) { $prismaSrc = $candidate; break }
    }
    if ($prismaSrc) {
        Copy-Item $prismaSrc (Join-Path $BE_DEST "prisma") -Recurse
        Write-Ok "Prisma schema copied from $prismaSrc"
    } else {
        Write-Warn "prisma/ folder not found - skipping"
    }

    # Copy generated Prisma client
    $destModules    = Join-Path $BE_DEST "node_modules"
    $prismaClient   = Join-Path (Join-Path $BE_SRC "node_modules") ".prisma"
    $prismaClientAt = Join-Path (Join-Path $BE_SRC "node_modules") "@prisma"
    if (Test-Path $prismaClient) {
        New-Item -ItemType Directory -Path $destModules -Force | Out-Null
        Copy-Item $prismaClient (Join-Path $destModules ".prisma") -Recurse
        Write-Ok "Prisma .prisma client copied"
    }
    if (Test-Path $prismaClientAt) {
        New-Item -ItemType Directory -Path $destModules -Force | Out-Null
        Copy-Item $prismaClientAt (Join-Path $destModules "@prisma") -Recurse
        Write-Ok "Prisma @prisma client copied"
    }

    # Copy .env (production)
    $envSrc = Join-Path $BE_SRC ".env.production"
    if (Test-Path $envSrc) {
        Copy-Item $envSrc (Join-Path $BE_DEST ".env")
        Write-Ok ".env.production -> .env"
    } else {
        Write-Warn ".env.production not found - create deploy/backend/.env manually"
    }

    # Create empty uploads placeholder
    New-Item -ItemType Directory -Path (Join-Path $BE_DEST "uploads") -Force | Out-Null
    Write-Ok "Backend package ready at deploy/backend/"

    # Create ZIP
    if (-not $SkipZip) {
        Write-Step "backend: creating backend.zip"
        $zipPath = Join-Path $DEPLOY "backend.zip"
        if (Test-Path $zipPath) { Remove-Item $zipPath -Force }
        Compress-Archive -Path $BE_DEST -DestinationPath $zipPath
        Write-Ok "deploy/backend.zip created"
    }
}

# =============================================================================
# CMS (Publisher Dashboard)
# =============================================================================

if ($doCms) {
    Write-Step "Building CMS (publisher-dashboard)"
    $CMS_SRC  = Join-Path $ROOT "publisher-dashboard"
    $CMS_DEST = Join-Path $DEPLOY "cms"

    if (Test-Path $CMS_DEST) { Remove-Item $CMS_DEST -Recurse -Force }
    New-Item -ItemType Directory -Path $CMS_DEST | Out-Null

    # Install dependencies
    if (-not $SkipInstall) {
        Write-Step "cms: npm install"
        Invoke-Cmd "npm install" $CMS_SRC
        Write-Ok "npm install done"
    }

    # Build Next.js
    Write-Step "cms: npm run build"
    Invoke-Cmd "npm run build" $CMS_SRC
    Write-Ok "Next.js build done"

    # Copy standalone output
    Write-Step "cms: copying standalone output"
    $nextDir       = Join-Path $CMS_SRC ".next"
    $standaloneDir = Join-Path $nextDir "standalone"
    $standaloneSrc = Join-Path $standaloneDir "publisher-dashboard"
    if (-not (Test-Path $standaloneSrc)) {
        $standaloneSrc = $standaloneDir
    }
    if (-not (Test-Path $standaloneSrc)) {
        throw "CMS standalone output not found at $standaloneSrc. Ensure next.config.js has output: 'standalone'"
    }
    Get-ChildItem $standaloneSrc | ForEach-Object {
        Copy-Item $_.FullName $CMS_DEST -Recurse -Force
    }
    Write-Ok "Standalone files copied"

    # Copy .next/static (not included in standalone)
    $staticSrc  = Join-Path (Join-Path $CMS_SRC ".next") "static"
    if (Test-Path $staticSrc) {
        $staticDest = Join-Path (Join-Path $CMS_DEST ".next") "static"
        New-Item -ItemType Directory -Path $staticDest -Force | Out-Null
        Copy-Item $staticSrc $staticDest -Recurse -Force
        Write-Ok ".next/static copied"
    }

    # Copy public folder
    $publicSrc = Join-Path $CMS_SRC "public"
    if (Test-Path $publicSrc) {
        Copy-Item $publicSrc $CMS_DEST -Recurse -Force
        Write-Ok "public/ copied"
    }

    # Fix Windows paths in server.js and required-server-files.json
    Write-Step "cms: fixing Windows paths"
    Fix-WindowsPaths (Join-Path $CMS_DEST "server.js") "publisher-dashboard"
    Fix-WindowsPaths (Join-Path (Join-Path $CMS_DEST ".next") "required-server-files.json") "publisher-dashboard"
    Write-Ok "Windows paths fixed"

    # Rename node_modules -> _modules
    $nmSrc = Join-Path $CMS_DEST "node_modules"
    if (Test-Path $nmSrc) {
        Rename-Item $nmSrc "_modules"
        Write-Ok "node_modules -> _modules"
    }

    # Write start.js wrapper
    $startJs = 'const p=require(''path''),M=require(''module''),_r=M._resolveFilename.bind(M);' + "`r`n" +
               'M._resolveFilename=function(r,...a){' + "`r`n" +
               '  if(!r.startsWith(''.'')&&!r.startsWith(''/'')&&!r.startsWith(''node:'')){' + "`r`n" +
               '    try{return _r(p.join(__dirname,''_modules'',r),...a)}catch(e){}' + "`r`n" +
               '  }' + "`r`n" +
               '  return _r(r,...a)' + "`r`n" +
               '};' + "`r`n" +
               'process.env.NODE_PATH=p.join(__dirname,''_modules'');' + "`r`n" +
               'M._initPaths();' + "`r`n" +
               'require(''./server.js'');'
    Set-Content (Join-Path $CMS_DEST "start.js") $startJs -Encoding UTF8
    Write-Ok "start.js created"

    # Write .htaccess
    $htaccess = "# DO NOT REMOVE. CLOUDLINUX PASSENGER CONFIGURATION BEGIN`r`n" +
                "PassengerAppRoot `"/home/oorumur1/public_html/cms`"`r`n" +
                "PassengerBaseURI `"/`"`r`n" +
                "PassengerNodejs `"/home/oorumur1/nodevenv/public_html/cms/22/bin/node`"`r`n" +
                "PassengerAppType node`r`n" +
                "PassengerStartupFile server.js`r`n" +
                "# DO NOT REMOVE. CLOUDLINUX PASSENGER CONFIGURATION END`r`n" +
                "Options -Indexes`r`n" +
                "PassengerEnabled on`r`n" +
                "PassengerAppRoot /home/oorumur1/public_html/cms`r`n" +
                "PassengerNodejs /home/oorumur1/nodevenv/public_html/cms/22/bin/node`r`n" +
                "PassengerAppType node`r`n" +
                "PassengerStartupFile server.js`r`n"
    Set-Content (Join-Path $CMS_DEST ".htaccess") $htaccess -Encoding UTF8
    Write-Ok ".htaccess created"

    # Copy .env.production
    $envSrc = Join-Path $CMS_SRC ".env.production"
    if (Test-Path $envSrc) {
        Copy-Item $envSrc (Join-Path $CMS_DEST ".env.production")
        Write-Ok ".env.production copied"
    } else {
        Write-Warn ".env.production not found at $envSrc"
    }

    Write-Ok "CMS package ready at deploy/cms/"

    # Create ZIP
    if (-not $SkipZip) {
        Write-Step "cms: creating cms.zip"
        $zipPath = Join-Path $DEPLOY "cms.zip"
        if (Test-Path $zipPath) { Remove-Item $zipPath -Force }
        Compress-Archive -Path $CMS_DEST -DestinationPath $zipPath
        Write-Ok "deploy/cms.zip created"
    }
}

# =============================================================================
# FRONTEND
# =============================================================================

if ($doFrontend) {
    Write-Step "Building frontend"
    $FE_SRC  = Join-Path $ROOT "frontend"
    $FE_DEST = Join-Path $DEPLOY "frontend"

    if (Test-Path $FE_DEST) { Remove-Item $FE_DEST -Recurse -Force }
    New-Item -ItemType Directory -Path $FE_DEST | Out-Null

    # Install dependencies
    if (-not $SkipInstall) {
        Write-Step "frontend: npm install"
        Invoke-Cmd "npm install" $FE_SRC
        Write-Ok "npm install done"
    }

    # Build Next.js
    Write-Step "frontend: npm run build"
    Invoke-Cmd "npm run build" $FE_SRC
    Write-Ok "Next.js build done"

    # Copy standalone output
    Write-Step "frontend: copying standalone output"
    $nextDir       = Join-Path $FE_SRC ".next"
    $standaloneDir = Join-Path $nextDir "standalone"
    $standaloneSrc = Join-Path $standaloneDir "frontend"
    if (-not (Test-Path $standaloneSrc)) {
        $standaloneSrc = $standaloneDir
    }
    if (-not (Test-Path $standaloneSrc)) {
        throw "Frontend standalone output not found at $standaloneSrc. Ensure next.config.js has output: 'standalone'"
    }
    Get-ChildItem $standaloneSrc | ForEach-Object {
        Copy-Item $_.FullName $FE_DEST -Recurse -Force
    }
    Write-Ok "Standalone files copied"

    # Copy .next/static (not included in standalone)
    $staticSrc  = Join-Path (Join-Path $FE_SRC ".next") "static"
    if (Test-Path $staticSrc) {
        $staticDest = Join-Path (Join-Path $FE_DEST ".next") "static"
        New-Item -ItemType Directory -Path $staticDest -Force | Out-Null
        Copy-Item $staticSrc $staticDest -Recurse -Force
        Write-Ok ".next/static copied"
    }

    # Copy public folder
    $publicSrc = Join-Path $FE_SRC "public"
    if (Test-Path $publicSrc) {
        Copy-Item $publicSrc $FE_DEST -Recurse -Force
        Write-Ok "public/ copied"
    }

    # Fix Windows paths
    Write-Step "frontend: fixing Windows paths"
    Fix-WindowsPaths (Join-Path $FE_DEST "server.js") "frontend"
    Fix-WindowsPaths (Join-Path (Join-Path $FE_DEST ".next") "required-server-files.json") "frontend"
    Write-Ok "Windows paths fixed"

    # IMPORTANT: Remove app.js - Passenger loads it instead of server.js
    $appJs = Join-Path $FE_DEST "app.js"
    if (Test-Path $appJs) {
        Remove-Item $appJs -Force
        Write-Warn "Removed app.js (would cause Passenger to load wrong startup file)"
    }

    # Rename node_modules -> _modules if present
    $nmSrc = Join-Path $FE_DEST "node_modules"
    if (Test-Path $nmSrc) {
        Rename-Item $nmSrc "_modules"
        Write-Ok "node_modules -> _modules"
    }

    # Write .htaccess
    $htaccess = "# DO NOT REMOVE. CLOUDLINUX PASSENGER CONFIGURATION BEGIN`r`n" +
                "PassengerAppRoot `"/home/oorumur1/public_html/frontend`"`r`n" +
                "PassengerBaseURI `"/`"`r`n" +
                "PassengerNodejs `"/home/oorumur1/nodevenv/public_html/frontend/22/bin/node`"`r`n" +
                "PassengerAppType node`r`n" +
                "PassengerStartupFile server.js`r`n" +
                "# DO NOT REMOVE. CLOUDLINUX PASSENGER CONFIGURATION END`r`n" +
                "Options -Indexes`r`n" +
                "PassengerEnabled on`r`n" +
                "PassengerAppRoot /home/oorumur1/public_html/frontend`r`n" +
                "PassengerNodejs /home/oorumur1/nodevenv/public_html/frontend/22/bin/node`r`n" +
                "PassengerAppType node`r`n" +
                "PassengerStartupFile server.js`r`n"
    Set-Content (Join-Path $FE_DEST ".htaccess") $htaccess -Encoding UTF8
    Write-Ok ".htaccess created"

    # Copy .env.production
    $envSrc = Join-Path $FE_SRC ".env.production"
    if (Test-Path $envSrc) {
        Copy-Item $envSrc (Join-Path $FE_DEST ".env.production")
        Write-Ok ".env.production copied"
    } else {
        Write-Warn ".env.production not found at $envSrc"
    }

    Write-Ok "Frontend package ready at deploy/frontend/"

    # Create ZIP
    if (-not $SkipZip) {
        Write-Step "frontend: creating frontend.zip"
        $zipPath = Join-Path $DEPLOY "frontend.zip"
        if (Test-Path $zipPath) { Remove-Item $zipPath -Force }
        Compress-Archive -Path $FE_DEST -DestinationPath $zipPath
        Write-Ok "deploy/frontend.zip created"
    }
}

# --- Done --------------------------------------------------------------------

Write-Host ""
Write-Host "============================================" -ForegroundColor Magenta
Write-Host "  Build complete!" -ForegroundColor Green
Write-Host "============================================" -ForegroundColor Magenta
if (-not $SkipZip) {
    Write-Host ""
    Write-Host "  Upload these ZIPs to cPanel:" -ForegroundColor Cyan
    if ($doBackend)  { Write-Host "    deploy/backend.zip   -> /home/oorumur1/public_html/api/" }
    if ($doCms)      { Write-Host "    deploy/cms.zip       -> /home/oorumur1/public_html/cms/" }
    if ($doFrontend) { Write-Host "    deploy/frontend.zip  -> /home/oorumur1/public_html/frontend/" }
    Write-Host ""
    Write-Host "  Then SSH in and run the server-side setup (see DEPLOYMENT.md Step 4)" -ForegroundColor Cyan
}
Write-Host ""
