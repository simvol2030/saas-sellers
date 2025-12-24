/**
 * Media Folders API - Organize media files in folders
 *
 * Endpoints:
 * GET    /api/admin/media/folders           - List folders
 * POST   /api/admin/media/folders           - Create folder
 * GET    /api/admin/media/folders/:id       - Get folder
 * PUT    /api/admin/media/folders/:id       - Update folder
 * DELETE /api/admin/media/folders/:id       - Delete folder
 * PUT    /api/admin/media/:id/move          - Move file to folder
 */

import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { z } from 'zod';
import { prisma } from '../lib/db.js';
import { authMiddleware, editorOrAdmin } from '../middleware/auth.js';
import { siteMiddleware, requireSite } from '../middleware/site.js';

const mediaFolders = new Hono();

// Apply middlewares
mediaFolders.use('*', authMiddleware);
mediaFolders.use('*', editorOrAdmin);
mediaFolders.use('*', siteMiddleware);
mediaFolders.use('*', requireSite);

// ==========================================
// VALIDATION SCHEMAS
// ==========================================

const createFolderSchema = z.object({
  name: z.string().min(1, 'Name is required').max(100),
  slug: z.string().min(1).max(50).regex(/^[a-z0-9-]+$/, 'Slug must be lowercase alphanumeric with dashes'),
  parentId: z.number().optional().nullable(),
});

const updateFolderSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  slug: z.string().min(1).max(50).regex(/^[a-z0-9-]+$/).optional(),
  parentId: z.number().optional().nullable(),
});

const moveMediaSchema = z.object({
  folderId: z.number().nullable(),
});

// ==========================================
// HELPER FUNCTIONS
// ==========================================

interface FolderTree {
  id: number;
  name: string;
  slug: string;
  parentId: number | null;
  children: FolderTree[];
  _count: { media: number };
}

function buildFolderTree(folders: any[]): FolderTree[] {
  const folderMap = new Map<number, FolderTree>();
  const roots: FolderTree[] = [];

  // First pass: create all nodes
  for (const folder of folders) {
    folderMap.set(folder.id, {
      ...folder,
      children: [],
    });
  }

  // Second pass: build tree
  for (const folder of folders) {
    const node = folderMap.get(folder.id)!;
    if (folder.parentId === null) {
      roots.push(node);
    } else {
      const parent = folderMap.get(folder.parentId);
      if (parent) {
        parent.children.push(node);
      }
    }
  }

  return roots;
}

// ==========================================
// ROUTES
// ==========================================

/**
 * GET /api/admin/media/folders - List all folders for current site
 */
mediaFolders.get('/', async (c) => {
  const siteId = c.get('siteId');
  const parentId = c.req.query('parentId');
  const tree = c.req.query('tree') === 'true';

  try {
    const whereClause: any = { siteId };

    // Filter by parent if specified (null = root folders)
    if (parentId !== undefined) {
      whereClause.parentId = parentId === 'null' ? null : parseInt(parentId);
    }

    const folders = await prisma.mediaFolder.findMany({
      where: whereClause,
      include: {
        _count: {
          select: { media: true, children: true },
        },
        parent: {
          select: { id: true, name: true, slug: true },
        },
      },
      orderBy: { name: 'asc' },
    });

    if (tree && parentId === undefined) {
      // Return as tree structure
      const allFolders = await prisma.mediaFolder.findMany({
        where: { siteId },
        include: {
          _count: {
            select: { media: true },
          },
        },
        orderBy: { name: 'asc' },
      });

      return c.json({
        folders: buildFolderTree(allFolders),
        total: allFolders.length,
      });
    }

    return c.json({
      folders: folders.map((f: typeof folders[0]) => ({
        ...f,
        mediaCount: f._count.media,
        childCount: f._count.children,
      })),
      total: folders.length,
    });
  } catch (error) {
    console.error('Error listing folders:', error);
    return c.json({ error: 'Failed to list folders' }, 500);
  }
});

/**
 * POST /api/admin/media/folders - Create folder
 */
mediaFolders.post('/', zValidator('json', createFolderSchema), async (c) => {
  const siteId = c.get('siteId');
  const data = c.req.valid('json');

  try {
    // Check if parent exists (if specified)
    if (data.parentId) {
      const parent = await prisma.mediaFolder.findFirst({
        where: { id: data.parentId, siteId },
      });
      if (!parent) {
        return c.json({ error: 'Parent folder not found' }, 400);
      }
    }

    // Check slug uniqueness within same parent
    const existingSlug = await prisma.mediaFolder.findFirst({
      where: {
        siteId,
        parentId: data.parentId || null,
        slug: data.slug,
      },
    });

    if (existingSlug) {
      return c.json({ error: 'Folder with this slug already exists in this location' }, 400);
    }

    const folder = await prisma.mediaFolder.create({
      data: {
        name: data.name,
        slug: data.slug,
        parentId: data.parentId || null,
        siteId,
      },
      include: {
        parent: {
          select: { id: true, name: true, slug: true },
        },
      },
    });

    return c.json({ folder }, 201);
  } catch (error) {
    console.error('Error creating folder:', error);
    return c.json({ error: 'Failed to create folder' }, 500);
  }
});

/**
 * GET /api/admin/media/folders/:id - Get folder with contents
 */
mediaFolders.get('/:id', async (c) => {
  const siteId = c.get('siteId');
  const id = parseInt(c.req.param('id'));

  if (isNaN(id)) {
    return c.json({ error: 'Invalid folder ID' }, 400);
  }

  try {
    const folder = await prisma.mediaFolder.findFirst({
      where: { id, siteId },
      include: {
        parent: {
          select: { id: true, name: true, slug: true },
        },
        children: {
          select: { id: true, name: true, slug: true },
          orderBy: { name: 'asc' },
        },
        media: {
          orderBy: { createdAt: 'desc' },
        },
      },
    });

    if (!folder) {
      return c.json({ error: 'Folder not found' }, 404);
    }

    return c.json({ folder });
  } catch (error) {
    console.error('Error getting folder:', error);
    return c.json({ error: 'Failed to get folder' }, 500);
  }
});

/**
 * PUT /api/admin/media/folders/:id - Update folder
 */
mediaFolders.put('/:id', zValidator('json', updateFolderSchema), async (c) => {
  const siteId = c.get('siteId');
  const id = parseInt(c.req.param('id'));
  const data = c.req.valid('json');

  if (isNaN(id)) {
    return c.json({ error: 'Invalid folder ID' }, 400);
  }

  try {
    const existingFolder = await prisma.mediaFolder.findFirst({
      where: { id, siteId },
    });

    if (!existingFolder) {
      return c.json({ error: 'Folder not found' }, 404);
    }

    // Prevent moving folder to itself or its children
    if (data.parentId !== undefined && data.parentId !== null) {
      if (data.parentId === id) {
        return c.json({ error: 'Cannot move folder to itself' }, 400);
      }

      // Verify parent folder belongs to same site
      const parentFolder = await prisma.mediaFolder.findFirst({
        where: { id: data.parentId, siteId },
      });
      if (!parentFolder) {
        return c.json({ error: 'Target folder not found' }, 404);
      }

      // Check for circular reference (within same site)
      let currentParent = parentFolder;
      while (currentParent) {
        if (currentParent.id === id) {
          return c.json({ error: 'Cannot create circular folder structure' }, 400);
        }
        if (currentParent.parentId === null) break;
        const nextParent = await prisma.mediaFolder.findFirst({
          where: { id: currentParent.parentId, siteId },
        });
        if (!nextParent) break;
        currentParent = nextParent;
      }
    }

    // Check slug uniqueness if changing
    const newParentId = data.parentId !== undefined ? data.parentId : existingFolder.parentId;
    const newSlug = data.slug || existingFolder.slug;

    if (data.slug || data.parentId !== undefined) {
      const slugExists = await prisma.mediaFolder.findFirst({
        where: {
          siteId,
          parentId: newParentId,
          slug: newSlug,
          NOT: { id },
        },
      });

      if (slugExists) {
        return c.json({ error: 'Folder with this slug already exists in target location' }, 400);
      }
    }

    const folder = await prisma.mediaFolder.update({
      where: { id },
      data: {
        ...(data.name !== undefined && { name: data.name }),
        ...(data.slug !== undefined && { slug: data.slug }),
        ...(data.parentId !== undefined && { parentId: data.parentId }),
      },
      include: {
        parent: {
          select: { id: true, name: true, slug: true },
        },
      },
    });

    return c.json({ folder });
  } catch (error) {
    console.error('Error updating folder:', error);
    return c.json({ error: 'Failed to update folder' }, 500);
  }
});

/**
 * DELETE /api/admin/media/folders/:id - Delete folder
 */
mediaFolders.delete('/:id', async (c) => {
  const siteId = c.get('siteId');
  const id = parseInt(c.req.param('id'));

  if (isNaN(id)) {
    return c.json({ error: 'Invalid folder ID' }, 400);
  }

  try {
    const folder = await prisma.mediaFolder.findFirst({
      where: { id, siteId },
      include: {
        _count: {
          select: { media: true, children: true },
        },
      },
    });

    if (!folder) {
      return c.json({ error: 'Folder not found' }, 404);
    }

    // Check if folder has contents
    const hasContents = folder._count.media > 0 || folder._count.children > 0;
    if (hasContents) {
      const forceDelete = c.req.query('force') === 'true';
      if (!forceDelete) {
        return c.json(
          {
            error: 'Folder has contents',
            message: `Folder contains ${folder._count.media} files and ${folder._count.children} subfolders. Add ?force=true to delete anyway. Files will be moved to root.`,
          },
          400
        );
      }

      // Move media to root (null folderId)
      await prisma.media.updateMany({
        where: { folderId: id },
        data: { folderId: null },
      });

      // Move children to root
      await prisma.mediaFolder.updateMany({
        where: { parentId: id },
        data: { parentId: null },
      });
    }

    await prisma.mediaFolder.delete({
      where: { id },
    });

    return c.json({ message: 'Folder deleted successfully' });
  } catch (error) {
    console.error('Error deleting folder:', error);
    return c.json({ error: 'Failed to delete folder' }, 500);
  }
});

/**
 * PUT /api/admin/media/:id/move - Move media file to folder
 */
mediaFolders.put('/move/:mediaId', zValidator('json', moveMediaSchema), async (c) => {
  const siteId = c.get('siteId');
  const mediaId = parseInt(c.req.param('mediaId'));
  const { folderId } = c.req.valid('json');

  if (isNaN(mediaId)) {
    return c.json({ error: 'Invalid media ID' }, 400);
  }

  try {
    const media = await prisma.media.findFirst({
      where: { id: mediaId, siteId },
    });

    if (!media) {
      return c.json({ error: 'Media file not found' }, 404);
    }

    // Validate folder if specified
    if (folderId !== null) {
      const folder = await prisma.mediaFolder.findFirst({
        where: { id: folderId, siteId },
      });
      if (!folder) {
        return c.json({ error: 'Target folder not found' }, 404);
      }
    }

    const updatedMedia = await prisma.media.update({
      where: { id: mediaId },
      data: { folderId },
      include: {
        folder: {
          select: { id: true, name: true, slug: true },
        },
      },
    });

    return c.json({ media: updatedMedia });
  } catch (error) {
    console.error('Error moving media:', error);
    return c.json({ error: 'Failed to move media' }, 500);
  }
});

export default mediaFolders;
