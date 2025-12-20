/**
 * Permission Middleware - Phase 3
 *
 * Provides section-based access control for admin routes.
 * Checks permissions in order:
 * 1. Superadmin - full access
 * 2. Site owner - full access to owned site
 * 3. UserSite permissions - specific section access
 */

import { Context, Next } from 'hono';
import { prisma } from '../lib/db.js';
import type { AdminSection } from '../lib/permissions.js';

/**
 * Require access to a specific admin section
 * Use after authMiddleware and siteMiddleware
 */
export const requireSection = (section: AdminSection) => {
  return async (c: Context, next: Next) => {
    const user = c.get('user');
    const site = c.get('site');

    if (!user) {
      return c.json({
        error: 'Authentication required',
        code: 'NO_USER',
      }, 401);
    }

    if (!site) {
      return c.json({
        error: 'No site context',
        code: 'NO_SITE',
      }, 400);
    }

    // 1. Superadmin - full access to everything
    if (user.isSuperadmin) {
      return next();
    }

    // 2. Site owner - full access to their site
    if (site.ownerId === user.id) {
      return next();
    }

    // 3. Check UserSite permissions
    const userSite = await prisma.userSite.findUnique({
      where: {
        userId_siteId: {
          userId: user.id,
          siteId: site.id,
        },
      },
    });

    if (!userSite) {
      return c.json({
        error: 'No access to this site',
        code: 'NO_SITE_ACCESS',
      }, 403);
    }

    // Parse permissions and check section access
    let permissions: Record<string, boolean> = {};
    try {
      permissions = JSON.parse(userSite.permissions || '{}');
    } catch {
      permissions = {};
    }

    if (!permissions[section]) {
      return c.json({
        error: 'Section access denied',
        code: 'SECTION_DENIED',
        section,
      }, 403);
    }

    return next();
  };
};

/**
 * Check if user has access to any section (for general admin access)
 * Use after authMiddleware and siteMiddleware
 */
export const requireAnySectionAccess = async (c: Context, next: Next) => {
  const user = c.get('user');
  const site = c.get('site');

  if (!user) {
    return c.json({
      error: 'Authentication required',
      code: 'NO_USER',
    }, 401);
  }

  if (!site) {
    return c.json({
      error: 'No site context',
      code: 'NO_SITE',
    }, 400);
  }

  // Superadmin or site owner - always has access
  if (user.isSuperadmin || site.ownerId === user.id) {
    return next();
  }

  // Check if user has any UserSite access
  const userSite = await prisma.userSite.findUnique({
    where: {
      userId_siteId: {
        userId: user.id,
        siteId: site.id,
      },
    },
  });

  if (!userSite) {
    return c.json({
      error: 'No access to this site',
      code: 'NO_SITE_ACCESS',
    }, 403);
  }

  return next();
};
