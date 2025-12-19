/**
 * Pages API Routes
 *
 * CRUD операции для страниц лендингов
 *
 * Endpoints:
 * GET    /api/admin/pages           - List pages (with pagination, filters: parentId, tag)
 * POST   /api/admin/pages           - Create page
 * GET    /api/admin/pages/tree      - Get hierarchical tree of pages
 * GET    /api/admin/pages/:id       - Get page by ID
 * PUT    /api/admin/pages/:id       - Update page
 * DELETE /api/admin/pages/:id       - Delete page
 * POST   /api/admin/pages/:id/publish   - Publish page
 * POST   /api/admin/pages/:id/unpublish - Unpublish page
 * POST   /api/admin/pages/:id/duplicate - Duplicate page
 * PUT    /api/admin/pages/:id/tags      - Update page tags
 * PUT    /api/admin/pages/:id/parent    - Update page parent (move in hierarchy)
 * PUT    /api/admin/pages/:id/order     - Update page order
 */

import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { z } from 'zod';
import { prisma } from '../lib/db.js';
import { authMiddleware, editorOrAdmin } from '../middleware/auth.js';
import { siteMiddleware, requireSite } from '../middleware/site.js';

const pages = new Hono();

// Apply auth and site middleware to all routes
pages.use('*', authMiddleware);
pages.use('*', editorOrAdmin);
pages.use('*', siteMiddleware);
pages.use('*', requireSite);

// ===========================================
// VALIDATION SCHEMAS
// ===========================================

const sectionSchema = z.object({
  type: z.string(),
  id: z.string().nullish(),
  className: z.string().nullish(),
  hidden: z.boolean().optional(),
}).passthrough(); // Allow additional fields

const createPageSchema = z.object({
  slug: z.string()
    .min(1, 'Slug is required')
    .max(100, 'Slug too long')
    .regex(/^[a-z0-9-]+$/, 'Slug can only contain lowercase letters, numbers, and hyphens'),
  title: z.string().min(1, 'Title is required').max(200, 'Title too long'),
  description: z.string().max(500).nullish(),
  sections: z.array(sectionSchema).default([]),
  headerConfig: z.string().nullish(), // JSON string
  footerConfig: z.string().nullish(), // JSON string
  hideHeader: z.boolean().default(false),
  hideFooter: z.boolean().default(false),
  metaTitle: z.string().max(100).nullish(),
  metaDescription: z.string().max(200).nullish(),
  ogImage: z.string().nullish(),
  canonicalUrl: z.string().nullish(),
  noindex: z.boolean().default(false),
  prerender: z.boolean().default(true),
});

const updatePageSchema = createPageSchema.partial();

const listQuerySchema = z.object({
  page: z.coerce.number().min(1).default(1),
  limit: z.coerce.number().min(1).max(100).default(20),
  status: z.enum(['all', 'draft', 'published']).default('all'),
  search: z.string().nullish(),
  sortBy: z.enum(['createdAt', 'updatedAt', 'title', 'order']).default('updatedAt'),
  sortOrder: z.enum(['asc', 'desc']).default('desc'),
  parentId: z.coerce.number().nullish(), // Filter by parent for hierarchy
  tag: z.string().nullish(), // Filter by tag slug
});

const updatePageTagsSchema = z.object({
  tagIds: z.array(z.number()).default([]),
});

// ===========================================
// ROUTES
// ===========================================

/**
 * GET /api/admin/pages
 * List pages with pagination and filters
 */
pages.get('/', zValidator('query', listQuerySchema), async (c) => {
  const { page, limit, status, search, sortBy, sortOrder, parentId, tag } = c.req.valid('query');
  const siteId = c.get('siteId');
  const offset = (page - 1) * limit;

  try {
    // Build where clause - always filter by siteId
    const where: any = { siteId };

    if (status !== 'all') {
      where.status = status;
    }

    // Filter by parent (for hierarchy view)
    if (parentId !== undefined && parentId !== null) {
      where.parentId = parentId;
    }

    // Filter by tag slug
    if (tag) {
      where.tags = {
        some: {
          tag: {
            slug: tag,
            siteId, // Ensure tag belongs to same site
          },
        },
      };
    }

    if (search) {
      where.AND = [
        {
          OR: [
            { title: { contains: search } },
            { slug: { contains: search } },
            { description: { contains: search } },
          ],
        },
      ];
    }

    // Get total count
    const total = await prisma.page.count({ where });

    // Get pages with tags
    const pagesList = await prisma.page.findMany({
      where,
      skip: offset,
      take: limit,
      orderBy: sortBy === 'order' ? [{ order: sortOrder }, { createdAt: 'desc' }] : { [sortBy]: sortOrder },
      select: {
        id: true,
        slug: true,
        title: true,
        description: true,
        status: true,
        publishedAt: true,
        prerender: true,
        parentId: true,
        level: true,
        order: true,
        path: true,
        createdAt: true,
        updatedAt: true,
        author: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
        tags: {
          select: {
            tag: {
              select: {
                id: true,
                name: true,
                slug: true,
                color: true,
              },
            },
          },
        },
        _count: {
          select: {
            children: true,
          },
        },
      },
    });

    return c.json({
      pages: pagesList.map((p: typeof pagesList[0]) => ({
        ...p,
        tags: p.tags.map((pt: typeof p.tags[0]) => pt.tag),
        childrenCount: p._count.children,
      })),
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error('List pages error:', error);
    return c.json({ error: 'Failed to list pages' }, 500);
  }
});

/**
 * POST /api/admin/pages
 * Create new page
 */
pages.post('/', zValidator('json', createPageSchema), async (c) => {
  const data = c.req.valid('json');
  const user = c.get('user');
  const siteId = c.get('siteId');

  try {
    // Check if slug already exists within this site
    const existing = await prisma.page.findUnique({
      where: {
        siteId_slug: { siteId, slug: data.slug },
      },
    });

    if (existing) {
      return c.json({
        error: 'Page with this slug already exists',
        code: 'SLUG_EXISTS',
      }, 400);
    }

    // Create page with siteId
    const page = await prisma.page.create({
      data: {
        ...data,
        sections: JSON.stringify(data.sections),
        authorId: user.id,
        siteId,
      },
      include: {
        author: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
    });

    return c.json({
      message: 'Page created successfully',
      page: {
        ...page,
        sections: JSON.parse(page.sections),
      },
    }, 201);
  } catch (error) {
    console.error('Create page error:', error);
    return c.json({ error: 'Failed to create page' }, 500);
  }
});

/**
 * GET /api/admin/pages/:id
 * Get page by ID
 */
pages.get('/:id', async (c) => {
  const id = parseInt(c.req.param('id'), 10);
  const siteId = c.get('siteId');

  if (isNaN(id)) {
    return c.json({ error: 'Invalid page ID' }, 400);
  }

  try {
    const page = await prisma.page.findFirst({
      where: { id, siteId },
      include: {
        author: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
    });

    if (!page) {
      return c.json({ error: 'Page not found' }, 404);
    }

    return c.json({
      page: {
        ...page,
        sections: JSON.parse(page.sections),
        headerConfig: page.headerConfig ? JSON.parse(page.headerConfig) : null,
        footerConfig: page.footerConfig ? JSON.parse(page.footerConfig) : null,
      },
    });
  } catch (error) {
    console.error('Get page error:', error);
    return c.json({ error: 'Failed to get page' }, 500);
  }
});

/**
 * PUT /api/admin/pages/:id
 * Update page
 */
pages.put('/:id', zValidator('json', updatePageSchema), async (c) => {
  const id = parseInt(c.req.param('id'), 10);
  const data = c.req.valid('json');
  const siteId = c.get('siteId');

  if (isNaN(id)) {
    return c.json({ error: 'Invalid page ID' }, 400);
  }

  try {
    // Check if page exists within this site
    const existing = await prisma.page.findFirst({
      where: { id, siteId },
    });

    if (!existing) {
      return c.json({ error: 'Page not found' }, 404);
    }

    // Check slug uniqueness within site if changing
    if (data.slug && data.slug !== existing.slug) {
      const slugExists = await prisma.page.findUnique({
        where: {
          siteId_slug: { siteId, slug: data.slug },
        },
      });

      if (slugExists) {
        return c.json({
          error: 'Page with this slug already exists',
          code: 'SLUG_EXISTS',
        }, 400);
      }
    }

    // Prepare update data
    const updateData: any = { ...data };
    if (data.sections) {
      updateData.sections = JSON.stringify(data.sections);
    }

    // Update page
    const page = await prisma.page.update({
      where: { id },
      data: updateData,
      include: {
        author: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
    });

    return c.json({
      message: 'Page updated successfully',
      page: {
        ...page,
        sections: JSON.parse(page.sections),
      },
    });
  } catch (error) {
    console.error('Update page error:', error);
    return c.json({ error: 'Failed to update page' }, 500);
  }
});

/**
 * DELETE /api/admin/pages/:id
 * Delete page
 */
pages.delete('/:id', async (c) => {
  const id = parseInt(c.req.param('id'), 10);
  const siteId = c.get('siteId');

  if (isNaN(id)) {
    return c.json({ error: 'Invalid page ID' }, 400);
  }

  try {
    const page = await prisma.page.findFirst({
      where: { id, siteId },
    });

    if (!page) {
      return c.json({ error: 'Page not found' }, 404);
    }

    await prisma.page.delete({
      where: { id },
    });

    return c.json({ message: 'Page deleted successfully' });
  } catch (error) {
    console.error('Delete page error:', error);
    return c.json({ error: 'Failed to delete page' }, 500);
  }
});

/**
 * POST /api/admin/pages/:id/publish
 * Publish page
 */
pages.post('/:id/publish', async (c) => {
  const id = parseInt(c.req.param('id'), 10);
  const siteId = c.get('siteId');

  if (isNaN(id)) {
    return c.json({ error: 'Invalid page ID' }, 400);
  }

  try {
    const page = await prisma.page.findFirst({
      where: { id, siteId },
    });

    if (!page) {
      return c.json({ error: 'Page not found' }, 404);
    }

    if (page.status === 'published') {
      return c.json({ error: 'Page is already published' }, 400);
    }

    const updated = await prisma.page.update({
      where: { id },
      data: {
        status: 'published',
        publishedAt: new Date(),
      },
    });

    return c.json({
      message: 'Page published successfully',
      page: {
        ...updated,
        sections: JSON.parse(updated.sections),
      },
    });
  } catch (error) {
    console.error('Publish page error:', error);
    return c.json({ error: 'Failed to publish page' }, 500);
  }
});

/**
 * POST /api/admin/pages/:id/unpublish
 * Unpublish page (set to draft)
 */
pages.post('/:id/unpublish', async (c) => {
  const id = parseInt(c.req.param('id'), 10);
  const siteId = c.get('siteId');

  if (isNaN(id)) {
    return c.json({ error: 'Invalid page ID' }, 400);
  }

  try {
    const page = await prisma.page.findFirst({
      where: { id, siteId },
    });

    if (!page) {
      return c.json({ error: 'Page not found' }, 404);
    }

    if (page.status === 'draft') {
      return c.json({ error: 'Page is already a draft' }, 400);
    }

    const updated = await prisma.page.update({
      where: { id },
      data: {
        status: 'draft',
      },
    });

    return c.json({
      message: 'Page unpublished successfully',
      page: {
        ...updated,
        sections: JSON.parse(updated.sections),
      },
    });
  } catch (error) {
    console.error('Unpublish page error:', error);
    return c.json({ error: 'Failed to unpublish page' }, 500);
  }
});

/**
 * POST /api/admin/pages/:id/duplicate
 * Duplicate page
 */
pages.post('/:id/duplicate', async (c) => {
  const id = parseInt(c.req.param('id'), 10);
  const user = c.get('user');
  const siteId = c.get('siteId');

  if (isNaN(id)) {
    return c.json({ error: 'Invalid page ID' }, 400);
  }

  try {
    const original = await prisma.page.findFirst({
      where: { id, siteId },
    });

    if (!original) {
      return c.json({ error: 'Page not found' }, 404);
    }

    // Generate unique slug within site
    let newSlug = `${original.slug}-copy`;
    let counter = 1;

    while (await prisma.page.findUnique({ where: { siteId_slug: { siteId, slug: newSlug } } })) {
      newSlug = `${original.slug}-copy-${counter}`;
      counter++;
    }

    // Create duplicate with siteId
    const duplicate = await prisma.page.create({
      data: {
        slug: newSlug,
        title: `${original.title} (Copy)`,
        description: original.description,
        sections: original.sections,
        headerConfig: original.headerConfig,
        footerConfig: original.footerConfig,
        hideHeader: original.hideHeader,
        hideFooter: original.hideFooter,
        metaTitle: original.metaTitle,
        metaDescription: original.metaDescription,
        ogImage: original.ogImage,
        canonicalUrl: null, // Don't duplicate canonical URL
        noindex: true, // Set noindex for duplicate
        prerender: original.prerender,
        status: 'draft', // Always start as draft
        authorId: user.id,
        siteId,
      },
      include: {
        author: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
    });

    return c.json({
      message: 'Page duplicated successfully',
      page: {
        ...duplicate,
        sections: JSON.parse(duplicate.sections),
      },
    }, 201);
  } catch (error) {
    console.error('Duplicate page error:', error);
    return c.json({ error: 'Failed to duplicate page' }, 500);
  }
});

/**
 * GET /api/admin/pages/tree
 * Get hierarchical tree of pages
 */
pages.get('/tree', async (c) => {
  const siteId = c.get('siteId');

  try {
    // Get all pages for this site
    const allPages = await prisma.page.findMany({
      where: { siteId },
      orderBy: [{ level: 'asc' }, { order: 'asc' }, { title: 'asc' }],
      select: {
        id: true,
        slug: true,
        title: true,
        status: true,
        parentId: true,
        level: true,
        order: true,
        path: true,
        tags: {
          select: {
            tag: {
              select: {
                id: true,
                name: true,
                slug: true,
                color: true,
              },
            },
          },
        },
      },
    });

    // Build tree structure
    interface TreeNode {
      id: number;
      slug: string;
      title: string;
      status: string;
      parentId: number | null;
      level: number;
      order: number;
      path: string | null;
      tags: Array<{ id: number; name: string; slug: string; color: string | null }>;
      children: TreeNode[];
    }

    const pageMap = new Map<number, TreeNode>();
    const rootPages: TreeNode[] = [];

    // First pass: create all nodes
    for (const page of allPages) {
      const node: TreeNode = {
        ...page,
        tags: page.tags.map((pt: typeof page.tags[0]) => pt.tag),
        children: [],
      };
      pageMap.set(page.id, node);
    }

    // Second pass: build hierarchy
    for (const page of allPages) {
      const node = pageMap.get(page.id)!;
      if (page.parentId && pageMap.has(page.parentId)) {
        const parent = pageMap.get(page.parentId)!;
        parent.children.push(node);
      } else {
        rootPages.push(node);
      }
    }

    return c.json({
      tree: rootPages,
      total: allPages.length,
    });
  } catch (error) {
    console.error('Get pages tree error:', error);
    return c.json({ error: 'Failed to get pages tree' }, 500);
  }
});

/**
 * PUT /api/admin/pages/:id/tags
 * Update page tags
 */
pages.put('/:id/tags', zValidator('json', updatePageTagsSchema), async (c) => {
  const id = parseInt(c.req.param('id'), 10);
  const { tagIds } = c.req.valid('json');
  const siteId = c.get('siteId');

  if (isNaN(id)) {
    return c.json({ error: 'Invalid page ID' }, 400);
  }

  try {
    // Verify page exists and belongs to site
    const page = await prisma.page.findFirst({
      where: { id, siteId },
    });

    if (!page) {
      return c.json({ error: 'Page not found' }, 404);
    }

    // Verify all tags belong to the same site
    if (tagIds.length > 0) {
      const validTags = await prisma.tag.findMany({
        where: {
          id: { in: tagIds },
          siteId,
        },
      });

      if (validTags.length !== tagIds.length) {
        return c.json({ error: 'One or more tags not found or belong to different site' }, 400);
      }
    }

    // Update tags: delete existing and create new
    await prisma.$transaction([
      // Delete existing page tags
      prisma.pageTag.deleteMany({
        where: { pageId: id },
      }),
      // Create new page tags
      ...tagIds.map((tagId: number) =>
        prisma.pageTag.create({
          data: {
            pageId: id,
            tagId,
          },
        })
      ),
    ]);

    // Fetch updated page with tags
    const updatedPage = await prisma.page.findUnique({
      where: { id },
      select: {
        id: true,
        title: true,
        slug: true,
        tags: {
          select: {
            tag: {
              select: {
                id: true,
                name: true,
                slug: true,
                color: true,
              },
            },
          },
        },
      },
    });

    return c.json({
      message: 'Page tags updated successfully',
      page: {
        ...updatedPage,
        tags: updatedPage?.tags.map((pt: any) => pt.tag) || [],
      },
    });
  } catch (error) {
    console.error('Update page tags error:', error);
    return c.json({ error: 'Failed to update page tags' }, 500);
  }
});

/**
 * PUT /api/admin/pages/:id/parent
 * Update page parent (move in hierarchy)
 */
pages.put('/:id/parent', async (c) => {
  const id = parseInt(c.req.param('id'), 10);
  const siteId = c.get('siteId');

  if (isNaN(id)) {
    return c.json({ error: 'Invalid page ID' }, 400);
  }

  try {
    const body = await c.req.json();
    const { parentId, order } = body;

    // Verify page exists
    const page = await prisma.page.findFirst({
      where: { id, siteId },
    });

    if (!page) {
      return c.json({ error: 'Page not found' }, 404);
    }

    // Verify parent exists and get its level
    let newLevel = 0;
    let newPath = `/${page.slug}`;

    if (parentId !== null && parentId !== undefined) {
      const parent = await prisma.page.findFirst({
        where: { id: parentId, siteId },
      });

      if (!parent) {
        return c.json({ error: 'Parent page not found' }, 404);
      }

      // Check max nesting level (3 levels max: 0, 1, 2)
      if (parent.level >= 2) {
        return c.json({ error: 'Maximum nesting level is 3' }, 400);
      }

      // Prevent circular reference
      if (parentId === id) {
        return c.json({ error: 'Page cannot be its own parent' }, 400);
      }

      // Check if the new parent is a descendant of this page
      let currentParent = parent;
      while (currentParent.parentId) {
        if (currentParent.parentId === id) {
          return c.json({ error: 'Cannot move page under its own descendant' }, 400);
        }
        const nextParent = await prisma.page.findFirst({
          where: { id: currentParent.parentId, siteId },
        });
        if (!nextParent) break;
        currentParent = nextParent;
      }

      newLevel = parent.level + 1;
      newPath = `${parent.path || '/' + parent.slug}/${page.slug}`;
    }

    // Update page
    const updatedPage = await prisma.page.update({
      where: { id },
      data: {
        parentId: parentId ?? null,
        level: newLevel,
        path: newPath,
        order: order ?? page.order,
      },
    });

    // Update children paths recursively
    await updateChildrenPaths(id, newPath, siteId);

    return c.json({
      message: 'Page parent updated successfully',
      page: updatedPage,
    });
  } catch (error) {
    console.error('Update page parent error:', error);
    return c.json({ error: 'Failed to update page parent' }, 500);
  }
});

/**
 * Helper: Update children paths recursively
 */
async function updateChildrenPaths(pageId: number, parentPath: string, siteId: number): Promise<void> {
  const children = await prisma.page.findMany({
    where: { parentId: pageId, siteId },
  });

  for (const child of children) {
    const newPath = `${parentPath}/${child.slug}`;
    await prisma.page.update({
      where: { id: child.id },
      data: {
        path: newPath,
        level: (parentPath.split('/').length - 1) + 1,
      },
    });
    // Recursively update grandchildren
    await updateChildrenPaths(child.id, newPath, siteId);
  }
}

/**
 * PUT /api/admin/pages/:id/order
 * Update page order within siblings
 */
pages.put('/:id/order', async (c) => {
  const id = parseInt(c.req.param('id'), 10);
  const siteId = c.get('siteId');

  if (isNaN(id)) {
    return c.json({ error: 'Invalid page ID' }, 400);
  }

  try {
    const body = await c.req.json();
    const { order } = body;

    if (typeof order !== 'number') {
      return c.json({ error: 'Order must be a number' }, 400);
    }

    const page = await prisma.page.findFirst({
      where: { id, siteId },
    });

    if (!page) {
      return c.json({ error: 'Page not found' }, 404);
    }

    await prisma.page.update({
      where: { id },
      data: { order },
    });

    return c.json({ message: 'Page order updated successfully' });
  } catch (error) {
    console.error('Update page order error:', error);
    return c.json({ error: 'Failed to update page order' }, 500);
  }
});

export default pages;
