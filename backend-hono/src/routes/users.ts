/**
 * Users API Routes - Phase 3
 *
 * User management endpoints for superadmins.
 *
 * Endpoints:
 * GET    /api/admin/users                - List all users
 * GET    /api/admin/users/sections       - Get available sections
 * GET    /api/admin/users/me/permissions - Get current user's permissions for site
 * GET    /api/admin/users/:id            - Get user details
 * POST   /api/admin/users                - Create new user
 * PUT    /api/admin/users/:id            - Update user
 * DELETE /api/admin/users/:id            - Delete user
 * POST   /api/admin/users/:id/sites      - Assign sites to user
 * DELETE /api/admin/users/:id/sites/:siteId - Remove site access
 * PUT    /api/admin/users/:id/sites/:siteId/permissions - Update permissions
 */

import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { z } from 'zod';
import bcrypt from 'bcryptjs';
import { prisma } from '../lib/db.js';
import { authMiddleware, superadminOnly } from '../middleware/auth.js';
import { siteMiddleware } from '../middleware/site.js';
import {
  DEFAULT_PERMISSIONS,
  FULL_PERMISSIONS,
  ADMIN_SECTIONS,
} from '../lib/permissions.js';

const users = new Hono();

// ===========================================
// VALIDATION SCHEMAS
// ===========================================

const createUserSchema = z.object({
  email: z.string().email('Invalid email'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
  name: z.string().optional(),
  role: z.enum(['admin', 'editor', 'viewer']).default('editor'),
  isSuperadmin: z.boolean().default(false),
});

const updateUserSchema = z.object({
  email: z.string().email('Invalid email').optional(),
  name: z.string().optional(),
  password: z.string().min(8).optional(),
  role: z.enum(['admin', 'editor', 'viewer']).optional(),
  isActive: z.boolean().optional(),
  isSuperadmin: z.boolean().optional(),
});

const assignSitesSchema = z.object({
  siteIds: z.array(z.number()),
  permissions: z.record(z.string(), z.boolean()).optional(),
});

const updatePermissionsSchema = z.object({
  permissions: z.record(z.string(), z.boolean()),
});

// ===========================================
// PUBLIC ROUTES (require auth only)
// ===========================================

/**
 * GET /api/admin/users/me/permissions
 * Get current user's permissions for current site
 * Does NOT require superadmin - available to all authenticated users
 */
users.get('/me/permissions', authMiddleware, siteMiddleware, async (c) => {
  const user = c.get('user');
  const site = c.get('site');

  if (!site) {
    return c.json({ error: 'No site context' }, 400);
  }

  // Superadmin has all permissions
  if (user.isSuperadmin) {
    return c.json({
      isSuperadmin: true,
      isSiteOwner: false,
      permissions: FULL_PERMISSIONS,
      sections: ADMIN_SECTIONS,
    });
  }

  // Site owner has all permissions
  if (site.ownerId === user.id) {
    return c.json({
      isSuperadmin: false,
      isSiteOwner: true,
      permissions: FULL_PERMISSIONS,
      sections: ADMIN_SECTIONS,
    });
  }

  // Regular user - check UserSite
  const userSite = await prisma.userSite.findUnique({
    where: {
      userId_siteId: { userId: user.id, siteId: site.id },
    },
  });

  if (!userSite) {
    return c.json({
      isSuperadmin: false,
      isSiteOwner: false,
      permissions: {},
      sections: ADMIN_SECTIONS,
    });
  }

  let permissions = {};
  try {
    permissions = JSON.parse(userSite.permissions || '{}');
  } catch {
    permissions = {};
  }

  return c.json({
    isSuperadmin: false,
    isSiteOwner: false,
    permissions,
    sections: ADMIN_SECTIONS,
  });
});

/**
 * GET /api/admin/users/sections
 * Get available admin sections
 * Does NOT require superadmin
 */
users.get('/sections', authMiddleware, async (c) => {
  return c.json({ sections: ADMIN_SECTIONS });
});

// ===========================================
// SUPERADMIN ROUTES
// ===========================================

// Apply superadmin middleware to all routes below
users.use('/*', authMiddleware);

/**
 * GET /api/admin/users
 * List all users (superadmin only)
 */
users.get('/', superadminOnly, async (c) => {
  const users = await prisma.user.findMany({
    select: {
      id: true,
      email: true,
      name: true,
      role: true,
      isSuperadmin: true,
      isActive: true,
      createdAt: true,
      _count: {
        select: {
          ownedSites: true,
          userSites: true,
        },
      },
    },
    orderBy: { createdAt: 'desc' },
  });

  return c.json({ users });
});

/**
 * GET /api/admin/users/:id
 * Get user details (superadmin only)
 */
users.get('/:id', superadminOnly, async (c) => {
  const id = parseInt(c.req.param('id'));

  if (isNaN(id)) {
    return c.json({ error: 'Invalid user ID' }, 400);
  }

  const user = await prisma.user.findUnique({
    where: { id },
    select: {
      id: true,
      email: true,
      name: true,
      role: true,
      isSuperadmin: true,
      isActive: true,
      createdAt: true,
      ownedSites: {
        select: { id: true, name: true, slug: true },
      },
      userSites: {
        select: {
          id: true,
          permissions: true,
          site: {
            select: { id: true, name: true, slug: true },
          },
        },
      },
    },
  });

  if (!user) {
    return c.json({ error: 'User not found' }, 404);
  }

  return c.json({ user });
});

/**
 * POST /api/admin/users
 * Create new user (superadmin only)
 */
users.post('/', superadminOnly, zValidator('json', createUserSchema), async (c) => {
  const data = c.req.valid('json');

  // Check if email already exists
  const existing = await prisma.user.findUnique({
    where: { email: data.email },
  });

  if (existing) {
    return c.json({ error: 'Email already exists' }, 400);
  }

  // Hash password
  const hashedPassword = await bcrypt.hash(data.password, 12);

  // Create user
  const user = await prisma.user.create({
    data: {
      email: data.email,
      password: hashedPassword,
      name: data.name,
      role: data.role,
      isSuperadmin: data.isSuperadmin,
    },
    select: {
      id: true,
      email: true,
      name: true,
      role: true,
      isSuperadmin: true,
      isActive: true,
      createdAt: true,
    },
  });

  return c.json({ user }, 201);
});

/**
 * PUT /api/admin/users/:id
 * Update user (superadmin only)
 */
users.put('/:id', superadminOnly, zValidator('json', updateUserSchema), async (c) => {
  const id = parseInt(c.req.param('id'));
  const currentUser = c.get('user');
  const data = c.req.valid('json');

  if (isNaN(id)) {
    return c.json({ error: 'Invalid user ID' }, 400);
  }

  // Cannot modify yourself
  if (id === currentUser.id) {
    return c.json({ error: 'Cannot modify your own account via this endpoint' }, 400);
  }

  // Get target user
  const target = await prisma.user.findUnique({ where: { id } });
  if (!target) {
    return c.json({ error: 'User not found' }, 404);
  }

  // Protection: Cannot disable/demote the last superadmin
  if ((data.isSuperadmin === false || data.isActive === false) && target.isSuperadmin) {
    const superadminCount = await prisma.user.count({
      where: { isSuperadmin: true, isActive: true },
    });
    if (superadminCount <= 1) {
      return c.json({ error: 'Cannot disable the last superadmin' }, 400);
    }
  }

  // If disabling user, invalidate all their sessions
  if (data.isActive === false && target.isActive === true) {
    await prisma.session.deleteMany({ where: { userId: id } });
  }

  // If changing password, hash it
  const updateData: any = { ...data };
  if (data.password) {
    updateData.password = await bcrypt.hash(data.password, 12);
  }

  const user = await prisma.user.update({
    where: { id },
    data: updateData,
    select: {
      id: true,
      email: true,
      name: true,
      role: true,
      isSuperadmin: true,
      isActive: true,
    },
  });

  return c.json({ user });
});

/**
 * DELETE /api/admin/users/:id
 * Delete user (superadmin only)
 */
users.delete('/:id', superadminOnly, async (c) => {
  const id = parseInt(c.req.param('id'));
  const currentUser = c.get('user');

  if (isNaN(id)) {
    return c.json({ error: 'Invalid user ID' }, 400);
  }

  // Cannot delete yourself
  if (id === currentUser.id) {
    return c.json({ error: 'Cannot delete your own account' }, 400);
  }

  // Get target user
  const target = await prisma.user.findUnique({ where: { id } });
  if (!target) {
    return c.json({ error: 'User not found' }, 404);
  }

  // Protection: Cannot delete the last superadmin
  if (target.isSuperadmin) {
    const count = await prisma.user.count({
      where: { isSuperadmin: true },
    });
    if (count <= 1) {
      return c.json({ error: 'Cannot delete the last superadmin' }, 400);
    }
  }

  await prisma.user.delete({ where: { id } });

  return c.json({ message: 'User deleted' });
});

/**
 * POST /api/admin/users/:id/sites
 * Assign sites to user (superadmin only)
 */
users.post('/:id/sites', superadminOnly, zValidator('json', assignSitesSchema), async (c) => {
  const userId = parseInt(c.req.param('id'));
  const { siteIds, permissions } = c.req.valid('json');

  if (isNaN(userId)) {
    return c.json({ error: 'Invalid user ID' }, 400);
  }

  // Verify user exists
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) {
    return c.json({ error: 'User not found' }, 404);
  }

  const permissionsJson = JSON.stringify(permissions || DEFAULT_PERMISSIONS);

  // Create/update UserSite records
  const results = await Promise.all(
    siteIds.map((siteId) =>
      prisma.userSite.upsert({
        where: { userId_siteId: { userId, siteId } },
        create: { userId, siteId, permissions: permissionsJson },
        update: { permissions: permissionsJson },
      })
    )
  );

  return c.json({
    message: 'Sites assigned',
    count: results.length,
  });
});

/**
 * DELETE /api/admin/users/:id/sites/:siteId
 * Remove site access from user (superadmin only)
 */
users.delete('/:id/sites/:siteId', superadminOnly, async (c) => {
  const userId = parseInt(c.req.param('id'));
  const siteId = parseInt(c.req.param('siteId'));

  if (isNaN(userId) || isNaN(siteId)) {
    return c.json({ error: 'Invalid ID' }, 400);
  }

  try {
    await prisma.userSite.delete({
      where: { userId_siteId: { userId, siteId } },
    });
  } catch {
    // Ignore if not exists
  }

  return c.json({ message: 'Site access removed' });
});

/**
 * PUT /api/admin/users/:id/sites/:siteId/permissions
 * Update user's permissions for a site (superadmin only)
 */
users.put(
  '/:id/sites/:siteId/permissions',
  superadminOnly,
  zValidator('json', updatePermissionsSchema),
  async (c) => {
    const userId = parseInt(c.req.param('id'));
    const siteId = parseInt(c.req.param('siteId'));
    const { permissions } = c.req.valid('json');

    if (isNaN(userId) || isNaN(siteId)) {
      return c.json({ error: 'Invalid ID' }, 400);
    }

    try {
      const userSite = await prisma.userSite.update({
        where: { userId_siteId: { userId, siteId } },
        data: { permissions: JSON.stringify(permissions) },
      });

      return c.json({ userSite });
    } catch {
      return c.json({ error: 'UserSite not found' }, 404);
    }
  }
);

export default users;
