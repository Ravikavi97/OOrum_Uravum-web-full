import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import fs from 'fs/promises';
import os from 'os';
import path from 'path';
import sharp from 'sharp';
import { detectIconFormat, storeCategoryIcon, isValidIconUrl } from './categoryIconUpload';

// ─── Fixtures ────────────────────────────────────────────────────────────────

/** The Tabler "Map 2" icon the publisher asked to support. */
const TABLER_MAP_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="#000000" stroke-linecap="round" stroke-linejoin="round" id="Map-2--Streamline-Tabler" height="24" width="24">
  <desc>Map 2 Streamline Icon: https://streamlinehq.com</desc>
  <path d="M12 18.5 9 17l-6 3V7l6 -3 6 3 6 -3v7.5" stroke-width="2"></path>
  <path d="M9 4v13" stroke-width="2"></path>
  <path d="M15 7v5.5" stroke-width="2"></path>
  <path d="M21.121 20.121a3 3 0 1 0 -4.242 0c0.418 0.419 1.125 1.045 2.121 1.879 1.051 -0.89 1.759 -1.516 2.121 -1.879z" stroke-width="2"></path>
  <path d="M19 18v0.01" stroke-width="2"></path>
</svg>`;

/** An SVG carrying active content that must never survive the upload. */
const HOSTILE_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24">
  <script>alert('xss')</script>
  <circle cx="12" cy="12" r="8" onload="alert(1)" fill="red"/>
  <a href="javascript:alert(2)"><rect x="2" y="2" width="6" height="6"/></a>
  <foreignObject><body xmlns="http://www.w3.org/1999/xhtml">hi</body></foreignObject>
</svg>`;

let tmpRoot: string;

async function pngBuffer(size = 200): Promise<Buffer> {
  return sharp({
    create: {
      width: size,
      height: size,
      channels: 4,
      background: { r: 0, g: 128, b: 0, alpha: 1 },
    },
  })
    .png()
    .toBuffer();
}

beforeAll(async () => {
  tmpRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'cat-icon-'));
});

afterAll(async () => {
  await fs.rm(tmpRoot, { recursive: true, force: true });
});

// ─── detectIconFormat ────────────────────────────────────────────────────────

describe('detectIconFormat', () => {
  it('detects SVG from its markup, ignoring the file extension', async () => {
    await expect(detectIconFormat(Buffer.from(TABLER_MAP_SVG))).resolves.toBe('svg');
  });

  it('detects SVG behind an XML prolog and doctype', async () => {
    const svg = `<?xml version="1.0"?><!DOCTYPE svg PUBLIC "-//W3C//DTD SVG 1.1//EN" "http://www.w3.org/Graphics/SVG/1.1/DTD/svg11.dtd">${TABLER_MAP_SVG}`;
    await expect(detectIconFormat(Buffer.from(svg))).resolves.toBe('svg');
  });

  it('detects PNG and JPEG from their bytes', async () => {
    await expect(detectIconFormat(await pngBuffer())).resolves.toBe('png');
    const jpeg = await sharp({ create: { width: 40, height: 40, channels: 3, background: '#fff' } })
      .jpeg()
      .toBuffer();
    await expect(detectIconFormat(jpeg)).resolves.toBe('jpeg');
  });

  it('returns null for content that is neither image nor SVG', async () => {
    await expect(detectIconFormat(Buffer.from('not an image at all'))).resolves.toBeNull();
    await expect(detectIconFormat(Buffer.alloc(0))).resolves.toBeNull();
  });

  it('does not treat an HTML page as SVG', async () => {
    const html = '<!DOCTYPE html><html><body><svg>hello</svg></body></html>';
    await expect(detectIconFormat(Buffer.from(html))).resolves.toBeNull();
  });
});

// ─── storeCategoryIcon ───────────────────────────────────────────────────────

describe('storeCategoryIcon', () => {
  it('stores an uploaded SVG as a PNG file', async () => {
    const stored = await storeCategoryIcon(Buffer.from(TABLER_MAP_SVG), tmpRoot);

    expect(stored.url).toMatch(/^\/uploads\/icons\/[0-9a-f-]+\.png$/);
    expect(stored.width).toBeGreaterThan(0);
    expect(stored.height).toBeGreaterThan(0);

    const onDisk = path.join(tmpRoot, 'icons', path.basename(stored.url));
    const meta = await sharp(await fs.readFile(onDisk)).metadata();
    expect(meta.format).toBe('png');
  });

  it('rasterizes the SVG so the stored file carries no script or handlers', async () => {
    const stored = await storeCategoryIcon(Buffer.from(HOSTILE_SVG), tmpRoot);
    const onDisk = path.join(tmpRoot, 'icons', path.basename(stored.url));
    const meta = await sharp(await fs.readFile(onDisk)).metadata();

    // A PNG cannot hold script, event handlers or foreignObject by definition.
    expect(meta.format).toBe('png');
  });

  it('normalizes an oversized raster upload to fit the icon box', async () => {
    const stored = await storeCategoryIcon(await pngBuffer(300), tmpRoot);
    expect(stored.width).toBe(stored.height);
    expect(stored.width).toBeLessThanOrEqual(96);
  });

  it('does not pad a small upload, so it does not render tiny in the header', async () => {
    const stored = await storeCategoryIcon(await pngBuffer(32), tmpRoot);
    expect(stored.width).toBe(32);
    expect(stored.height).toBe(32);
  });

  it('preserves a non-square aspect ratio', async () => {
    const wide = await sharp({
      create: { width: 200, height: 100, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 1 } },
    })
      .png()
      .toBuffer();
    const stored = await storeCategoryIcon(wide, tmpRoot);
    expect(stored.width / stored.height).toBeCloseTo(2, 1);
  });

  it('gives every upload a unique filename', async () => {
    const a = await storeCategoryIcon(await pngBuffer(), tmpRoot);
    const b = await storeCategoryIcon(await pngBuffer(), tmpRoot);
    expect(a.url).not.toBe(b.url);
  });

  it('rejects an empty upload', async () => {
    await expect(storeCategoryIcon(Buffer.alloc(0), tmpRoot)).rejects.toThrow(/empty/i);
  });

  it('rejects files above the size limit', async () => {
    const big = Buffer.alloc(600 * 1024, 0x41);
    await expect(storeCategoryIcon(big, tmpRoot)).rejects.toThrow(/512KB/i);
  });

  it('rejects unsupported content', async () => {
    await expect(
      storeCategoryIcon(Buffer.from('GIF89a not really a gif'), tmpRoot),
    ).rejects.toThrow(/Unsupported file/i);
  });

  it('rejects a PDF even when it claims to be an image', async () => {
    const pdf = Buffer.from('%PDF-1.4\n1 0 obj<</Type/Catalog>>endobj\n');
    await expect(storeCategoryIcon(pdf, tmpRoot)).rejects.toThrow(/Unsupported file/i);
  });
});

// ─── isValidIconUrl ──────────────────────────────────────────────────────────

describe('isValidIconUrl', () => {
  it('accepts an uploads/icons path', () => {
    expect(isValidIconUrl('/uploads/icons/abc.png')).toBe(true);
  });

  it('accepts absolute http and https URLs', () => {
    expect(isValidIconUrl('https://api.oorumuravum.com/uploads/icons/abc.png')).toBe(true);
    expect(isValidIconUrl('http://localhost:4000/uploads/icons/abc.png')).toBe(true);
  });

  it('rejects script and data URLs', () => {
    expect(isValidIconUrl('javascript:alert(1)')).toBe(false);
    expect(isValidIconUrl('data:image/svg+xml;base64,PHN2Zz48L3N2Zz4=')).toBe(false);
    expect(isValidIconUrl('vbscript:msgbox(1)')).toBe(false);
  });

  it('rejects protocol-relative and other upload paths', () => {
    expect(isValidIconUrl('//evil.example.com/icon.png')).toBe(false);
    expect(isValidIconUrl('/uploads/other/abc.png')).toBe(false);
    expect(isValidIconUrl('/etc/passwd')).toBe(false);
  });

  it('rejects empty and malformed values', () => {
    expect(isValidIconUrl('')).toBe(false);
    expect(isValidIconUrl('not a url')).toBe(false);
  });
});