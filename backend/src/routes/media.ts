import { Router, Request, Response } from 'express';
import multer from 'multer';
import sharp from 'sharp';
import path from 'path';
import fs from 'fs/promises';
import crypto from 'crypto';
import { prisma } from '../lib/prisma';
import { requireAuth, requireRole, AuthenticatedRequest } from '../lib/auth';
import { uploadRateLimiter } from '../middleware/rateLimiter';

const router = Router();

// ─── Configuration ───────────────────────────────────────────────────────────

const UPLOAD_PATH = process.env.MEDIA_UPLOAD_PATH || './uploads';
const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
const ALLOWED_MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/avif'];

const VARIANTS = [
  { name: 'thumbnail', width: 150 },
  { name: 'medium', width: 600 },
  { name: 'large', width: 1200 },
] as const;

// ─── Multer setup ────────────────────────────────────────────────────────────

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_FILE_SIZE },
  fileFilter: (_req, file, cb) => {
    if (ALLOWED_MIME_TYPES.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error(`Unsupported file type: ${file.mimetype}. Allowed: JPEG, PNG, WebP, AVIF`));
    }
  },
});

// ─── Helpers ─────────────────────────────────────────────────────────────────

async function ensureDir(dir: string): Promise<void> {
  await fs.mkdir(dir, { recursive: true });
}

function getExtension(mimeType: string): string {
  const map: Record<string, string> = {
    'image/jpeg': 'jpg',
    'image/png': 'png',
    'image/webp': 'webp',
    'image/avif': 'avif',
  };
  return map[mimeType] || 'bin';
}

// ─── GET / — List all media (authenticated) ─────────────────────────────────

router.get(
  '/',
  requireAuth,
  async (_req: AuthenticatedRequest, res: Response) => {
    try {
      const media = await prisma.media.findMany({
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          filename: true,
          originalUrl: true,
          thumbnailUrl: true,
          mediumUrl: true,
          largeUrl: true,
          mimeType: true,
          size: true,
          createdAt: true,
        },
      });
      res.json(media);
    } catch (err) {
      console.error('[media] GET / error:', err);
      res.status(500).json({
        error: { code: 'INTERNAL_ERROR', message: 'Failed to list media' },
      });
    }
  },
);

// ─── POST /upload — Media upload (Author+ role) ─────────────────────────────

router.post(
  '/upload',
  requireAuth,
  requireRole('ADMIN', 'EDITOR', 'AUTHOR'),
  uploadRateLimiter,
  (req: AuthenticatedRequest, res: Response, next) => {
    upload.single('file')(req, res, (err) => {
      if (err) {
        if (err instanceof multer.MulterError && err.code === 'LIMIT_FILE_SIZE') {
          res.status(400).json({
            error: { code: 'FILE_TOO_LARGE', message: 'File exceeds maximum size of 10MB' },
          });
          return;
        }
        res.status(400).json({
          error: { code: 'UPLOAD_ERROR', message: err.message },
        });
        return;
      }
      next();
    });
  },
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const file = req.file;
      if (!file) {
        res.status(400).json({
          error: { code: 'NO_FILE', message: 'No file provided' },
        });
        return;
      }

      const uniqueId = crypto.randomUUID();
      const ext = getExtension(file.mimetype);
      const baseFilename = `${uniqueId}.${ext}`;

      // Ensure upload directories exist
      await ensureDir(path.join(UPLOAD_PATH, 'original'));

      // Save original
      const originalPath = path.join(UPLOAD_PATH, 'original', baseFilename);
      await fs.writeFile(originalPath, file.buffer);
      const originalUrl = `/uploads/original/${baseFilename}`;

      // Generate resized variants
      const urls: Record<string, string> = {};
      for (const variant of VARIANTS) {
        const variantDir = path.join(UPLOAD_PATH, variant.name);
        await ensureDir(variantDir);

        const variantFilename = `${uniqueId}-${variant.name}.${ext}`;
        const variantPath = path.join(variantDir, variantFilename);

        await sharp(file.buffer)
          .resize(variant.width, undefined, { withoutEnlargement: true })
          .toFile(variantPath);

        urls[variant.name] = `/uploads/${variant.name}/${variantFilename}`;
      }

      // Create Media record in DB
      const articleId = req.body?.articleId || null;

      const media = await prisma.media.create({
        data: {
          filename: file.originalname,
          originalUrl,
          thumbnailUrl: urls.thumbnail,
          mediumUrl: urls.medium,
          largeUrl: urls.large,
          mimeType: file.mimetype,
          size: file.size,
          articleId,
        },
      });

      res.status(201).json(media);
    } catch (err) {
      console.error('[media] POST /upload error:', err);
      res.status(500).json({
        error: { code: 'INTERNAL_ERROR', message: 'Failed to process upload' },
      });
    }
  },
);

// ─── GET /:id/image — Serve image bytes from DB ─────────────────────────────

router.get('/:id/image', async (req: Request, res: Response) => {
  try {
    const id = req.params.id as string;

    const media = await prisma.media.findUnique({
      where: { id },
      select: { imageData: true, mimeType: true, filename: true },
    });

    if (!media || !media.imageData) {
      res.status(404).json({
        error: { code: 'NOT_FOUND', message: 'Image not found' },
      });
      return;
    }

    res.set('Content-Type', media.mimeType);
    res.set('Cache-Control', 'public, max-age=86400');
    res.set('Cross-Origin-Resource-Policy', 'cross-origin');
    res.send(Buffer.from(media.imageData));
  } catch (err) {
    console.error('[media] GET /:id/image error:', err);
    res.status(500).json({
      error: { code: 'INTERNAL_ERROR', message: 'Failed to serve image' },
    });
  }
});

// ─── DELETE /:id — Delete media (Admin/Editor) ──────────────────────────────

router.delete(
  '/:id',
  requireAuth,
  requireRole('ADMIN', 'EDITOR'),
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const id = req.params.id as string;

      const media = await prisma.media.findUnique({ where: { id } });
      if (!media) {
        res.status(404).json({
          error: { code: 'NOT_FOUND', message: 'Media not found' },
        });
        return;
      }

      // Delete files from disk
      const filesToDelete: string[] = [];
      if (media.originalUrl) filesToDelete.push(path.join(UPLOAD_PATH, media.originalUrl.replace('/uploads/', '')));
      if (media.thumbnailUrl) filesToDelete.push(path.join(UPLOAD_PATH, media.thumbnailUrl.replace('/uploads/', '')));
      if (media.mediumUrl) filesToDelete.push(path.join(UPLOAD_PATH, media.mediumUrl.replace('/uploads/', '')));
      if (media.largeUrl) filesToDelete.push(path.join(UPLOAD_PATH, media.largeUrl.replace('/uploads/', '')));

      for (const filePath of filesToDelete) {
        await fs.unlink(filePath).catch(() => {});
      }

      await prisma.media.delete({ where: { id } });

      res.json({ message: 'Media deleted successfully' });
    } catch (err) {
      console.error('[media] DELETE /:id error:', err);
      res.status(500).json({
        error: { code: 'INTERNAL_ERROR', message: 'Failed to delete media' },
      });
    }
  },
);

export default router;
