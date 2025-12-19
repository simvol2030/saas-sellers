/**
 * Menus API - Site navigation management
 *
 * Endpoints:
 * GET    /api/admin/menus           - List menus
 * POST   /api/admin/menus           - Create menu
 * GET    /api/admin/menus/:id       - Get menu
 * PUT    /api/admin/menus/:id       - Update menu
 * DELETE /api/admin/menus/:id       - Delete menu
 * GET    /api/menus/:slug           - Public: get menu by slug
 */

import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { z } from 'zod';
import { prisma } from '../lib/db.js';
import { authMiddleware, editorOrAdmin } from '../middleware/auth.js';
import { siteMiddleware, requireSite, publicSiteMiddleware } from '../middleware/site.js';

const menus = new Hono();

// ==========================================
// VALIDATION SCHEMAS
// ==========================================

const menuItemSchema: z.ZodType<any> = z.lazy(() =>
  z.object({
    id: z.string(),
    label: z.string().min(1, 'Label is required'),
    href: z.string(),
    target: z.enum(['_blank', '_self']).optional(),
    icon: z.string().optional(),
    pageId: z.number().optional(),
    children: z.array(menuItemSchema).optional(),
  })
);

const createMenuSchema = z.object({
  name: z.string().min(1, 'Name is required').max(100),
  slug: z.string().min(1).max(50).regex(/^[a-z0-9-]+$/, 'Slug must be lowercase alphanumeric with dashes'),
  location: z.enum(['header', 'footer', 'sidebar']).default('header'),
  items: z.array(menuItemSchema).default([]),
});

const updateMenuSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  slug: z.string().min(1).max(50).regex(/^[a-z0-9-]+$/).optional(),
  location: z.enum(['header', 'footer', 'sidebar']).optional(),
  items: z.array(menuItemSchema).optional(),
});

// ==========================================
// ADMIN ROUTES (require auth)
// ==========================================

/**
 * GET /api/admin/menus - List all menus for current site
 */
menus.get(
  '/',
  authMiddleware,
  editorOrAdmin,
  siteMiddleware,
  requireSite,
  async (c) => {
    const siteId = c.get('siteId');
    const location = c.req.query('location');

    try {
      const whereClause: any = { siteId };
      if (location) {
        whereClause.location = location;
      }

      const allMenus = await prisma.menu.findMany({
        where: whereClause,
        orderBy: [{ location: 'asc' }, { name: 'asc' }],
      });

      return c.json({
        menus: allMenus.map((menu: typeof allMenus[0]) => ({
          ...menu,
          items: JSON.parse(menu.items),
        })),
        total: allMenus.length,
      });
    } catch (error) {
      console.error('Error listing menus:', error);
      return c.json({ error: 'Failed to list menus' }, 500);
    }
  }
);

/**
 * POST /api/admin/menus - Create menu
 */
menus.post(
  '/',
  authMiddleware,
  editorOrAdmin,
  siteMiddleware,
  requireSite,
  zValidator('json', createMenuSchema),
  async (c) => {
    const siteId = c.get('siteId');
    const data = c.req.valid('json');

    try {
      // Check slug uniqueness within site
      const existingSlug = await prisma.menu.findUnique({
        where: {
          siteId_slug: {
            siteId,
            slug: data.slug,
          },
        },
      });

      if (existingSlug) {
        return c.json({ error: 'Menu with this slug already exists' }, 400);
      }

      const menu = await prisma.menu.create({
        data: {
          name: data.name,
          slug: data.slug,
          location: data.location,
          items: JSON.stringify(data.items),
          siteId,
        },
      });

      return c.json(
        {
          menu: {
            ...menu,
            items: JSON.parse(menu.items),
          },
        },
        201
      );
    } catch (error) {
      console.error('Error creating menu:', error);
      return c.json({ error: 'Failed to create menu' }, 500);
    }
  }
);

/**
 * GET /api/admin/menus/:id - Get menu details
 */
menus.get(
  '/:id',
  authMiddleware,
  editorOrAdmin,
  siteMiddleware,
  requireSite,
  async (c) => {
    const siteId = c.get('siteId');
    const id = parseInt(c.req.param('id'));

    if (isNaN(id)) {
      return c.json({ error: 'Invalid menu ID' }, 400);
    }

    try {
      const menu = await prisma.menu.findFirst({
        where: { id, siteId },
      });

      if (!menu) {
        return c.json({ error: 'Menu not found' }, 404);
      }

      // Resolve page links to current slugs (within same site)
      const items = JSON.parse(menu.items);
      const resolvedItems = await resolvePageLinks(items, siteId);

      return c.json({
        menu: {
          ...menu,
          items: resolvedItems,
        },
      });
    } catch (error) {
      console.error('Error getting menu:', error);
      return c.json({ error: 'Failed to get menu' }, 500);
    }
  }
);

/**
 * PUT /api/admin/menus/:id - Update menu
 */
menus.put(
  '/:id',
  authMiddleware,
  editorOrAdmin,
  siteMiddleware,
  requireSite,
  zValidator('json', updateMenuSchema),
  async (c) => {
    const siteId = c.get('siteId');
    const id = parseInt(c.req.param('id'));
    const data = c.req.valid('json');

    if (isNaN(id)) {
      return c.json({ error: 'Invalid menu ID' }, 400);
    }

    try {
      const existingMenu = await prisma.menu.findFirst({
        where: { id, siteId },
      });

      if (!existingMenu) {
        return c.json({ error: 'Menu not found' }, 404);
      }

      // Check slug uniqueness if changing
      if (data.slug && data.slug !== existingMenu.slug) {
        const slugExists = await prisma.menu.findUnique({
          where: {
            siteId_slug: {
              siteId,
              slug: data.slug,
            },
          },
        });

        if (slugExists) {
          return c.json({ error: 'Menu with this slug already exists' }, 400);
        }
      }

      const updateData: any = {};
      if (data.name !== undefined) updateData.name = data.name;
      if (data.slug !== undefined) updateData.slug = data.slug;
      if (data.location !== undefined) updateData.location = data.location;
      if (data.items !== undefined) updateData.items = JSON.stringify(data.items);

      const menu = await prisma.menu.update({
        where: { id },
        data: updateData,
      });

      return c.json({
        menu: {
          ...menu,
          items: JSON.parse(menu.items),
        },
      });
    } catch (error) {
      console.error('Error updating menu:', error);
      return c.json({ error: 'Failed to update menu' }, 500);
    }
  }
);

/**
 * DELETE /api/admin/menus/:id - Delete menu
 */
menus.delete(
  '/:id',
  authMiddleware,
  editorOrAdmin,
  siteMiddleware,
  requireSite,
  async (c) => {
    const siteId = c.get('siteId');
    const id = parseInt(c.req.param('id'));

    if (isNaN(id)) {
      return c.json({ error: 'Invalid menu ID' }, 400);
    }

    try {
      const menu = await prisma.menu.findFirst({
        where: { id, siteId },
      });

      if (!menu) {
        return c.json({ error: 'Menu not found' }, 404);
      }

      await prisma.menu.delete({
        where: { id },
      });

      return c.json({ message: 'Menu deleted successfully' });
    } catch (error) {
      console.error('Error deleting menu:', error);
      return c.json({ error: 'Failed to delete menu' }, 500);
    }
  }
);

// ==========================================
// PUBLIC ROUTES
// ==========================================

/**
 * GET /api/menus/:slug - Public: get menu by slug
 */
menus.get(
  '/public/:slug',
  publicSiteMiddleware,
  async (c) => {
    const siteId = c.get('siteId');
    const slug = c.req.param('slug');

    if (!siteId) {
      return c.json({ error: 'Site not found' }, 404);
    }

    try {
      const menu = await prisma.menu.findUnique({
        where: {
          siteId_slug: {
            siteId,
            slug,
          },
        },
      });

      if (!menu) {
        return c.json({ error: 'Menu not found' }, 404);
      }

      // Resolve page links and return items (within same site)
      const items = JSON.parse(menu.items);
      const resolvedItems = await resolvePageLinks(items, siteId);

      return c.json({
        name: menu.name,
        location: menu.location,
        items: resolvedItems,
      });
    } catch (error) {
      console.error('Error getting public menu:', error);
      return c.json({ error: 'Failed to get menu' }, 500);
    }
  }
);

// ==========================================
// HELPER FUNCTIONS
// ==========================================

/**
 * Resolve page IDs to current URLs
 * If a menu item has pageId, update its href to the page's current slug
 * Only resolves pages within the same site for security
 */
async function resolvePageLinks(items: any[], siteId: number): Promise<any[]> {
  const pageIds = extractPageIds(items);

  if (pageIds.length === 0) return items;

  // Filter by siteId to prevent cross-site data leaks
  const pages = await prisma.page.findMany({
    where: {
      id: { in: pageIds },
      siteId, // Security: only resolve pages from same site
    },
    select: { id: true, slug: true, path: true },
  });

  const pageMap = new Map<number, string>(pages.map((p: typeof pages[0]) => [p.id, p.path || `/${p.slug}`]));

  return updateItemHrefs(items, pageMap);
}

function extractPageIds(items: any[]): number[] {
  const ids: number[] = [];

  for (const item of items) {
    if (item.pageId) {
      ids.push(item.pageId);
    }
    if (item.children) {
      ids.push(...extractPageIds(item.children));
    }
  }

  return ids;
}

function updateItemHrefs(items: any[], pageMap: Map<number, string>): any[] {
  return items.map((item) => {
    const result = { ...item };

    if (item.pageId && pageMap.has(item.pageId)) {
      result.href = pageMap.get(item.pageId);
    }

    if (item.children) {
      result.children = updateItemHrefs(item.children, pageMap);
    }

    return result;
  });
}

export default menus;
