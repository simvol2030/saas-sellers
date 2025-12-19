/**
 * Export/Import API Routes
 *
 * Экспорт и импорт страниц в Markdown формате
 *
 * Endpoints:
 * GET  /api/admin/pages/:id/export      - Export page to MD
 * POST /api/admin/pages/import          - Import page from MD
 * POST /api/admin/pages/import/batch    - Import multiple pages
 * GET  /api/admin/pages/export-all      - Export all pages as ZIP
 */

import { Hono } from 'hono';
import { prisma } from '../lib/db.js';
import { authMiddleware, editorOrAdmin } from '../middleware/auth.js';
import { siteMiddleware, requireSite } from '../middleware/site.js';
import matter from 'gray-matter';
import archiver from 'archiver';
import { Readable, PassThrough } from 'stream';

const exportImport = new Hono();

// Apply middlewares
exportImport.use('*', authMiddleware);
exportImport.use('*', editorOrAdmin);
exportImport.use('*', siteMiddleware);
exportImport.use('*', requireSite);

// ==========================================
// EXPORT SINGLE PAGE
// ==========================================

exportImport.get('/pages/:id/export', async (c) => {
  const id = parseInt(c.req.param('id'), 10);
  const siteId = c.get('siteId');

  if (isNaN(id)) {
    return c.json({ error: 'Invalid page ID' }, 400);
  }

  try {
    const page = await prisma.page.findFirst({
      where: { id, siteId },
      include: {
        parent: { select: { slug: true } },
        tags: {
          include: {
            tag: { select: { slug: true } },
          },
        },
      },
    });

    if (!page) {
      return c.json({ error: 'Page not found' }, 404);
    }

    // Build frontmatter
    const frontmatter: Record<string, any> = {
      title: page.title,
      slug: page.slug,
      description: page.description || undefined,
      status: page.status,
    };

    // Parent page reference
    if (page.parent) {
      frontmatter.parentSlug = page.parent.slug;
    }

    // Tags
    if (page.tags.length > 0) {
      frontmatter.tags = page.tags.map((pt: any) => pt.tag.slug);
    }

    // SEO
    if (page.metaTitle) frontmatter.metaTitle = page.metaTitle;
    if (page.metaDescription) frontmatter.metaDescription = page.metaDescription;
    if (page.ogImage) frontmatter.ogImage = page.ogImage;
    if (page.canonicalUrl) frontmatter.canonicalUrl = page.canonicalUrl;
    if (page.noindex) frontmatter.noindex = true;

    // Layout
    if (page.hideHeader) frontmatter.hideHeader = true;
    if (page.hideFooter) frontmatter.hideFooter = true;
    if (page.headerConfig) {
      try {
        frontmatter.headerConfig = JSON.parse(page.headerConfig);
      } catch {}
    }
    if (page.footerConfig) {
      try {
        frontmatter.footerConfig = JSON.parse(page.footerConfig);
      } catch {}
    }

    // Sections
    try {
      frontmatter.sections = JSON.parse(page.sections);
    } catch {
      frontmatter.sections = [];
    }

    // Generate markdown
    const markdown = matter.stringify('', frontmatter);

    // Return as file download
    c.header('Content-Type', 'text/markdown; charset=utf-8');
    c.header('Content-Disposition', `attachment; filename="${page.slug}.md"`);

    return c.body(markdown);
  } catch (error) {
    console.error('Export page error:', error);
    return c.json({ error: 'Failed to export page' }, 500);
  }
});

// ==========================================
// IMPORT SINGLE PAGE
// ==========================================

exportImport.post('/pages/import', async (c) => {
  const siteId = c.get('siteId');
  const user = c.get('user');

  try {
    const body = await c.req.parseBody();
    const file = body['file'];

    if (!file || !(file instanceof File)) {
      return c.json({ error: 'No file provided' }, 400);
    }

    const content = await file.text();
    const { data: frontmatter, content: markdownContent } = matter(content);

    // Validate required fields
    if (!frontmatter.slug || !frontmatter.title) {
      return c.json({ error: 'Missing required fields: slug, title' }, 400);
    }

    // Check if page already exists
    const existing = await prisma.page.findUnique({
      where: {
        siteId_slug: { siteId, slug: frontmatter.slug },
      },
    });

    // Find parent page if referenced
    let parentId = null;
    if (frontmatter.parentSlug) {
      const parent = await prisma.page.findUnique({
        where: {
          siteId_slug: { siteId, slug: frontmatter.parentSlug },
        },
      });
      if (parent) {
        parentId = parent.id;
      }
    }

    // Prepare page data
    const pageData = {
      title: frontmatter.title,
      slug: frontmatter.slug,
      description: frontmatter.description || null,
      status: frontmatter.status || 'draft',
      sections: JSON.stringify(frontmatter.sections || []),
      metaTitle: frontmatter.metaTitle || null,
      metaDescription: frontmatter.metaDescription || null,
      ogImage: frontmatter.ogImage || null,
      canonicalUrl: frontmatter.canonicalUrl || null,
      noindex: frontmatter.noindex || false,
      hideHeader: frontmatter.hideHeader || false,
      hideFooter: frontmatter.hideFooter || false,
      headerConfig: frontmatter.headerConfig ? JSON.stringify(frontmatter.headerConfig) : null,
      footerConfig: frontmatter.footerConfig ? JSON.stringify(frontmatter.footerConfig) : null,
      prerender: frontmatter.prerender !== false,
      parentId,
      siteId,
      authorId: user.id,
    };

    let page;
    let created = false;

    if (existing) {
      // Update existing page
      page = await prisma.page.update({
        where: { id: existing.id },
        data: pageData,
      });
    } else {
      // Create new page
      page = await prisma.page.create({
        data: pageData,
      });
      created = true;
    }

    // Handle tags
    if (frontmatter.tags && Array.isArray(frontmatter.tags)) {
      // Delete existing tags
      await prisma.pageTag.deleteMany({ where: { pageId: page.id } });

      // Add new tags
      for (const tagSlug of frontmatter.tags) {
        let tag = await prisma.tag.findUnique({
          where: { siteId_slug: { siteId, slug: tagSlug } },
        });

        if (!tag) {
          // Create tag if doesn't exist
          tag = await prisma.tag.create({
            data: {
              name: tagSlug,
              slug: tagSlug,
              siteId,
            },
          });
        }

        await prisma.pageTag.create({
          data: {
            pageId: page.id,
            tagId: tag.id,
          },
        });
      }
    }

    return c.json({
      message: created ? 'Page imported' : 'Page updated',
      page,
      created,
    }, created ? 201 : 200);
  } catch (error) {
    console.error('Import page error:', error);
    return c.json({ error: 'Failed to import page' }, 500);
  }
});

// ==========================================
// IMPORT BATCH
// ==========================================

exportImport.post('/pages/import/batch', async (c) => {
  const siteId = c.get('siteId');
  const user = c.get('user');

  try {
    const body = await c.req.parseBody();
    const files: File[] = [];

    // Handle multiple files
    for (const key of Object.keys(body)) {
      if (key.startsWith('files') && body[key] instanceof File) {
        files.push(body[key] as File);
      }
    }

    if (files.length === 0) {
      return c.json({ error: 'No files provided' }, 400);
    }

    const results: any[] = [];
    const errors: any[] = [];

    for (const file of files) {
      try {
        const content = await file.text();
        const { data: frontmatter } = matter(content);

        if (!frontmatter.slug || !frontmatter.title) {
          errors.push({
            file: file.name,
            error: 'Missing required fields: slug, title',
          });
          continue;
        }

        // Check if page already exists
        const existing = await prisma.page.findUnique({
          where: {
            siteId_slug: { siteId, slug: frontmatter.slug },
          },
        });

        // Find parent page if referenced
        let parentId = null;
        if (frontmatter.parentSlug) {
          const parent = await prisma.page.findUnique({
            where: {
              siteId_slug: { siteId, slug: frontmatter.parentSlug },
            },
          });
          if (parent) {
            parentId = parent.id;
          }
        }

        const pageData = {
          title: frontmatter.title,
          slug: frontmatter.slug,
          description: frontmatter.description || null,
          status: frontmatter.status || 'draft',
          sections: JSON.stringify(frontmatter.sections || []),
          metaTitle: frontmatter.metaTitle || null,
          metaDescription: frontmatter.metaDescription || null,
          ogImage: frontmatter.ogImage || null,
          canonicalUrl: frontmatter.canonicalUrl || null,
          noindex: frontmatter.noindex || false,
          hideHeader: frontmatter.hideHeader || false,
          hideFooter: frontmatter.hideFooter || false,
          headerConfig: frontmatter.headerConfig ? JSON.stringify(frontmatter.headerConfig) : null,
          footerConfig: frontmatter.footerConfig ? JSON.stringify(frontmatter.footerConfig) : null,
          prerender: frontmatter.prerender !== false,
          parentId,
          siteId,
          authorId: user.id,
        };

        let page;
        let created = false;

        if (existing) {
          page = await prisma.page.update({
            where: { id: existing.id },
            data: pageData,
          });
        } else {
          page = await prisma.page.create({
            data: pageData,
          });
          created = true;
        }

        // Handle tags (same as single import)
        if (frontmatter.tags && Array.isArray(frontmatter.tags)) {
          // Delete existing tags
          await prisma.pageTag.deleteMany({ where: { pageId: page.id } });

          // Add new tags
          for (const tagSlug of frontmatter.tags) {
            let tag = await prisma.tag.findUnique({
              where: { siteId_slug: { siteId, slug: tagSlug } },
            });

            if (!tag) {
              // Create tag if doesn't exist
              tag = await prisma.tag.create({
                data: {
                  name: tagSlug,
                  slug: tagSlug,
                  siteId,
                },
              });
            }

            await prisma.pageTag.create({
              data: {
                pageId: page.id,
                tagId: tag.id,
              },
            });
          }
        }

        results.push({
          file: file.name,
          page,
          created,
        });
      } catch (err) {
        errors.push({
          file: file.name,
          error: err instanceof Error ? err.message : 'Unknown error',
        });
      }
    }

    return c.json({
      message: `Imported ${results.length} pages, ${errors.length} errors`,
      pages: results,
      errors,
    });
  } catch (error) {
    console.error('Batch import error:', error);
    return c.json({ error: 'Failed to import pages' }, 500);
  }
});

// ==========================================
// EXPORT ALL PAGES AS ZIP
// ==========================================

exportImport.get('/pages/export-all', async (c) => {
  const siteId = c.get('siteId');

  try {
    const pages = await prisma.page.findMany({
      where: { siteId },
      include: {
        parent: { select: { slug: true } },
        tags: {
          include: {
            tag: { select: { slug: true } },
          },
        },
      },
      orderBy: [{ level: 'asc' }, { order: 'asc' }],
    });

    if (pages.length === 0) {
      return c.json({ error: 'No pages to export' }, 404);
    }

    // Create a pass-through stream
    const passThrough = new PassThrough();

    // Create archive
    const archive = archiver('zip', {
      zlib: { level: 9 },
    });

    // Pipe archive to pass-through
    archive.pipe(passThrough);

    // Add each page as MD file
    for (const page of pages) {
      const frontmatter: Record<string, any> = {
        title: page.title,
        slug: page.slug,
        description: page.description || undefined,
        status: page.status,
      };

      if (page.parent) {
        frontmatter.parentSlug = page.parent.slug;
      }

      if (page.tags.length > 0) {
        frontmatter.tags = page.tags.map((pt: any) => pt.tag.slug);
      }

      if (page.metaTitle) frontmatter.metaTitle = page.metaTitle;
      if (page.metaDescription) frontmatter.metaDescription = page.metaDescription;
      if (page.ogImage) frontmatter.ogImage = page.ogImage;
      if (page.canonicalUrl) frontmatter.canonicalUrl = page.canonicalUrl;
      if (page.noindex) frontmatter.noindex = true;
      if (page.hideHeader) frontmatter.hideHeader = true;
      if (page.hideFooter) frontmatter.hideFooter = true;

      if (page.headerConfig) {
        try {
          frontmatter.headerConfig = JSON.parse(page.headerConfig);
        } catch {}
      }
      if (page.footerConfig) {
        try {
          frontmatter.footerConfig = JSON.parse(page.footerConfig);
        } catch {}
      }

      try {
        frontmatter.sections = JSON.parse(page.sections);
      } catch {
        frontmatter.sections = [];
      }

      const markdown = matter.stringify('', frontmatter);

      // Determine file path based on hierarchy
      let filePath = `${page.slug}.md`;
      if (page.parent) {
        filePath = `${page.parent.slug}/${page.slug}.md`;
      }

      archive.append(markdown, { name: filePath });
    }

    // Finalize the archive
    archive.finalize();

    // Set headers for ZIP download
    c.header('Content-Type', 'application/zip');
    c.header('Content-Disposition', 'attachment; filename="pages-export.zip"');

    // Convert PassThrough to ReadableStream
    const readable = Readable.toWeb(passThrough) as ReadableStream;
    return new Response(readable, {
      headers: {
        'Content-Type': 'application/zip',
        'Content-Disposition': 'attachment; filename="pages-export.zip"',
      },
    });
  } catch (error) {
    console.error('Export all pages error:', error);
    return c.json({ error: 'Failed to export pages' }, 500);
  }
});

export default exportImport;
