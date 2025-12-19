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
}

// Extend Hono context
declare module 'hono' {
  interface ContextVariableMap {
    site: SiteContext;
    siteId: number;
  }
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
          // Check user has access to this site
          if (user?.role === 'admin' || foundSite.ownerId === user?.id) {
            site = {
              id: foundSite.id,
              slug: foundSite.slug,
              name: foundSite.name,
              domain: foundSite.domain,
              subdomain: foundSite.subdomain,
              settings: JSON.parse(foundSite.settings),
            };
          }
        }
      }
    }

    // If no site from header, get user's first site or default
    if (!site && user) {
      const userSite = await prisma.site.findFirst({
        where: {
          OR: [
            { ownerId: user.id },
            ...(user.role === 'admin' ? [{ isActive: true }] : []),
          ],
        },
        orderBy: { createdAt: 'asc' },
      });

      if (userSite) {
        site = {
          id: userSite.id,
          slug: userSite.slug,
          name: userSite.name,
          domain: userSite.domain,
          subdomain: userSite.subdomain,
          settings: JSON.parse(userSite.settings),
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
