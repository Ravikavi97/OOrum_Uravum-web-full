import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import path from 'path';
import dotenv from 'dotenv';
import authRouter from './routes/auth';
import articlesRouter from './routes/articles';
import categoriesRouter from './routes/categories';
import tagsRouter from './routes/tags';
import searchRouter from './routes/search';
import authorsRouter from './routes/authors';
import sitemapRouter from './routes/sitemap';
import feedRouter from './routes/feed';
import usersRouter from './routes/users';
import commentsRouter from './routes/comments';
import mediaRouter from './routes/media';
import ingestRouter from './routes/ingest';
import settingsRouter from './routes/settings';
import obituariesRouter from './routes/obituaries';
import visitorsRouter from './routes/visitors';
import adsRouter from './routes/advertisements';
import { publicRateLimiter } from './middleware/rateLimiter';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 4000;

// Security middleware
app.use(helmet());

// CORS configuration
const corsOrigin = process.env.CORS_ORIGIN || 'http://localhost:3000';
app.use(cors({
  origin: corsOrigin.includes(',') ? corsOrigin.split(',').map(s => s.trim()) : corsOrigin,
  credentials: true,
}));

// Body parsing
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Rate limiting — public limiter on all /api/* routes
app.use('/api', publicRateLimiter);

// Serve uploaded media files — allow cross-origin access for images
const uploadPath = process.env.MEDIA_UPLOAD_PATH || './uploads';
app.use('/uploads', (_req, res, next) => {
  res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');
  next();
}, express.static(path.resolve(uploadPath)));

// Routes
app.use('/api/auth', authRouter);
app.use('/api/articles', articlesRouter);
app.use('/api/categories', categoriesRouter);
app.use('/api/tags', tagsRouter);
app.use('/api/search', searchRouter);
app.use('/api/authors', authorsRouter);
app.use('/api/sitemap', sitemapRouter);
app.use('/api/feed', feedRouter);
app.use('/api/users', usersRouter);
app.use('/api/comments', commentsRouter);
app.use('/api/media', mediaRouter);
app.use('/api/ingest', ingestRouter);
app.use('/api/settings', settingsRouter);
app.use('/api/obituaries', obituariesRouter);
app.use('/api/visitors', visitorsRouter);
app.use('/api/ads', adsRouter);

// Health check
app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.listen(PORT, () => {
  console.log(`Tamil News Backend running on port ${PORT}`);
});

export default app;
