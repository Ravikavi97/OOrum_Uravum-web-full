import { Express } from 'express';
import swaggerUi from 'swagger-ui-express';

const spec = {
  openapi: '3.0.3',
  info: {
    title: 'OORUM URAVUM — Tamil News Platform API',
    version: '1.0.0',
    description: 'REST API for the Tamil news CMS platform. Provides endpoints for articles, categories, tags, users, media, comments, obituaries, advertisements, settings, and visitor tracking.',
  },
  servers: [
    { url: '/api', description: 'API base path' },
  ],
  components: {
    securitySchemes: {
      BearerAuth: { type: 'http', scheme: 'bearer', bearerFormat: 'JWT' },
    },
    schemas: {
      Error: {
        type: 'object',
        properties: {
          error: {
            type: 'object',
            properties: {
              code: { type: 'string' },
              message: { type: 'string' },
              details: { type: 'object', additionalProperties: { type: 'array', items: { type: 'string' } } },
            },
          },
        },
      },
      PaginatedResponse: {
        type: 'object',
        properties: {
          data: { type: 'array', items: {} },
          total: { type: 'integer' },
          page: { type: 'integer' },
          pageSize: { type: 'integer' },
          totalPages: { type: 'integer' },
        },
      },
      Article: {
        type: 'object',
        properties: {
          id: { type: 'string' },
          title: { type: 'string' },
          slug: { type: 'string' },
          content: { type: 'string' },
          excerpt: { type: 'string', nullable: true },
          status: { type: 'string', enum: ['DRAFT', 'PUBLISHED', 'ARCHIVED'] },
          isBreaking: { type: 'boolean' },
          featuredImage: { type: 'string', nullable: true },
          publishedAt: { type: 'string', format: 'date-time', nullable: true },
          updatedAt: { type: 'string', format: 'date-time' },
          author: { type: 'object', properties: { id: { type: 'string' }, name: { type: 'string' }, slug: { type: 'string' } } },
          category: { type: 'object', properties: { id: { type: 'string' }, name: { type: 'string' }, slug: { type: 'string' } } },
          tags: { type: 'array', items: { type: 'object', properties: { id: { type: 'string' }, name: { type: 'string' }, slug: { type: 'string' } } } },
        },
      },
      Category: {
        type: 'object',
        properties: {
          id: { type: 'string' },
          name: { type: 'string' },
          slug: { type: 'string' },
          description: { type: 'string', nullable: true },
          parentId: { type: 'string', nullable: true },
          children: { type: 'array', items: { $ref: '#/components/schemas/Category' } },
        },
      },
      Tag: {
        type: 'object',
        properties: { id: { type: 'string' }, name: { type: 'string' }, slug: { type: 'string' } },
      },
      User: {
        type: 'object',
        properties: {
          id: { type: 'string' },
          email: { type: 'string' },
          name: { type: 'string' },
          role: { type: 'string', enum: ['ADMIN', 'EDITOR', 'AUTHOR'] },
          slug: { type: 'string' },
          createdAt: { type: 'string', format: 'date-time' },
        },
      },
      Media: {
        type: 'object',
        properties: {
          id: { type: 'string' },
          filename: { type: 'string' },
          originalUrl: { type: 'string' },
          thumbnailUrl: { type: 'string', nullable: true },
          mediumUrl: { type: 'string', nullable: true },
          largeUrl: { type: 'string', nullable: true },
          mimeType: { type: 'string' },
          size: { type: 'integer' },
          createdAt: { type: 'string', format: 'date-time' },
        },
      },
      Comment: {
        type: 'object',
        properties: {
          id: { type: 'string' },
          displayName: { type: 'string' },
          email: { type: 'string' },
          content: { type: 'string' },
          status: { type: 'string', enum: ['PENDING', 'APPROVED', 'FLAGGED', 'REJECTED'] },
          articleId: { type: 'string' },
          createdAt: { type: 'string', format: 'date-time' },
        },
      },
      Obituary: {
        type: 'object',
        properties: {
          id: { type: 'string' },
          name: { type: 'string' },
          content: { type: 'string' },
          publishedAt: { type: 'string', format: 'date-time' },
          createdAt: { type: 'string', format: 'date-time' },
        },
      },
      Advertisement: {
        type: 'object',
        properties: {
          id: { type: 'string' },
          title: { type: 'string' },
          description: { type: 'string', nullable: true },
          imageUrl: { type: 'string', nullable: true },
          linkUrl: { type: 'string', nullable: true },
          position: { type: 'string', enum: ['sidebar', 'banner'] },
          active: { type: 'boolean' },
          order: { type: 'integer' },
        },
      },
      VisitorStats: {
        type: 'object',
        properties: {
          live: { type: 'integer' },
          today: { type: 'integer' },
          total: { type: 'integer' },
        },
      },
      LoginRequest: {
        type: 'object',
        required: ['email', 'password'],
        properties: { email: { type: 'string', format: 'email' }, password: { type: 'string' } },
      },
      LoginResponse: {
        type: 'object',
        properties: {
          accessToken: { type: 'string' },
          refreshToken: { type: 'string' },
          user: { $ref: '#/components/schemas/User' },
        },
      },
    },
  },
  paths: {
    // ── Auth ──
    '/auth/login': {
      post: {
        tags: ['Auth'],
        summary: 'Login',
        requestBody: { required: true, content: { 'application/json': { schema: { $ref: '#/components/schemas/LoginRequest' } } } },
        responses: {
          '200': { description: 'Login successful', content: { 'application/json': { schema: { $ref: '#/components/schemas/LoginResponse' } } } },
          '401': { description: 'Invalid credentials', content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } } },
          '423': { description: 'Account locked' },
        },
      },
    },
    '/auth/refresh': {
      post: {
        tags: ['Auth'],
        summary: 'Refresh access token',
        requestBody: { required: true, content: { 'application/json': { schema: { type: 'object', required: ['refreshToken'], properties: { refreshToken: { type: 'string' } } } } } },
        responses: {
          '200': { description: 'New tokens', content: { 'application/json': { schema: { type: 'object', properties: { accessToken: { type: 'string' }, refreshToken: { type: 'string' } } } } } },
          '401': { description: 'Invalid refresh token' },
        },
      },
    },
    // ── Articles ──
    '/articles': {
      get: {
        tags: ['Articles'],
        summary: 'List articles',
        parameters: [
          { name: 'page', in: 'query', schema: { type: 'integer', default: 1 } },
          { name: 'pageSize', in: 'query', schema: { type: 'integer', default: 10 } },
          { name: 'status', in: 'query', schema: { type: 'string', enum: ['DRAFT', 'PUBLISHED', 'ARCHIVED'] } },
          { name: 'category', in: 'query', schema: { type: 'string' }, description: 'Category slug' },
          { name: 'tag', in: 'query', schema: { type: 'string' }, description: 'Tag slug' },
          { name: 'author', in: 'query', schema: { type: 'string' }, description: 'Author slug' },
          { name: 'isBreaking', in: 'query', schema: { type: 'boolean' } },
        ],
        responses: { '200': { description: 'Paginated articles', content: { 'application/json': { schema: { $ref: '#/components/schemas/PaginatedResponse' } } } } },
      },
      post: {
        tags: ['Articles'],
        summary: 'Create article',
        security: [{ BearerAuth: [] }],
        requestBody: { required: true, content: { 'application/json': { schema: { type: 'object', required: ['title', 'content', 'categoryId'], properties: { title: { type: 'string' }, content: { type: 'string' }, excerpt: { type: 'string' }, categoryId: { type: 'string' }, tagIds: { type: 'array', items: { type: 'string' } }, featuredImage: { type: 'string' }, isBreaking: { type: 'boolean' }, status: { type: 'string', enum: ['DRAFT', 'PUBLISHED', 'ARCHIVED'] } } } } } },
        responses: { '201': { description: 'Created', content: { 'application/json': { schema: { $ref: '#/components/schemas/Article' } } } }, '400': { description: 'Validation error' } },
      },
    },
    '/articles/{slug}': {
      get: {
        tags: ['Articles'],
        summary: 'Get article by slug',
        parameters: [{ name: 'slug', in: 'path', required: true, schema: { type: 'string' } }],
        responses: { '200': { description: 'Article', content: { 'application/json': { schema: { $ref: '#/components/schemas/Article' } } } }, '404': { description: 'Not found' } },
      },
    },
    '/articles/{id}': {
      put: {
        tags: ['Articles'],
        summary: 'Update article',
        security: [{ BearerAuth: [] }],
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
        requestBody: { content: { 'application/json': { schema: { type: 'object', properties: { title: { type: 'string' }, content: { type: 'string' }, excerpt: { type: 'string' }, categoryId: { type: 'string' }, tagIds: { type: 'array', items: { type: 'string' } }, featuredImage: { type: 'string' }, isBreaking: { type: 'boolean' }, status: { type: 'string' } } } } } },
        responses: { '200': { description: 'Updated' }, '404': { description: 'Not found' } },
      },
      delete: {
        tags: ['Articles'],
        summary: 'Delete article',
        security: [{ BearerAuth: [] }],
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
        responses: { '200': { description: 'Deleted' }, '404': { description: 'Not found' } },
      },
    },
    // ── Categories ──
    '/categories': {
      get: { tags: ['Categories'], summary: 'List categories with children', responses: { '200': { description: 'Categories array', content: { 'application/json': { schema: { type: 'array', items: { $ref: '#/components/schemas/Category' } } } } } } },
      post: { tags: ['Categories'], summary: 'Create category', security: [{ BearerAuth: [] }], requestBody: { required: true, content: { 'application/json': { schema: { type: 'object', required: ['name'], properties: { name: { type: 'string' }, description: { type: 'string' }, parentId: { type: 'string' } } } } } }, responses: { '201': { description: 'Created' } } },
    },
    '/categories/{id}': {
      put: { tags: ['Categories'], summary: 'Update category', security: [{ BearerAuth: [] }], parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }], requestBody: { content: { 'application/json': { schema: { type: 'object', properties: { name: { type: 'string' }, description: { type: 'string' }, parentId: { type: 'string' } } } } } }, responses: { '200': { description: 'Updated' } } },
      delete: { tags: ['Categories'], summary: 'Delete category (Admin)', security: [{ BearerAuth: [] }], parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }], responses: { '200': { description: 'Deleted' } } },
    },
    // ── Tags ──
    '/tags': {
      get: { tags: ['Tags'], summary: 'List tags', responses: { '200': { description: 'Tags array', content: { 'application/json': { schema: { type: 'array', items: { $ref: '#/components/schemas/Tag' } } } } } } },
      post: { tags: ['Tags'], summary: 'Create tag', security: [{ BearerAuth: [] }], requestBody: { required: true, content: { 'application/json': { schema: { type: 'object', required: ['name'], properties: { name: { type: 'string' } } } } } }, responses: { '201': { description: 'Created' } } },
    },
    '/tags/{id}': {
      put: { tags: ['Tags'], summary: 'Update tag', security: [{ BearerAuth: [] }], parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }], requestBody: { content: { 'application/json': { schema: { type: 'object', properties: { name: { type: 'string' } } } } } }, responses: { '200': { description: 'Updated' } } },
      delete: { tags: ['Tags'], summary: 'Delete tag', security: [{ BearerAuth: [] }], parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }], responses: { '200': { description: 'Deleted' } } },
    },
    // ── Users ──
    '/users': {
      get: { tags: ['Users'], summary: 'List users (Admin)', security: [{ BearerAuth: [] }], parameters: [{ name: 'page', in: 'query', schema: { type: 'integer' } }, { name: 'pageSize', in: 'query', schema: { type: 'integer' } }], responses: { '200': { description: 'Paginated users' } } },
      post: { tags: ['Users'], summary: 'Create user (Admin)', security: [{ BearerAuth: [] }], requestBody: { required: true, content: { 'application/json': { schema: { type: 'object', required: ['email', 'password', 'name'], properties: { email: { type: 'string' }, password: { type: 'string', minLength: 8 }, name: { type: 'string' }, role: { type: 'string', enum: ['ADMIN', 'EDITOR', 'AUTHOR'] } } } } } }, responses: { '201': { description: 'Created' }, '409': { description: 'Duplicate email' } } },
    },
    '/users/{id}': {
      put: { tags: ['Users'], summary: 'Update user (Admin)', security: [{ BearerAuth: [] }], parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }], responses: { '200': { description: 'Updated' } } },
      delete: { tags: ['Users'], summary: 'Delete user (Admin)', security: [{ BearerAuth: [] }], parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }], responses: { '200': { description: 'Deleted' } } },
    },
    // ── Media ──
    '/media': {
      get: { tags: ['Media'], summary: 'List media', security: [{ BearerAuth: [] }], responses: { '200': { description: 'Media array', content: { 'application/json': { schema: { type: 'array', items: { $ref: '#/components/schemas/Media' } } } } } } },
    },
    '/media/upload': {
      post: { tags: ['Media'], summary: 'Upload image', security: [{ BearerAuth: [] }], requestBody: { required: true, content: { 'multipart/form-data': { schema: { type: 'object', properties: { file: { type: 'string', format: 'binary' } } } } } }, responses: { '201': { description: 'Uploaded media', content: { 'application/json': { schema: { $ref: '#/components/schemas/Media' } } } }, '400': { description: 'Invalid file' } } },
    },
    '/media/{id}': {
      delete: { tags: ['Media'], summary: 'Delete media', security: [{ BearerAuth: [] }], parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }], responses: { '200': { description: 'Deleted' } } },
    },
    // ── Comments ──
    '/comments/admin/all': {
      get: { tags: ['Comments'], summary: 'List all comments (Admin/Editor)', security: [{ BearerAuth: [] }], parameters: [{ name: 'status', in: 'query', schema: { type: 'string', enum: ['PENDING', 'APPROVED', 'FLAGGED', 'REJECTED'] } }], responses: { '200': { description: 'Paginated comments' } } },
    },
    '/comments/{id}/approve': {
      put: { tags: ['Comments'], summary: 'Approve comment', security: [{ BearerAuth: [] }], parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }], responses: { '200': { description: 'Approved' } } },
    },
    '/comments/{id}/reject': {
      put: { tags: ['Comments'], summary: 'Reject comment', security: [{ BearerAuth: [] }], parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }], responses: { '200': { description: 'Rejected' } } },
    },
    // ── Settings ──
    '/settings/public': {
      get: { tags: ['Settings'], summary: 'Get public settings (no auth)', responses: { '200': { description: 'Settings object', content: { 'application/json': { schema: { type: 'object', additionalProperties: { type: 'string' } } } } } } },
    },
    '/settings': {
      get: { tags: ['Settings'], summary: 'Get all settings (Admin)', security: [{ BearerAuth: [] }], responses: { '200': { description: 'Settings array', content: { 'application/json': { schema: { type: 'array', items: { type: 'object', properties: { key: { type: 'string' }, value: { type: 'string' } } } } } } } } },
      put: { tags: ['Settings'], summary: 'Update setting (Admin)', security: [{ BearerAuth: [] }], requestBody: { required: true, content: { 'application/json': { schema: { type: 'object', properties: { key: { type: 'string' }, value: { type: 'string' }, siteTitle: { type: 'string' }, siteDescription: { type: 'string' }, siteTagline: { type: 'string' } } } } } }, responses: { '200': { description: 'Updated settings' } } },
    },
    // ── Obituaries ──
    '/obituaries': {
      get: { tags: ['Obituaries'], summary: 'List obituaries', parameters: [{ name: 'page', in: 'query', schema: { type: 'integer' } }, { name: 'pageSize', in: 'query', schema: { type: 'integer' } }], responses: { '200': { description: 'Paginated obituaries' } } },
      post: { tags: ['Obituaries'], summary: 'Create obituary', security: [{ BearerAuth: [] }], requestBody: { required: true, content: { 'multipart/form-data': { schema: { type: 'object', required: ['name', 'content'], properties: { name: { type: 'string' }, content: { type: 'string' }, image: { type: 'string', format: 'binary' }, publishedAt: { type: 'string', format: 'date-time' } } } } } }, responses: { '201': { description: 'Created' } } },
    },
    '/obituaries/{id}/image': {
      get: { tags: ['Obituaries'], summary: 'Get obituary image', parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }], responses: { '200': { description: 'Image bytes', content: { 'image/jpeg': {} } }, '404': { description: 'Not found' } } },
    },
    '/obituaries/{id}': {
      put: { tags: ['Obituaries'], summary: 'Update obituary', security: [{ BearerAuth: [] }], parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }], responses: { '200': { description: 'Updated' } } },
      delete: { tags: ['Obituaries'], summary: 'Delete obituary', security: [{ BearerAuth: [] }], parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }], responses: { '200': { description: 'Deleted' } } },
    },
    // ── Advertisements ──
    '/ads': {
      get: { tags: ['Advertisements'], summary: 'List ads (public: active only)', responses: { '200': { description: 'Ads array', content: { 'application/json': { schema: { type: 'array', items: { $ref: '#/components/schemas/Advertisement' } } } } } } },
      post: { tags: ['Advertisements'], summary: 'Create ad (Admin)', security: [{ BearerAuth: [] }], requestBody: { required: true, content: { 'application/json': { schema: { type: 'object', required: ['title'], properties: { title: { type: 'string' }, description: { type: 'string' }, imageUrl: { type: 'string' }, linkUrl: { type: 'string' }, position: { type: 'string', enum: ['sidebar', 'banner'] }, active: { type: 'boolean' } } } } } }, responses: { '201': { description: 'Created' } } },
    },
    '/ads/{id}': {
      put: { tags: ['Advertisements'], summary: 'Update ad (Admin)', security: [{ BearerAuth: [] }], parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }], responses: { '200': { description: 'Updated' } } },
      delete: { tags: ['Advertisements'], summary: 'Delete ad (Admin)', security: [{ BearerAuth: [] }], parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }], responses: { '200': { description: 'Deleted' } } },
    },
    // ── Visitors ──
    '/visitors/ping': {
      post: { tags: ['Visitors'], summary: 'Register/heartbeat visitor', requestBody: { content: { 'application/json': { schema: { type: 'object', properties: { sessionId: { type: 'string' } } } } } }, responses: { '200': { description: 'Session ID', content: { 'application/json': { schema: { type: 'object', properties: { sessionId: { type: 'string' } } } } } } } },
    },
    '/visitors/stats': {
      get: { tags: ['Visitors'], summary: 'Get visitor statistics', responses: { '200': { description: 'Stats', content: { 'application/json': { schema: { $ref: '#/components/schemas/VisitorStats' } } } } } },
    },
    // ── Search ──
    '/search': {
      get: { tags: ['Search'], summary: 'Search articles', parameters: [{ name: 'q', in: 'query', required: true, schema: { type: 'string' } }, { name: 'page', in: 'query', schema: { type: 'integer' } }], responses: { '200': { description: 'Search results' } } },
    },
    // ── Authors ──
    '/authors': {
      get: { tags: ['Authors'], summary: 'List authors', responses: { '200': { description: 'Authors array' } } },
    },
    '/authors/{slug}': {
      get: { tags: ['Authors'], summary: 'Get author by slug', parameters: [{ name: 'slug', in: 'path', required: true, schema: { type: 'string' } }], responses: { '200': { description: 'Author' }, '404': { description: 'Not found' } } },
    },
  },
  tags: [
    { name: 'Auth', description: 'Authentication endpoints' },
    { name: 'Articles', description: 'News article CRUD' },
    { name: 'Categories', description: 'Category management' },
    { name: 'Tags', description: 'Tag management' },
    { name: 'Users', description: 'User management (Admin)' },
    { name: 'Media', description: 'Media library' },
    { name: 'Comments', description: 'Comment moderation' },
    { name: 'Settings', description: 'Site settings' },
    { name: 'Obituaries', description: 'Obituary management' },
    { name: 'Advertisements', description: 'Advertisement management' },
    { name: 'Visitors', description: 'Visitor tracking' },
    { name: 'Search', description: 'Article search' },
    { name: 'Authors', description: 'Author profiles' },
  ],
};

export function setupSwagger(app: Express) {
  app.use('/api/docs', swaggerUi.serve, swaggerUi.setup(spec, {
    customCss: '.swagger-ui .topbar { display: none }',
    customSiteTitle: 'OORUM URAVUM API Docs',
  }));
  app.get('/api/docs.json', (_req, res) => res.json(spec));
}
