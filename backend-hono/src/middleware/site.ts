/**
 * Site Context Middleware
 *
 * Determines the current site context from:
 * 1. X-Site-ID header (admin panel)
 * 2. Domain/subdomain (public pages)
 * 3. Default site (fallback)
 */

import { Context, Next } from 'hono';
import { prisma } from '../lib/db.js';

export interface SiteContext {
  id: number;
  slug: string;
  name: string;
  domain: string | null;
  subdomain: string | null;
  settings: Record<string, any>;
  ownerId: number;  // Phase 3: for permission checks
}

// Extend Hono context
declare module 'hono' {
  interface ContextVariableMap {
    site: SiteContext;
    siteId: number;
  }
}

/**
 * Phase 3: Check if user has access to site via UserSite
 */
async function userHasSiteAccess(userId: number, siteId: number): Promise<boolean> {
  const userSite = await prisma.userSite.findUnique({
    where: { userId_siteId: { userId, siteId } },
  });
  return !!userSite;
}

/**
 * Get or create default site
 */
async function getOrCreateDefaultSite(ownerId: number): Promise<SiteContext> {
  let site = await prisma.site.findFirst({
    where: { slug: 'default' },
  });

  if (!site) {
    site = await prisma.site.create({
      data: {
        name: 'Default Site',
        slug: 'default',
        ownerId,
        settings: '{}',
      },
    });

    // Create default menus
    await prisma.menu.createMany({
      data: [
        { name: 'Header Menu', slug: 'header', location: 'header', items: '[]', siteId: site.id },
        { name: 'Footer Menu', slug: 'footer', location: 'footer', items: '[]', siteId: site.id },
      ],
    });
  }

  return {
    id: site.id,
    slug: site.slug,
    name: site.name,
    domain: site.domain,
    subdomain: site.subdomain,
    settings: JSON.parse(site.settings),
    ownerId: site.ownerId,
  };
}

/**
 * Site context middleware for admin routes
 * Uses X-Site-ID header to determine site
 */
export const siteMiddleware = async (c: Context, next: Next) => {
  const siteIdHeader = c.req.header('X-Site-ID');
  const user = c.get('user');

  try {
    let site: SiteContext | null = null;

    // Try to get site from header
    if (siteIdHeader) {
      const siteId = parseInt(siteIdHeader);
      if (!isNaN(siteId)) {
        const foundSite = await prisma.site.findUnique({
          where: { id: siteId, isActive: true },
        });

        if (foundSite) {
          // Phase 3: Check user has access to this site
          // Superadmin has access to all sites
          // Site owner has access to their site
          // UserSite grants access via permissions
          const hasAccess = user?.isSuperadmin ||
            foundSite.ownerId === user?.id ||
            (user?.id && await userHasSiteAccess(user.id, foundSite.id));

          if (hasAccess) {
            site = {
              id: foundSite.id,
              slug: foundSite.slug,
              name: foundSite.name,
              domain: foundSite.domain,
              subdomain: foundSite.subdomain,
              settings: JSON.parse(foundSite.settings),
              ownerId: foundSite.ownerId,
            };
          }
        }
      }
    }

    // If no site from header, get user's first site or default
    if (!site && user) {
      // Phase 3: Include sites accessible via UserSite
      const accessibleSite = await prisma.site.findFirst({
        where: {
          OR: [
            { ownerId: user.id },
            { userSites: { some: { userId: user.id } } },  // Phase 3: UserSite access
            ...(user.isSuperadmin ? [{ isActive: true }] : []),  // Superadmin sees all
          ],
        },
        orderBy: { createdAt: 'asc' },
      });

      if (accessibleSite) {
        site = {
          id: accessibleSite.id,
          slug: accessibleSite.slug,
          name: accessibleSite.name,
          domain: accessibleSite.domain,
          subdomain: accessibleSite.subdomain,
          settings: JSON.parse(accessibleSite.settings),
          ownerId: accessibleSite.ownerId,
        };
      } else {
        // Create default site for this user
        site = await getOrCreateDefaultSite(user.id);
      }
    }

    // Fallback to default site
    if (!site) {
      const defaultSite = await prisma.site.findFirst({
        where: { slug: 'default' },
      });

      if (defaultSite) {
        site = {
          id: defaultSite.id,
          slug: defaultSite.slug,
          name: defaultSite.name,
          domain: defaultSite.domain,
          subdomain: defaultSite.subdomain,
          settings: JSON.parse(defaultSite.settings),
          ownerId: defaultSite.ownerId,
        };
      }
    }

    if (site) {
      c.set('site', site);
      c.set('siteId', site.id);
    }

    await next();
  } catch (error) {
    console.error('Site middleware error:', error);
    await next();
  }
};

/**
 * Public site middleware - determines site from domain/subdomain
 */
export const publicSiteMiddleware = async (c: Context, next: Next) => {
  const host = c.req.header('host') || '';

  try {
    let site: SiteContext | null = null;

    // Try to find site by domain
    const foundByDomain = await prisma.site.findFirst({
      where: {
        OR: [
          { domain: host },
          { domain: host.split(':')[0] }, // Without port
        ],
        isActive: true,
      },
    });

    if (foundByDomain) {
      site = {
        id: foundByDomain.id,
        slug: foundByDomain.slug,
        name: foundByDomain.name,
        domain: foundByDomain.domain,
        subdomain: foundByDomain.subdomain,
        settings: JSON.parse(foundByDomain.settings),
        ownerId: foundByDomain.ownerId,
      };
    }

    // Try subdomain matching (e.g., site1.platform.com)
    if (!site) {
      const hostParts = host.split('.');
      if (hostParts.length >= 2) {
        const subdomain = hostParts[0];
        const foundBySubdomain = await prisma.site.findFirst({
          where: {
            subdomain,
            isActive: true,
          },
        });

        if (foundBySubdomain) {
          site = {
            id: foundBySubdomain.id,
            slug: foundBySubdomain.slug,
            name: foundBySubdomain.name,
            domain: foundBySubdomain.domain,
            subdomain: foundBySubdomain.subdomain,
            settings: JSON.parse(foundBySubdomain.settings),
            ownerId: foundBySubdomain.ownerId,
          };
        }
      }
    }

    // Fallback to default site
    if (!site) {
      const defaultSite = await prisma.site.findFirst({
        where: { slug: 'default', isActive: true },
      });

      if (defaultSite) {
        site = {
          id: defaultSite.id,
          slug: defaultSite.slug,
          name: defaultSite.name,
          domain: defaultSite.domain,
          subdomain: defaultSite.subdomain,
          settings: JSON.parse(defaultSite.settings),
          ownerId: defaultSite.ownerId,
        };
      }
    }

    if (site) {
      c.set('site', site);
      c.set('siteId', site.id);
    }

    await next();
  } catch (error) {
    console.error('Public site middleware error:', error);
    await next();
  }
};

/**
 * Require site context middleware - fails if no site found
 */
export const requireSite = async (c: Context, next: Next) => {
  const site = c.get('site');

  if (!site) {
    return c.json(
      {
        error: 'No site context',
        code: 'NO_SITE',
        message: 'Please select a site or set X-Site-ID header',
      },
      400
    );
  }

  await next();
};
