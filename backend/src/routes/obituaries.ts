import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import multer from 'multer';
import rateLimit from 'express-rate-limit';
import { prisma } from '../lib/prisma';
import { requireAuth, requireRole, AuthenticatedRequest } from '../lib/auth';
import { invalidateByTags } from '../lib/cache';
import { generateUniqueSlug } from '../lib/slug';
import { revalidateFrontend } from '../lib/revalidate';
import { createAdminNotification } from '../lib/notify';
import { encryptImage, safeDecryptImage } from '../lib/imageEncryption';

const router = Router();

// â”€â”€â”€ Zod Schemas â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

const optionalTextField = z.preprocess(
  (value) => value === '' ? null : value,
  z.string().nullable(),
).optional();

const optionalDateField = z.preprocess(
  (value) => value === '' ? null : value,
  z.string().refine((value) => !isNaN(Date.parse(value)), 'Invalid date').nullable(),
).optional();

const validateObituaryDates = (
  data: { dateOfBirth?: string | null; dateOfDeath?: string | null },
  context: z.RefinementCtx,
) => {
  if (data.dateOfBirth && data.dateOfDeath && new Date(data.dateOfDeath) < new Date(data.dateOfBirth)) {
    context.addIssue({ code: 'custom', message: 'Date of death must be after date of birth', path: ['dateOfDeath'] });
  }
  if (data.dateOfDeath && data.dateOfDeath.slice(0, 10) > new Date().toISOString().slice(0, 10)) {
    context.addIssue({ code: 'custom', message: 'Date of death cannot be in the future', path: ['dateOfDeath'] });
  }
};

const obituaryDetailFields = {
  firstName: optionalTextField,
  middleName: optionalTextField,
  surname: optionalTextField,
  otherNames: optionalTextField,
  dateOfBirth: optionalDateField,
  dateOfDeath: optionalDateField,
  placeOfBirth: optionalTextField,
  lastResidentialAddress: optionalTextField,
  fatherName: optionalTextField,
  motherName: optionalTextField,
  maritalStatus: optionalTextField,
  spouseName: optionalTextField,
  brothersNames: optionalTextField,
  sistersNames: optionalTextField,
  fatherInLawName: optionalTextField,
  motherInLawName: optionalTextField,
  sonsNames: optionalTextField,
  daughtersNames: optionalTextField,
  sonsInLawNames: optionalTextField,
  daughtersInLawNames: optionalTextField,
  grandchildrenNames: optionalTextField,
  occupations: optionalTextField,
  hobbiesInterests: optionalTextField,
  communityActivities: optionalTextField,
  otherDetails: optionalTextField,
  lifeStory: optionalTextField,
};

const createObituarySchema = z.object({
  name: z.string().min(1, 'Name is required'),
  content: z.string().min(1, 'Content is required'),
  imageUrl: z.preprocess((value) => value === '' ? null : value, z.string().url().nullable()).optional(),
  publishedAt: z.string().datetime().optional(),
  ...obituaryDetailFields,
}).superRefine(validateObituaryDates);

const publicSubmitSchema = z.object({
  // Required fields
  firstName: z.string().min(1, 'First name is required'),
  dateOfDeath: z.string().refine(val => !isNaN(Date.parse(val)), 'Valid date of death is required'),

  // Optional fields
  photo: z.any().optional(),
  middleName: z.string().optional(),
  surname: z.string().optional(),
  otherNames: z.string().optional(),
  dateOfBirth: z.string().optional(),
  placeOfBirth: z.string().optional(),
  lastResidentialAddress: z.string().optional(),
  fatherName: z.string().optional(),
  motherName: z.string().optional(),
  maritalStatus: z.string().optional(),
  spouseName: z.string().optional(),
  brothersNames: z.string().optional(),
  sistersNames: z.string().optional(),
  fatherInLawName: z.string().optional(),
  motherInLawName: z.string().optional(),
  sonsNames: z.string().optional(),
  daughtersNames: z.string().optional(),
  sonsInLawNames: z.string().optional(),
  daughtersInLawNames: z.string().optional(),
  grandchildrenNames: z.string().optional(),
  occupations: z.string().optional(),
  hobbiesInterests: z.string().optional(),
  communityActivities: z.string().optional(),
  otherDetails: z.string().optional(),
  lifeStory: z.string().optional(),

  // Legacy support (will be migrated to firstName + surname)
  name: z.string().optional(),
  content: z.string().optional(),
}).refine((data) => {
  // Validate date order: dateOfDeath >= dateOfBirth
  if (data.dateOfBirth && data.dateOfDeath) {
    const dob = new Date(data.dateOfBirth);
    const dod = new Date(data.dateOfDeath);
    if (dod < dob) {
      return false;
    }
  }
  // Validate dateOfDeath is not in the future
  if (data.dateOfDeath) {
    const dod = new Date(data.dateOfDeath);
    if (dod > new Date()) {
      return false;
    }
  }
  return true;
}, {
  message: 'Date of death must be after date of birth and not in the future',
  path: ['dateOfDeath'],
});

const updateObituarySchema = z.object({
  name: z.string().min(1).optional(),
  content: z.string().min(1).optional(),
  imageUrl: z.preprocess((value) => value === '' ? null : value, z.string().url().nullable()).optional(),
  status: z.enum(['PENDING', 'APPROVED', 'REJECTED']).optional(),
  publishedAt: z.string().datetime().optional(),
  ...obituaryDetailFields,
}).superRefine(validateObituaryDates);

const authenticateIfProvided = (req: Request, res: Response, next: NextFunction) => {
  if (!req.headers.authorization) {
    next();
    return;
  }
  requireAuth(req as AuthenticatedRequest, res, next);
};

// â”€â”€â”€ Multer setup â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB limit
  fileFilter: (_req, file, cb) => {
    const allowedTypes = ['image/png', 'image/jpeg', 'image/jpg', 'image/webp'];
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Only PNG, JPG, JPEG, or WEBP images are allowed'));
    }
  },
});

const getImageMimeType = (file: Express.Multer.File | undefined) =>
  file?.mimetype === 'image/jpg' ? 'image/jpeg' : file?.mimetype;

// Public submissions default to three per hour; local test stacks may override this limit.
const configuredSubmitLimit = Number(process.env.OBITUARY_SUBMISSION_RATE_LIMIT ?? 3);
if (!Number.isSafeInteger(configuredSubmitLimit) || configuredSubmitLimit < 1) {
  throw new Error('OBITUARY_SUBMISSION_RATE_LIMIT must be a positive integer.');
}

const submitRateLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  limit: configuredSubmitLimit,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  handler: (_req: Request, res: Response) => {
    res.status(429).json({
      error: { code: 'RATE_LIMIT_EXCEEDED', message: 'Too many submissions. Please try again later.' },
    });
  },
});

// â”€â”€â”€ GET / â€” List obituaries (public: approved only; admin: all with status filter) â”€â”€

router.get('/', authenticateIfProvided, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const page = Math.max(1, parseInt(req.query.page as string) || 1);
    const pageSize = Math.min(50, Math.max(1, parseInt(req.query.pageSize as string) || 10));
    const offset = (page - 1) * pageSize;
    const canReview = ['ADMIN', 'EDITOR'].includes(req.user?.role ?? '');
    const statusFilter = req.query.status as string | undefined;

    const where = canReview
      ? (statusFilter ? { status: statusFilter } : {})
      : { status: 'APPROVED' };

    const [data, total] = await Promise.all([
      prisma.obituary.findMany({
        where,
        orderBy: { publishedAt: 'desc' },
        skip: offset,
        take: pageSize,
        select: {
          id: true, name: true, slug: true, content: true, sourceUrl: true,
          status: true, submitterName: true, submitterEmail: true,
          imageUrl: true, imageMimeType: true, publishedAt: true, createdAt: true,
          firstName: true, middleName: true, surname: true, otherNames: true,
          dateOfBirth: true, dateOfDeath: true, placeOfBirth: true,
          lastResidentialAddress: true, fatherName: true, motherName: true,
          maritalStatus: true, spouseName: true, brothersNames: true,
          sistersNames: true, fatherInLawName: true, motherInLawName: true,
          sonsNames: true, daughtersNames: true, sonsInLawNames: true,
          daughtersInLawNames: true, grandchildrenNames: true, occupations: true,
          hobbiesInterests: true, communityActivities: true, otherDetails: true,
          lifeStory: true,
        },
      }),
      prisma.obituary.count({ where }),
    ]);

    res.json({ data, total, page, pageSize, totalPages: Math.ceil(total / pageSize) });
  } catch (err) {
    console.error('[obituaries] GET / error:', err);
    res.status(500).json({ error: { code: 'INTERNAL_ERROR', message: 'Failed to fetch obituaries' } });
  }
});

// â”€â”€â”€ GET /slug/:slug â€” Get obituary by slug â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

router.get('/slug/:slug', async (req: Request, res: Response) => {
  try {
    const obit = await prisma.obituary.findUnique({
      where: { slug: req.params.slug as string },
      select: {
        id: true, name: true, slug: true, content: true, sourceUrl: true,
        status: true, imageUrl: true, imageMimeType: true, publishedAt: true, createdAt: true,
        firstName: true, middleName: true, surname: true, otherNames: true,
        dateOfBirth: true, dateOfDeath: true, placeOfBirth: true,
        lastResidentialAddress: true, fatherName: true, motherName: true,
        maritalStatus: true, spouseName: true, brothersNames: true,
        sistersNames: true, fatherInLawName: true, motherInLawName: true,
        sonsNames: true, daughtersNames: true, sonsInLawNames: true,
        daughtersInLawNames: true, grandchildrenNames: true, occupations: true,
        hobbiesInterests: true, communityActivities: true, otherDetails: true,
        lifeStory: true,
      },
    });
    if (!obit || obit.status !== 'APPROVED') {
      res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Obituary not found' } });
      return;
    }
    res.json(obit);
  } catch (err) {
    res.status(500).json({ error: { code: 'INTERNAL_ERROR', message: 'Failed to fetch obituary' } });
  }
});

// â”€â”€â”€ GET /:id/image â€” Serve obituary image â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

router.get('/:id/image', async (req: Request, res: Response) => {
  try {
    const obit = await prisma.obituary.findUnique({
      where: { id: req.params.id as string },
      select: { imageData: true, imageMimeType: true },
    });
    if (!obit?.imageData) {
      res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Image not found' } });
      return;
    }
    const decryptedBytes = safeDecryptImage(obit.imageData);
    res.setHeader('Content-Type', obit.imageMimeType || 'image/jpeg');
    res.setHeader('Cache-Control', 'public, max-age=86400');
    res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');
    res.send(decryptedBytes);
  } catch (err) {
    console.error('[obituaries] GET /:id/image error:', err);
    res.status(500).json({ error: { code: 'INTERNAL_ERROR', message: 'Failed to fetch image' } });
  }
});

// â”€â”€â”€ POST /submit â€” Public obituary submission (no auth required) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

router.post(
  '/submit',
  submitRateLimiter,
  authenticateIfProvided,
  (req: Request, res: Response, next) => {
    upload.single('photo')(req, res, (err) => {
      if (err) {
        if (err instanceof multer.MulterError && err.code === 'LIMIT_FILE_SIZE') {
          res.status(400).json({ error: { code: 'FILE_TOO_LARGE', message: 'File exceeds 5MB' } });
          return;
        }
        res.status(400).json({ error: { code: 'UPLOAD_ERROR', message: err.message } });
        return;
      }
      next();
    });
  },
  async (req: AuthenticatedRequest, res: Response) => {
    const parsed = publicSubmitSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({
        error: { code: 'VALIDATION_ERROR', message: 'Invalid data', details: parsed.error.flatten().fieldErrors as Record<string, string[]> },
      });
      return;
    }

    try {
      const data = parsed.data;
      const submitterName = req.user?.name?.trim() || 'Anonymous';
      const submitterEmail = req.user?.email || null;

      // Build display name from firstName + surname (or legacy name field)
      const displayName = [data.firstName, data.middleName, data.surname]
        .filter(Boolean)
        .join(' ')
        .trim() || data.name || data.firstName;

      const slug = await generateUniqueSlug(displayName, 'obituary');

      // Build life story content from new fields or use legacy content
      const lifeStoryContent = data.lifeStory || data.content || '';

      const obituary = await prisma.obituary.create({
        data: {
          name: displayName,
          slug,
          content: lifeStoryContent,
          status: 'PENDING',
          submitterName,
          submitterEmail,
          publishedAt: new Date(),
          imageMimeType: getImageMimeType(req.file),
          // New detailed fields
          firstName: data.firstName,
          middleName: data.middleName,
          surname: data.surname,
          otherNames: data.otherNames,
          dateOfBirth: data.dateOfBirth ? new Date(data.dateOfBirth) : null,
          dateOfDeath: data.dateOfDeath ? new Date(data.dateOfDeath) : null,
          placeOfBirth: data.placeOfBirth,
          lastResidentialAddress: data.lastResidentialAddress,
          fatherName: data.fatherName,
          motherName: data.motherName,
          maritalStatus: data.maritalStatus,
          spouseName: data.spouseName,
          brothersNames: data.brothersNames,
          sistersNames: data.sistersNames,
          fatherInLawName: data.fatherInLawName,
          motherInLawName: data.motherInLawName,
          sonsNames: data.sonsNames,
          daughtersNames: data.daughtersNames,
          sonsInLawNames: data.sonsInLawNames,
          daughtersInLawNames: data.daughtersInLawNames,
          grandchildrenNames: data.grandchildrenNames,
          occupations: data.occupations,
          hobbiesInterests: data.hobbiesInterests,
          communityActivities: data.communityActivities,
          otherDetails: data.otherDetails,
          lifeStory: data.lifeStory,
          // Cast Buffer to Uint8Array<ArrayBuffer> for Prisma v6 Bytes field compatibility
          ...(req.file && { imageData: encryptImage(req.file.buffer) as unknown as Uint8Array<ArrayBuffer> }),
        },
        select: { id: true, name: true, slug: true, status: true, createdAt: true },
      });

      // Create admin notification
      createAdminNotification({
        type: 'obituary_submission',
        title: 'புதிய இரங்கல் சமர்ப்பிக்க',
        message: `${submitterName} submitted an obituary for "${displayName}"`,
        link: '/obituaries',
      });

      res.status(201).json({ message: 'Obituary submitted for review. It will appear after admin approval.', obituary });
    } catch (err) {
      console.error('[obituaries] POST /submit error:', err);
      res.status(500).json({ error: { code: 'INTERNAL_ERROR', message: 'Failed to submit obituary' } });
    }
  },
);

// â”€â”€â”€ POST / â€” Create obituary (Admin/Editor â€” auto-approved) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

router.post(
  '/',
  requireAuth,
  requireRole('ADMIN', 'EDITOR', 'AUTHOR'),
  (req: AuthenticatedRequest, res: Response, next) => {
    upload.single('image')(req, res, (err) => {
      if (err) {
        if (err instanceof multer.MulterError && err.code === 'LIMIT_FILE_SIZE') {
          res.status(400).json({ error: { code: 'FILE_TOO_LARGE', message: 'File exceeds 5MB' } });
          return;
        }
        res.status(400).json({ error: { code: 'UPLOAD_ERROR', message: err.message } });
        return;
      }
      next();
    });
  },
  async (req: AuthenticatedRequest, res: Response) => {
    const parsed = createObituarySchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({
        error: { code: 'VALIDATION_ERROR', message: 'Invalid data', details: parsed.error.flatten().fieldErrors as Record<string, string[]> },
      });
      return;
    }

    try {
      const {
        name, content, imageUrl, publishedAt,
        firstName, middleName, surname, otherNames, dateOfBirth, dateOfDeath,
        placeOfBirth, lastResidentialAddress, fatherName, motherName, maritalStatus,
        spouseName, brothersNames, sistersNames, fatherInLawName, motherInLawName,
        sonsNames, daughtersNames, sonsInLawNames, daughtersInLawNames,
        grandchildrenNames, occupations, hobbiesInterests, communityActivities,
        otherDetails, lifeStory,
      } = parsed.data;
      const slug = await generateUniqueSlug(name, 'obituary');

      const obituary = await prisma.obituary.create({
        data: {
          name, slug, content, imageUrl,
          status: req.user?.role === 'AUTHOR' ? 'PENDING' : 'APPROVED',
          publishedAt: publishedAt ? new Date(publishedAt) : new Date(),
          firstName, middleName, surname, otherNames,
          dateOfBirth: dateOfBirth ? new Date(dateOfBirth) : null,
          dateOfDeath: dateOfDeath ? new Date(dateOfDeath) : null,
          placeOfBirth, lastResidentialAddress, fatherName, motherName,
          maritalStatus, spouseName, brothersNames, sistersNames,
          fatherInLawName, motherInLawName, sonsNames, daughtersNames,
          sonsInLawNames, daughtersInLawNames, grandchildrenNames,
          occupations, hobbiesInterests, communityActivities, otherDetails, lifeStory,
          ...(req.file && { imageMimeType: getImageMimeType(req.file) }),
          // Cast Buffer to Uint8Array<ArrayBuffer> for Prisma v6 Bytes field compatibility
          ...(req.file && { imageData: encryptImage(req.file.buffer) as unknown as Uint8Array<ArrayBuffer> }),
        },
        select: { id: true, name: true, slug: true, content: true, status: true, publishedAt: true, createdAt: true },
      });

      await invalidateByTags(['obituaries', 'search']);
      revalidateFrontend();
      res.status(201).json(obituary);
    } catch (err) {
      console.error('[obituaries] POST / error:', err);
      res.status(500).json({ error: { code: 'INTERNAL_ERROR', message: 'Failed to create obituary' } });
    }
  },
);

// â”€â”€â”€ PUT /:id â€” Update obituary (Admin/Editor â€” includes approve/reject) â”€â”€â”€â”€

router.put(
  '/:id',
  requireAuth,
  requireRole('ADMIN', 'EDITOR', 'AUTHOR'),
  (req: AuthenticatedRequest, res: Response, next) => {
    upload.single('image')(req, res, (err) => {
      if (err) {
        if (err instanceof multer.MulterError && err.code === 'LIMIT_FILE_SIZE') {
          res.status(400).json({ error: { code: 'FILE_TOO_LARGE', message: 'File exceeds 5MB' } });
          return;
        }
        res.status(400).json({ error: { code: 'UPLOAD_ERROR', message: err.message } });
        return;
      }
      next();
    });
  },
  async (req: AuthenticatedRequest, res: Response) => {
    const parsed = updateObituarySchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({
        error: { code: 'VALIDATION_ERROR', message: 'Invalid data', details: parsed.error.flatten().fieldErrors as Record<string, string[]> },
      });
      return;
    }

    try {
      const id = req.params.id as string;
      const existing = await prisma.obituary.findUnique({ where: { id } });
      if (!existing) {
        res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Obituary not found' } });
        return;
      }

      const {
        name, content, imageUrl, status, publishedAt,
        firstName, middleName, surname, otherNames, dateOfBirth, dateOfDeath,
        placeOfBirth, lastResidentialAddress, fatherName, motherName, maritalStatus,
        spouseName, brothersNames, sistersNames, fatherInLawName, motherInLawName,
        sonsNames, daughtersNames, sonsInLawNames, daughtersInLawNames,
        grandchildrenNames, occupations, hobbiesInterests, communityActivities,
        otherDetails, lifeStory,
      } = parsed.data;

      if (status !== undefined && !['ADMIN', 'EDITOR'].includes(req.user?.role ?? '')) {
        res.status(403).json({
          error: { code: 'FORBIDDEN', message: 'Only admins and editors can review obituary submissions' },
        });
        return;
      }

      const obituary = await prisma.obituary.update({
        where: { id },
        data: {
          ...(name !== undefined && { name }),
          ...(content !== undefined && { content }),
          ...(imageUrl !== undefined && { imageUrl }),
          ...(firstName !== undefined && { firstName }),
          ...(middleName !== undefined && { middleName }),
          ...(surname !== undefined && { surname }),
          ...(otherNames !== undefined && { otherNames }),
          ...(dateOfBirth !== undefined && { dateOfBirth: dateOfBirth ? new Date(dateOfBirth) : null }),
          ...(dateOfDeath !== undefined && { dateOfDeath: dateOfDeath ? new Date(dateOfDeath) : null }),
          ...(placeOfBirth !== undefined && { placeOfBirth }),
          ...(lastResidentialAddress !== undefined && { lastResidentialAddress }),
          ...(fatherName !== undefined && { fatherName }),
          ...(motherName !== undefined && { motherName }),
          ...(maritalStatus !== undefined && { maritalStatus }),
          ...(spouseName !== undefined && { spouseName }),
          ...(brothersNames !== undefined && { brothersNames }),
          ...(sistersNames !== undefined && { sistersNames }),
          ...(fatherInLawName !== undefined && { fatherInLawName }),
          ...(motherInLawName !== undefined && { motherInLawName }),
          ...(sonsNames !== undefined && { sonsNames }),
          ...(daughtersNames !== undefined && { daughtersNames }),
          ...(sonsInLawNames !== undefined && { sonsInLawNames }),
          ...(daughtersInLawNames !== undefined && { daughtersInLawNames }),
          ...(grandchildrenNames !== undefined && { grandchildrenNames }),
          ...(occupations !== undefined && { occupations }),
          ...(hobbiesInterests !== undefined && { hobbiesInterests }),
          ...(communityActivities !== undefined && { communityActivities }),
          ...(otherDetails !== undefined && { otherDetails }),
          ...(lifeStory !== undefined && { lifeStory }),
          ...(status !== undefined && { status }),
          ...(publishedAt !== undefined
            ? { publishedAt: new Date(publishedAt) }
            : status === 'APPROVED' && existing.status !== 'APPROVED'
              ? { publishedAt: new Date() }
              : {}),
          ...(req.file && { imageMimeType: getImageMimeType(req.file) }),
          // Cast Buffer to Uint8Array<ArrayBuffer> for Prisma v6 Bytes field compatibility
          ...(req.file && { imageData: encryptImage(req.file.buffer) as unknown as Uint8Array<ArrayBuffer> }),
        },
        select: { id: true, name: true, slug: true, content: true, status: true, publishedAt: true, createdAt: true },
      });

      await invalidateByTags(['obituaries', 'search', `obituary:${id}`]);
      revalidateFrontend();
      res.json(obituary);
    } catch (err) {
      console.error('[obituaries] PUT /:id error:', err);
      res.status(500).json({ error: { code: 'INTERNAL_ERROR', message: 'Failed to update obituary' } });
    }
  },
);

// â”€â”€â”€ DELETE /:id â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

router.delete(
  '/:id',
  requireAuth,
  requireRole('ADMIN', 'EDITOR'),
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const id = req.params.id as string;
      const existing = await prisma.obituary.findUnique({ where: { id } });
      if (!existing) {
        res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Obituary not found' } });
        return;
      }
      await prisma.obituary.delete({ where: { id } });
      await invalidateByTags(['obituaries', 'search', `obituary:${id}`]);
      revalidateFrontend();
      res.json({ message: 'Obituary deleted' });
    } catch (err) {
      console.error('[obituaries] DELETE /:id error:', err);
      res.status(500).json({ error: { code: 'INTERNAL_ERROR', message: 'Failed to delete obituary' } });
    }
  },
);

export default router;
