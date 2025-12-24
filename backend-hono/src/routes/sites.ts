/**
 * Sites API - Multisite management
 *
 * Endpoints:
 * GET    /api/admin/sites         - List user's sites
 * POST   /api/admin/sites         - Create site
 * GET    /api/admin/sites/:id     - Get site
 * PUT    /api/admin/sites/:id     - Update site
 * DELETE /api/admin/sites/:id     - Delete site
 * POST   /api/admin/sites/:id/switch - Switch current site
 */

import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { z } from 'zod';
import { prisma } from '../lib/db.js';
import { authMiddleware, adminOnly } from '../middleware/auth.js';

const sites = new Hono();

// Apply auth middleware to all routes
sites.use('*', authMiddleware);

// ==========================================
// VALIDATION SCHEMAS
// ==========================================

const createSiteSchema = z.object({
  name: z.string().min(1, 'Name is required').max(100),
  slug: z.string().min(1).max(50).regex(/^[a-z0-9-]+$/, 'Slug must be lowercase alphanumeric with dashes'),
  domain: z.string().optional().nullable(),
  subdomain: z.string().optional().nullable(),
  settings: z.record(z.string(), z.any()).optional().default({}),
});

const updateSiteSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  slug: z.string().min(1).max(50).regex(/^[a-z0-9-]+$/).optional(),
  domain: z.string().optional().nullable(),
  subdomain: z.string().optional().nullable(),
  settings: z.record(z.string(), z.any()).optional(),
  isActive: z.boolean().optional(),
});

// ==========================================
// ROUTES
// ==========================================

/**
 * GET /api/admin/sites/accessible - List sites user has access to
 * Phase 3: Returns sites based on ownership, UserSite, or superadmin status
 */
sites.get('/accessible', async (c) => {
  const user = c.get('user');

  try {
    let accessibleSites;

    if (user.isSuperadmin) {
      // Superadmin sees all active sites
      accessibleSites = await prisma.site.findMany({
        where: { isActive: true },
        select: {
          id: true,
          name: true,
          slug: true,
          domain: true,
          subdomain: true,
        },
        orderBy: { name: 'asc' },
      });
    } else {
      // Regular users: owned sites + sites via UserSite
      accessibleSites = await prisma.site.findMany({
        where: {
          isActive: true,
          OR: [
            { ownerId: user.id },
            { userSites: { some: { userId: user.id } } },
          ],
        },
        select: {
          id: true,
          name: true,
          slug: true,
          domain: true,
          subdomain: true,
        },
        orderBy: { name: 'asc' },
      });
    }

    return c.json({
      sites: accessibleSites,
      total: accessibleSites.length,
    });
  } catch (error) {
    console.error('Error listing accessible sites:', error);
    return c.json({ error: 'Failed to list accessible sites' }, 500);
  }
});

/**
 * GET /api/admin/sites - List user's sites
 */
sites.get('/', async (c) => {
  const user = c.get('user');

  try {
    // Superadmins can see all sites, others only their owned sites
    const whereClause = user.isSuperadmin ? {} : { ownerId: user.id };

    const allSites = await prisma.site.findMany({
      where: whereClause,
      include: {
        owner: {
          select: { id: true, email: true, name: true },
        },
        _count: {
          select: {
            pages: true,
            media: true,
            menus: true,
            reusableBlocks: true,
            tags: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    return c.json({
      sites: allSites.map((site: typeof allSites[0]) => ({
        ...site,
        settings: JSON.parse(site.settings),
      })),
      total: allSites.length,
    });
  } catch (error) {
    console.error('Error listing sites:', error);
    return c.json({ error: 'Failed to list sites' }, 500);
  }
});

/**
 * POST /api/admin/sites - Create site
 */
sites.post('/', zValidator('json', createSiteSchema), async (c) => {
  const user = c.get('user');
  const data = c.req.valid('json');

  try {
    // Check slug uniqueness
    const existingSlug = await prisma.site.findUnique({
      where: { slug: data.slug },
    });
    if (existingSlug) {
      return c.json({ error: 'Site with this slug already exists' }, 400);
    }

    // Check domain uniqueness if provided
    if (data.domain) {
      const existingDomain = await prisma.site.findUnique({
        where: { domain: data.domain },
      });
      if (existingDomain) {
        return c.json({ error: 'Site with this domain already exists' }, 400);
      }
    }

    // Check subdomain uniqueness if provided
    if (data.subdomain) {
      const existingSubdomain = await prisma.site.findUnique({
        where: { subdomain: data.subdomain },
      });
      if (existingSubdomain) {
        return c.json({ error: 'Site with this subdomain already exists' }, 400);
      }
    }

    const site = await prisma.site.create({
      data: {
        name: data.name,
        slug: data.slug,
        domain: data.domain || null,
        subdomain: data.subdomain || null,
        settings: JSON.stringify(data.settings),
        ownerId: user.id,
      },
      include: {
        owner: {
          select: { id: true, email: true, name: true },
        },
      },
    });

    // Create default menus for the new site
    await prisma.menu.createMany({
      data: [
        {
          name: 'Header Menu',
          slug: 'header',
          location: 'header',
          items: '[]',
          siteId: site.id,
        },
        {
          name: 'Footer Menu',
          slug: 'footer',
          location: 'footer',
          items: '[]',
          siteId: site.id,
        },
      ],
    });

    return c.json(
      {
        site: {
          ...site,
          settings: JSON.parse(site.settings),
        },
        message: 'Site created successfully',
      },
      201
    );
  } catch (error) {
    console.error('Error creating site:', error);
    return c.json({ error: 'Failed to create site' }, 500);
  }
});

/**
 * GET /api/admin/sites/:id - Get site details
 */
sites.get('/:id', async (c) => {
  const user = c.get('user');
  const id = parseInt(c.req.param('id'));

  if (isNaN(id)) {
    return c.json({ error: 'Invalid site ID' }, 400);
  }

  try {
    const site = await prisma.site.findUnique({
      where: { id },
      include: {
        owner: {
          select: { id: true, email: true, name: true },
        },
        _count: {
          select: {
            pages: true,
            media: true,
            menus: true,
            reusableBlocks: true,
            tags: true,
          },
        },
      },
    });

    if (!site) {
      return c.json({ error: 'Site not found' }, 404);
    }

    // Check access (superadmin, owner, or via UserSite)
    const hasAccess = user.isSuperadmin ||
      site.ownerId === user.id ||
      await prisma.userSite.findUnique({
        where: { userId_siteId: { userId: user.id, siteId: id } },
      });

    if (!hasAccess) {
      return c.json({ error: 'Access denied' }, 403);
    }

    return c.json({
      site: {
        ...site,
        settings: JSON.parse(site.settings),
      },
    });
  } catch (error) {
    console.error('Error getting site:', error);
    return c.json({ error: 'Failed to get site' }, 500);
  }
});

/**
 * PUT /api/admin/sites/:id - Update site
 */
sites.put('/:id', zValidator('json', updateSiteSchema), async (c) => {
  const user = c.get('user');
  const id = parseInt(c.req.param('id'));
  const data = c.req.valid('json');

  if (isNaN(id)) {
    return c.json({ error: 'Invalid site ID' }, 400);
  }

  try {
    const existingSite = await prisma.site.findUnique({
      where: { id },
    });

    if (!existingSite) {
      return c.json({ error: 'Site not found' }, 404);
    }

    // Check access (superadmin or owner only - UserSite users cannot update site)
    if (!user.isSuperadmin && existingSite.ownerId !== user.id) {
      return c.json({ error: 'Access denied' }, 403);
    }

    // Check slug uniqueness if changing
    if (data.slug && data.slug !== existingSite.slug) {
      const slugExists = await prisma.site.findUnique({
        where: { slug: data.slug },
      });
      if (slugExists) {
        return c.json({ error: 'Site with this slug already exists' }, 400);
      }
    }

    // Check domain uniqueness if changing
    if (data.domain && data.domain !== existingSite.domain) {
      const domainExists = await prisma.site.findUnique({
        where: { domain: data.domain },
      });
      if (domainExists) {
        return c.json({ error: 'Site with this domain already exists' }, 400);
      }
    }

    const updateData: any = {};
    if (data.name !== undefined) updateData.name = data.name;
    if (data.slug !== undefined) updateData.slug = data.slug;
    if (data.domain !== undefined) updateData.domain = data.domain;
    if (data.subdomain !== undefined) updateData.subdomain = data.subdomain;
    if (data.isActive !== undefined) updateData.isActive = data.isActive;
    if (data.settings !== undefined) {
      // Merge settings
      const existingSettings = JSON.parse(existingSite.settings);
      updateData.settings = JSON.stringify({ ...existingSettings, ...data.settings });
    }

    const site = await prisma.site.update({
      where: { id },
      data: updateData,
      include: {
        owner: {
          select: { id: true, email: true, name: true },
        },
      },
    });

    return c.json({
      site: {
        ...site,
        settings: JSON.parse(site.settings),
      },
    });
  } catch (error) {
    console.error('Error updating site:', error);
    return c.json({ error: 'Failed to update site' }, 500);
  }
});

/**
 * DELETE /api/admin/sites/:id - Delete site
 */
sites.delete('/:id', async (c) => {
  const user = c.get('user');
  const id = parseInt(c.req.param('id'));

  if (isNaN(id)) {
    return c.json({ error: 'Invalid site ID' }, 400);
  }

  try {
    const site = await prisma.site.findUnique({
      where: { id },
      include: {
        _count: {
          select: { pages: true },
        },
      },
    });

    if (!site) {
      return c.json({ error: 'Site not found' }, 404);
    }

    // Only superadmin or owner can delete
    if (!user.isSuperadmin && site.ownerId !== user.id) {
      return c.json({ error: 'Access denied' }, 403);
    }

    // Warning if site has content
    if (site._count.pages > 0) {
      const forceDelete = c.req.query('force') === 'true';
      if (!forceDelete) {
        return c.json(
          {
            error: 'Site has content',
            message: `This site has ${site._count.pages} pages. Add ?force=true to delete anyway.`,
          },
          400
        );
      }
    }

    // Delete site (cascades to pages, media folders, menus, etc.)
    await prisma.site.delete({
      where: { id },
    });

    return c.json({ message: 'Site deleted successfully' });
  } catch (error) {
    console.error('Error deleting site:', error);
    return c.json({ error: 'Failed to delete site' }, 500);
  }
});

/**
 * POST /api/admin/sites/:id/switch - Switch current site context
 * This sets a cookie/header for subsequent requests
 */
sites.post('/:id/switch', async (c) => {
  const user = c.get('user');
  const id = parseInt(c.req.param('id'));

  if (isNaN(id)) {
    return c.json({ error: 'Invalid site ID' }, 400);
  }

  try {
    const site = await prisma.site.findUnique({
      where: { id },
    });

    if (!site) {
      return c.json({ error: 'Site not found' }, 404);
    }

    // Check access (superadmin, owner, or via UserSite)
    const hasAccess = user.isSuperadmin ||
      site.ownerId === user.id ||
      await prisma.userSite.findUnique({
        where: { userId_siteId: { userId: user.id, siteId: id } },
      });

    if (!hasAccess) {
      return c.json({ error: 'Access denied' }, 403);
    }

    if (!site.isActive) {
      return c.json({ error: 'Site is not active' }, 400);
    }

    // Return the site ID to be stored client-side
    return c.json({
      message: 'Switched to site',
      site: {
        id: site.id,
        name: site.name,
        slug: site.slug,
      },
    });
  } catch (error) {
    console.error('Error switching site:', error);
    return c.json({ error: 'Failed to switch site' }, 500);
  }
});

export default sites;
