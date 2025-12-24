import { Hono } from 'hono';
import { createReadStream, createWriteStream, existsSync, mkdirSync, readdirSync, statSync, unlinkSync } from 'fs';
import { join, extname, basename } from 'path';
import { randomUUID } from 'crypto';
import { Readable } from 'stream';
import { zValidator } from '@hono/zod-validator';
import { z } from 'zod';
import { authMiddleware, editorOrAdmin } from '../middleware/auth.js';

const media = new Hono();

// Apply auth to upload and delete routes (read routes are public for serving media)
// Listing also requires auth to prevent enumeration
media.use('/upload', authMiddleware);
media.use('/upload', editorOrAdmin);
media.delete('/*', authMiddleware);
media.delete('/*', editorOrAdmin);
// List route requires auth
media.get('/', authMiddleware);
media.get('/', editorOrAdmin);

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

// Ensure directories exist
function ensureDirectories() {
  Object.values(typeToDir).forEach(dir => {
    const fullPath = join(MEDIA_DIR, dir);
    if (!existsSync(fullPath)) {
      mkdirSync(fullPath, { recursive: true });
    }
  });
}

ensureDirectories();

// ===========================================
// HELPER FUNCTIONS
// ===========================================

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
  // Sanitize original name
  const baseName = basename(originalName, ext)
    .replace(/[^a-zA-Z0-9-_]/g, '-')
    .toLowerCase()
    .substring(0, 50);
  return `${baseName}-${timestamp}-${uuid}${ext}`;
}

interface MediaFile {
  name: string;
  path: string;
  url: string;
  type: 'image' | 'video' | 'document';
  size: number;
  mimeType: string;
  createdAt: string;
}

function getFileInfo(dir: string, filename: string): MediaFile | null {
  const fullPath = join(MEDIA_DIR, dir, filename);
  if (!existsSync(fullPath)) return null;

  const stat = statSync(fullPath);
  const ext = extname(filename);

  return {
    name: filename,
    path: `/${dir}/${filename}`,
    url: `/api/media/${dir}/${filename}`,
    type: dir === 'images' ? 'image' : dir === 'videos' ? 'video' : 'document',
    size: stat.size,
    mimeType: getMimeType(ext),
    createdAt: stat.birthtime.toISOString(),
  };
}

// ===========================================
// ROUTES
// ===========================================

// GET /api/media - List all media files
media.get('/', async (c) => {
  try {
    const typeFilter = c.req.query('type') as 'image' | 'video' | 'document' | undefined;
    const files: MediaFile[] = [];

    const dirsToScan = typeFilter ? [typeToDir[typeFilter]] : Object.values(typeToDir);

    for (const dir of dirsToScan) {
      const dirPath = join(MEDIA_DIR, dir);
      if (!existsSync(dirPath)) continue;

      const dirFiles = readdirSync(dirPath);
      for (const filename of dirFiles) {
        const fileInfo = getFileInfo(dir, filename);
        if (fileInfo) files.push(fileInfo);
      }
    }

    // Sort by creation date (newest first)
    files.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

    return c.json({
      files,
      total: files.length,
    });
  } catch (error) {
    console.error('Error listing media:', error);
    return c.json({ error: 'Failed to list media files' }, 500);
  }
});

// GET /api/media/:type/:filename - Serve a media file
media.get('/:type/:filename', async (c) => {
  try {
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

    const filePath = join(MEDIA_DIR, type, filename);

    if (!existsSync(filePath)) {
      return c.json({ error: 'File not found' }, 404);
    }

    const stat = statSync(filePath);
    const ext = extname(filename);
    const mimeType = getMimeType(ext);

    // Set cache headers for static files
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

// POST /api/media/upload - Upload a media file
media.post('/upload', async (c) => {
  try {
    const formData = await c.req.formData();
    const file = formData.get('file') as File | null;

    if (!file) {
      return c.json({ error: 'No file provided' }, 400);
    }

    // Check file size
    if (file.size > MAX_FILE_SIZE) {
      return c.json({ error: `File too large. Maximum size is ${MAX_FILE_SIZE / 1024 / 1024}MB` }, 400);
    }

    // Check file type
    const mediaType = getMediaType(file.type);
    if (!mediaType) {
      return c.json({
        error: 'Invalid file type',
        allowed: [...ALLOWED_IMAGE_TYPES, ...ALLOWED_VIDEO_TYPES, ...ALLOWED_DOCUMENT_TYPES],
      }, 400);
    }

    // Generate filename and path
    const filename = generateFilename(file.name);
    const dir = typeToDir[mediaType];
    const filePath = join(MEDIA_DIR, dir, filename);

    // Save file
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    await new Promise<void>((resolve, reject) => {
      const writeStream = createWriteStream(filePath);
      writeStream.write(buffer);
      writeStream.end();
      writeStream.on('finish', resolve);
      writeStream.on('error', reject);
    });

    const fileInfo = getFileInfo(dir, filename);

    return c.json({
      message: 'File uploaded successfully',
      file: fileInfo,
    }, 201);
  } catch (error) {
    console.error('Error uploading media:', error);
    return c.json({ error: 'Failed to upload file' }, 500);
  }
});

// DELETE /api/media/:type/:filename - Delete a media file
media.delete('/:type/:filename', async (c) => {
  try {
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

    const filePath = join(MEDIA_DIR, type, filename);

    if (!existsSync(filePath)) {
      return c.json({ error: 'File not found' }, 404);
    }

    unlinkSync(filePath);

    return c.json({ message: 'File deleted successfully' });
  } catch (error) {
    console.error('Error deleting media:', error);
    return c.json({ error: 'Failed to delete file' }, 500);
  }
});

// GET /api/media/info/:type/:filename - Get file info
media.get('/info/:type/:filename', async (c) => {
  try {
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

    const fileInfo = getFileInfo(type, filename);

    if (!fileInfo) {
      return c.json({ error: 'File not found' }, 404);
    }

    return c.json(fileInfo);
  } catch (error) {
    console.error('Error getting file info:', error);
    return c.json({ error: 'Failed to get file info' }, 500);
  }
});

export default media;
