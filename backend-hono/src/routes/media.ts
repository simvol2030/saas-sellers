/**
 * Media API - File uploads and management
 *
 * CRUD operations for media files with multisite support.
 * Files are stored in site-specific directories and tracked in database.
 *
 * Endpoints:
 * GET    /api/admin/media         - List media files
 * POST   /api/admin/media/upload  - Upload file
 * GET    /api/admin/media/:id     - Get media info
 * PUT    /api/admin/media/:id     - Update media metadata
 * DELETE /api/admin/media/:id     - Delete media file
 * GET    /api/media/:type/:filename - Serve file (public)
 */

import { Hono } from 'hono';
import { createReadStream, createWriteStream, existsSync, mkdirSync, unlinkSync, statSync } from 'fs';
import { join, extname, basename } from 'path';
import { randomUUID } from 'crypto';
import { Readable } from 'stream';
import { zValidator } from '@hono/zod-validator';
import { z } from 'zod';
import { prisma } from '../lib/db.js';
import { authMiddleware, editorOrAdmin } from '../middleware/auth.js';
import { siteMiddleware, requireSite } from '../middleware/site.js';
import { requireSection } from '../middleware/permissions.js';

const media = new Hono();

// ===========================================
// CONFIGURATION
// ===========================================

const MEDIA_DIR = process.env.MEDIA_DIR || join(process.cwd(), '..', 'data', 'media');
const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50MB
const ALLOWED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/svg+xml'];
const ALLOWED_VIDEO_TYPES = ['video/mp4', 'video/webm', 'video/ogg'];
const ALLOWED_DOCUMENT_TYPES = ['application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'];

// Media type to directory mapping
const typeToDir: Record<string, string> = {
  image: 'images',
  video: 'videos',
  document: 'documents',
};

// ===========================================
// HELPER FUNCTIONS
// ===========================================

function ensureSiteDirectories(siteId: number) {
  const siteDir = join(MEDIA_DIR, `site-${siteId}`);
  Object.values(typeToDir).forEach(dir => {
    const fullPath = join(siteDir, dir);
    if (!existsSync(fullPath)) {
      mkdirSync(fullPath, { recursive: true });
    }
  });
}

function getMediaType(mimeType: string): 'image' | 'video' | 'document' | null {
  if (ALLOWED_IMAGE_TYPES.includes(mimeType)) return 'image';
  if (ALLOWED_VIDEO_TYPES.includes(mimeType)) return 'video';
  if (ALLOWED_DOCUMENT_TYPES.includes(mimeType)) return 'document';
  return null;
}

function getMimeType(ext: string): string {
  const mimeTypes: Record<string, string> = {
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.png': 'image/png',
    '.gif': 'image/gif',
    '.webp': 'image/webp',
    '.svg': 'image/svg+xml',
    '.mp4': 'video/mp4',
    '.webm': 'video/webm',
    '.ogg': 'video/ogg',
    '.pdf': 'application/pdf',
    '.doc': 'application/msword',
    '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  };
  return mimeTypes[ext.toLowerCase()] || 'application/octet-stream';
}

function generateFilename(originalName: string): string {
  const ext = extname(originalName);
  const uuid = randomUUID().split('-')[0];
  const timestamp = Date.now();
  const baseName = basename(originalName, ext)
    .replace(/[^a-zA-Z0-9-_]/g, '-')
    .toLowerCase()
    .substring(0, 50);
  return `${baseName}-${timestamp}-${uuid}${ext}`;
}

// ===========================================
// VALIDATION SCHEMAS
// ===========================================

const updateMediaSchema = z.object({
  alt: z.string().max(500).nullish(),
  caption: z.string().max(1000).nullish(),
  folderId: z.number().nullish(),
});

const listQuerySchema = z.object({
  page: z.coerce.number().min(1).default(1),
  limit: z.coerce.number().min(1).max(100).default(20),
  type: z.enum(['image', 'video', 'document']).optional(),
  folderId: z.coerce.number().optional(),
});

// ===========================================
// ADMIN ROUTES (require auth + site)
// ===========================================

/**
 * GET /api/admin/media - List media files for current site
 */
media.get(
  '/',
  authMiddleware,
  editorOrAdmin,
  siteMiddleware,
  requireSite,
  requireSection('media'), // Phase 3: section-based access
  zValidator('query', listQuerySchema),
  async (c) => {
    const siteId = c.get('siteId');
    const { page, limit, type, folderId } = c.req.valid('query');
    const offset = (page - 1) * limit;

    try {
      const where: any = { siteId };
      if (type) where.type = type;
      if (folderId !== undefined) where.folderId = folderId || null;

      const total = await prisma.media.count({ where });
      const files = await prisma.media.findMany({
        where,
        skip: offset,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          folder: {
            select: { id: true, name: true, slug: true },
          },
          uploadedBy: {
            select: { id: true, name: true, email: true },
          },
        },
      });

      return c.json({
        files,
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit),
        },
      });
    } catch (error) {
      console.error('Error listing media:', error);
      return c.json({ error: 'Failed to list media files' }, 500);
    }
  }
);

/**
 * POST /api/admin/media/upload - Upload media file
 */
media.post(
  '/upload',
  authMiddleware,
  editorOrAdmin,
  siteMiddleware,
  requireSite,
  requireSection('media'), // Phase 3: section-based access
  async (c) => {
    const siteId = c.get('siteId');
    const user = c.get('user');

    try {
      const formData = await c.req.formData();
      const file = formData.get('file') as File | null;
      const folderIdStr = formData.get('folderId') as string | null;
      const folderId = folderIdStr ? parseInt(folderIdStr) : null;

      if (!file) {
        return c.json({ error: 'No file provided' }, 400);
      }

      if (file.size > MAX_FILE_SIZE) {
        return c.json({ error: `File too large. Maximum size is ${MAX_FILE_SIZE / 1024 / 1024}MB` }, 400);
      }

      const mediaType = getMediaType(file.type);
      if (!mediaType) {
        return c.json({
          error: 'Invalid file type',
          allowed: [...ALLOWED_IMAGE_TYPES, ...ALLOWED_VIDEO_TYPES, ...ALLOWED_DOCUMENT_TYPES],
        }, 400);
      }

      // Validate folder belongs to site
      if (folderId) {
        const folder = await prisma.mediaFolder.findFirst({
          where: { id: folderId, siteId },
        });
        if (!folder) {
          return c.json({ error: 'Folder not found' }, 400);
        }
      }

      // Ensure directories exist
      ensureSiteDirectories(siteId);

      // Generate filename and save
      const filename = generateFilename(file.name);
      const dir = typeToDir[mediaType];
      const relativePath = `/site-${siteId}/${dir}/${filename}`;
      const filePath = join(MEDIA_DIR, `site-${siteId}`, dir, filename);

      const arrayBuffer = await file.arrayBuffer();
      const buffer = Buffer.from(arrayBuffer);

      await new Promise<void>((resolve, reject) => {
        const writeStream = createWriteStream(filePath);
        writeStream.write(buffer);
        writeStream.end();
        writeStream.on('finish', resolve);
        writeStream.on('error', reject);
      });

      // Create database record
      const mediaRecord = await prisma.media.create({
        data: {
          filename,
          originalName: file.name,
          path: relativePath,
          url: `/api/media/site-${siteId}/${dir}/${filename}`,
          type: mediaType,
          mimeType: file.type,
          size: file.size,
          siteId,
          folderId,
          uploadedById: user.id,
        },
        include: {
          folder: {
            select: { id: true, name: true, slug: true },
          },
          uploadedBy: {
            select: { id: true, name: true, email: true },
          },
        },
      });

      return c.json({
        message: 'File uploaded successfully',
        file: mediaRecord,
      }, 201);
    } catch (error) {
      console.error('Error uploading media:', error);
      return c.json({ error: 'Failed to upload file' }, 500);
    }
  }
);

/**
 * GET /api/admin/media/:id - Get media info
 */
media.get(
  '/:id',
  authMiddleware,
  editorOrAdmin,
  siteMiddleware,
  requireSite,
  requireSection('media'), // Phase 3: section-based access
  async (c) => {
    const siteId = c.get('siteId');
    const id = parseInt(c.req.param('id'));

    if (isNaN(id)) {
      return c.json({ error: 'Invalid media ID' }, 400);
    }

    try {
      const mediaRecord = await prisma.media.findFirst({
        where: { id, siteId },
        include: {
          folder: {
            select: { id: true, name: true, slug: true },
          },
          uploadedBy: {
            select: { id: true, name: true, email: true },
          },
        },
      });

      if (!mediaRecord) {
        return c.json({ error: 'Media not found' }, 404);
      }

      return c.json({ file: mediaRecord });
    } catch (error) {
      console.error('Error getting media:', error);
      return c.json({ error: 'Failed to get media' }, 500);
    }
  }
);

/**
 * PUT /api/admin/media/:id - Update media metadata
 */
media.put(
  '/:id',
  authMiddleware,
  editorOrAdmin,
  siteMiddleware,
  requireSite,
  requireSection('media'), // Phase 3: section-based access
  zValidator('json', updateMediaSchema),
  async (c) => {
    const siteId = c.get('siteId');
    const id = parseInt(c.req.param('id'));
    const data = c.req.valid('json');

    if (isNaN(id)) {
      return c.json({ error: 'Invalid media ID' }, 400);
    }

    try {
      const existing = await prisma.media.findFirst({
        where: { id, siteId },
      });

      if (!existing) {
        return c.json({ error: 'Media not found' }, 404);
      }

      // Validate folder if changing
      if (data.folderId !== undefined && data.folderId !== null) {
        const folder = await prisma.mediaFolder.findFirst({
          where: { id: data.folderId, siteId },
        });
        if (!folder) {
          return c.json({ error: 'Folder not found' }, 400);
        }
      }

      const updated = await prisma.media.update({
        where: { id },
        data: {
          ...(data.alt !== undefined && { alt: data.alt }),
          ...(data.caption !== undefined && { caption: data.caption }),
          ...(data.folderId !== undefined && { folderId: data.folderId }),
        },
        include: {
          folder: {
            select: { id: true, name: true, slug: true },
          },
          uploadedBy: {
            select: { id: true, name: true, email: true },
          },
        },
      });

      return c.json({ file: updated });
    } catch (error) {
      console.error('Error updating media:', error);
      return c.json({ error: 'Failed to update media' }, 500);
    }
  }
);

/**
 * DELETE /api/admin/media/:id - Delete media file
 */
media.delete(
  '/:id',
  authMiddleware,
  editorOrAdmin,
  siteMiddleware,
  requireSite,
  requireSection('media'), // Phase 3: section-based access
  async (c) => {
    const siteId = c.get('siteId');
    const id = parseInt(c.req.param('id'));

    if (isNaN(id)) {
      return c.json({ error: 'Invalid media ID' }, 400);
    }

    try {
      const mediaRecord = await prisma.media.findFirst({
        where: { id, siteId },
      });

      if (!mediaRecord) {
        return c.json({ error: 'Media not found' }, 404);
      }

      // Delete file from disk
      const filePath = join(MEDIA_DIR, mediaRecord.path);
      if (existsSync(filePath)) {
        unlinkSync(filePath);
      }

      // Delete database record
      await prisma.media.delete({
        where: { id },
      });

      return c.json({ message: 'Media deleted successfully' });
    } catch (error) {
      console.error('Error deleting media:', error);
      return c.json({ error: 'Failed to delete media' }, 500);
    }
  }
);

// ===========================================
// PUBLIC ROUTES (serve files)
// ===========================================

/**
 * GET /api/media/site-:siteId/:type/:filename - Serve media file
 * Public route - determines site from URL path
 */
media.get('/site-:siteId/:type/:filename', async (c) => {
  try {
    const siteId = c.req.param('siteId');
    const type = c.req.param('type');
    const filename = c.req.param('filename');

    // Prevent directory traversal
    if (filename.includes('..') || filename.includes('/')) {
      return c.json({ error: 'Invalid filename' }, 400);
    }

    const validDirs = Object.values(typeToDir);
    if (!validDirs.includes(type)) {
      return c.json({ error: 'Invalid media type' }, 400);
    }

    const filePath = join(MEDIA_DIR, `site-${siteId}`, type, filename);

    if (!existsSync(filePath)) {
      return c.json({ error: 'File not found' }, 404);
    }

    const stat = statSync(filePath);
    const ext = extname(filename);
    const mimeType = getMimeType(ext);

    // Set cache headers
    c.header('Content-Type', mimeType);
    c.header('Content-Length', String(stat.size));
    c.header('Cache-Control', 'public, max-age=31536000, immutable');
    c.header('Accept-Ranges', 'bytes');

    // Handle range requests for video streaming
    const range = c.req.header('range');
    if (range && mimeType.startsWith('video/')) {
      const parts = range.replace(/bytes=/, '').split('-');
      const start = parseInt(parts[0], 10);
      const end = parts[1] ? parseInt(parts[1], 10) : stat.size - 1;
      const chunkSize = end - start + 1;

      c.header('Content-Range', `bytes ${start}-${end}/${stat.size}`);
      c.header('Content-Length', String(chunkSize));
      c.status(206);

      const stream = createReadStream(filePath, { start, end });
      return new Response(Readable.toWeb(stream) as ReadableStream, {
        status: 206,
        headers: {
          'Content-Type': mimeType,
          'Content-Range': `bytes ${start}-${end}/${stat.size}`,
          'Content-Length': String(chunkSize),
          'Accept-Ranges': 'bytes',
        },
      });
    }

    const stream = createReadStream(filePath);
    return new Response(Readable.toWeb(stream) as ReadableStream, {
      headers: {
        'Content-Type': mimeType,
        'Content-Length': String(stat.size),
        'Cache-Control': 'public, max-age=31536000, immutable',
      },
    });
  } catch (error) {
    console.error('Error serving media:', error);
    return c.json({ error: 'Failed to serve media file' }, 500);
  }
});


// Legacy /uploads/ route for backward compatibility  
media.get('/uploads/*', async (c) => {
  try {
    const reqPath = c.req.path.replace('/api/media/uploads/', '');
    const filePath = join(MEDIA_DIR, reqPath);
    
    if (reqPath.includes('..')) {
      return c.json({ error: 'Invalid path' }, 400);
    }
    
    if (!existsSync(filePath)) {
      return c.json({ error: 'File not found' }, 404);
    }
    
    const stat = statSync(filePath);
    const ext = extname(reqPath);
    const mimeType = getMimeType(ext);
    
    const stream = createReadStream(filePath);
    return new Response(Readable.toWeb(stream) as ReadableStream, {
      headers: {
        'Content-Type': mimeType,
        'Content-Length': String(stat.size),
        'Cache-Control': 'public, max-age=31536000',
      },
    });
  } catch (error) {
    console.error('Error serving upload:', error);
    return c.json({ error: 'Failed to serve file' }, 500);
  }
});

export default media;
