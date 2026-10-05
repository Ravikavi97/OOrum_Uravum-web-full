import fs from 'fs/promises';
import path from 'path';
import crypto from 'crypto';
import sharp from 'sharp';
import DOMPurify from 'isomorphic-dompurify';

/**
 * Category icon upload pipeline.
 *
 * Uploaded icons are always stored as PNG so the site never serves
 * author-controlled SVG markup. SVGs are sanitized *and* rasterized:
 *  - DOMPurify strips scripts, event handlers and external references before
 *    the file reaches the SVG rasterizer (defense in depth).
 *  - sharp re-encodes the result as PNG, so the stored artifact cannot carry
 *    any active content regardless of what the sanitizer let through.
 */

const ICON_SIZE = 96; // 3x a 32px header slot, so it stays crisp on HiDPI
const MAX_ICON_BYTES = 512 * 1024;

/** Raster formats we accept, keyed by the format sharp reports. */
const RASTER_FORMATS = new Set(['png', 'jpeg', 'webp']);

export interface StoredIcon {
  url: string;
  width: number;
  height: number;
}

/**
 * Identify the real format from the file bytes. The multipart `Content-Type`
 * is client-controlled, so it is never trusted for this decision.
 */
export async function detectIconFormat(buffer: Buffer): Promise<string | null> {
  // SVG is text — sniff the opening tag rather than trusting the extension.
  const head = buffer.subarray(0, 1024).toString('utf8').trimStart();
  if (/^(<\?xml[\s\S]*?\?>\s*)?(<!--[\s\S]*?-->\s*)*(<!DOCTYPE\s+svg[\s\S]*?>\s*)?<svg[\s>]/i.test(head)) {
    return 'svg';
  }

  try {
    const meta = await sharp(buffer, { limitInputPixels: 4096 * 4096 }).metadata();
    return meta.format ?? null;
  } catch {
    return null;
  }
}

/** Strip active content from SVG markup so it is safe to hand to the rasterizer. */
function sanitizeSvg(svg: string): string {
  return DOMPurify.sanitize(svg, {
    USE_PROFILES: { svg: true, svgFilters: true },
    FORBID_TAGS: ['script', 'foreignObject', 'use', 'animate', 'set', 'handler'],
    FORBID_ATTR: ['xlink:href', 'href'],
  });
}

/**
 * Normalize an uploaded icon to a square transparent PNG on disk.
 * Returns the public URL, or throws with a message safe to show the user.
 */
export async function storeCategoryIcon(
  buffer: Buffer,
  uploadRoot: string,
): Promise<StoredIcon> {
  if (buffer.length === 0) {
    throw new Error('Uploaded file is empty');
  }
  if (buffer.length > MAX_ICON_BYTES) {
    throw new Error('Icon must be smaller than 512KB');
  }

  const format = await detectIconFormat(buffer);
  if (!format) {
    throw new Error('Unsupported file: upload a PNG, JPG, WebP or SVG icon');
  }
  if (format !== 'svg' && !RASTER_FORMATS.has(format)) {
    throw new Error('Unsupported file: upload a PNG, JPG, WebP or SVG icon');
  }

  let pipeline: sharp.Sharp;
  if (format === 'svg') {
    const cleaned = sanitizeSvg(buffer.toString('utf8'));
    if (!/<svg[\s>]/i.test(cleaned)) {
      throw new Error('That file is not a valid SVG icon');
    }
    pipeline = sharp(Buffer.from(cleaned), { density: 384 });
  } else {
    pipeline = sharp(buffer, { limitInputPixels: 4096 * 4096 });
  }

  const filename = `${crypto.randomUUID()}.png`;
  const iconDir = path.join(uploadRoot, 'icons');
  await fs.mkdir(iconDir, { recursive: true });

  const info = await pipeline
    // `inside` keeps the icon's own aspect ratio and never pads, so a small
    // upload is not stranded in the middle of a larger transparent canvas
    // (which would make it render tiny in the header). Oversized uploads are
    // scaled down to fit ICON_SIZE.
    .resize(ICON_SIZE, ICON_SIZE, { fit: 'inside', withoutEnlargement: true })
    .png({ compressionLevel: 9 })
    .toFile(path.join(iconDir, filename));

  return { url: `/uploads/icons/${filename}`, width: info.width, height: info.height };
}

/**
 * Accept only same-origin upload paths or absolute http(s) URLs for `iconUrl`.
 * Rejects `javascript:`, `data:` and protocol-relative values so a stored
 * category can never turn into an injection vector.
 */
export function isValidIconUrl(value: string): boolean {
  if (value.startsWith('/uploads/icons/')) return true;
  try {
    const url = new URL(value);
    return url.protocol === 'http:' || url.protocol === 'https:';
  } catch {
    return false;
  }
}