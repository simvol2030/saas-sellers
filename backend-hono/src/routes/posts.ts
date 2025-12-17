import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { z } from 'zod';
import { prisma } from '../lib/db';

const posts = new Hono();

// ==========================================
// VALIDATION SCHEMAS
// ==========================================

const createPostSchema = z.object({
  slug: z.string().min(1).max(255),
  title: z.string().min(1).max(255),
  excerpt: z.string().optional(),
  content: z.string(),
  contentType: z.enum(['markdown', 'html']).default('markdown'),
  metaTitle: z.string().optional(),
  metaDescription: z.string().optional(),
  ogImage: z.string().optional(),
  status: z.enum(['draft', 'published', 'archived']).default('draft'),
  featured: z.boolean().default(false),
  publishedAt: z.string().datetime().optional(),
  authorId: z.number().int().positive(),
  categoryId: z.number().int().positive().optional(),
  tags: z.array(z.number()).optional(), // Tag IDs
});

const updatePostSchema = createPostSchema.partial();

const querySchema = z.object({
  category: z.string().optional(),
  tag: z.string().optional(),
  status: z.string().optional(),
  featured: z.string().optional(),
  limit: z.string().optional(),
  offset: z.string().optional(),
});

// ==========================================
// ROUTES
// ==========================================

// GET /api/posts - Get all posts
posts.get('/', zValidator('query', querySchema), async (c) => {
  try {
    const query = c.req.valid('query');
    const limit = query.limit ? parseInt(query.limit) : 20;
    const offset = query.offset ? parseInt(query.offset) : 0;

    const where: any = {};

    // Filter by status (default: published for public API)
    if (query.status) {
      where.status = query.status;
    } else {
      where.status = 'published';
    }

    // Filter by category slug
    if (query.category) {
      where.category = {
        slug: query.category,
      };
    }

    // Filter by featured
    if (query.featured !== undefined) {
      where.featured = query.featured === 'true';
    }

    // Filter by tag
    if (query.tag) {
      where.tags = {
        some: {
          tag: {
            slug: query.tag,
          },
        },
      };
    }

    const [posts, total] = await Promise.all([
      prisma.post.findMany({
        where,
        include: {
          author: {
            select: {
              id: true,
              name: true,
              avatar: true,
            },
          },
          category: {
            select: {
              id: true,
              slug: true,
              name: true,
            },
          },
          tags: {
            include: {
              tag: true,
            },
          },
        },
        orderBy: {
          publishedAt: 'desc',
        },
        take: limit,
        skip: offset,
      }),
      prisma.post.count({ where }),
    ]);

    // Transform tags for cleaner response
    const transformedPosts = posts.map((post: typeof posts[0]) => ({
      ...post,
      tags: post.tags.map((pt: typeof post.tags[0]) => pt.tag),
    }));

    return c.json({
      data: transformedPosts,
      pagination: {
        total,
        limit,
        offset,
        hasMore: offset + limit < total,
      },
    });
  } catch (error) {
    console.error('Error fetching posts:', error);
    return c.json({ error: 'Failed to fetch posts' }, 500);
  }
});

// GET /api/posts/:slug - Get post by slug
posts.get('/:slug', async (c) => {
  try {
    const slug = c.req.param('slug');

    const post = await prisma.post.findUnique({
      where: { slug },
      include: {
        author: {
          select: {
            id: true,
            name: true,
            avatar: true,
            bio: true,
          },
        },
        category: true,
        tags: {
          include: {
            tag: true,
          },
        },
      },
    });

    if (!post) {
      return c.json({ error: 'Post not found' }, 404);
    }

    // Transform tags
    const transformedPost = {
      ...post,
      tags: post.tags.map((pt: typeof post.tags[0]) => pt.tag),
    };

    return c.json(transformedPost);
  } catch (error) {
    console.error('Error fetching post:', error);
    return c.json({ error: 'Failed to fetch post' }, 500);
  }
});

// POST /api/posts - Create a new post
posts.post('/', zValidator('json', createPostSchema), async (c) => {
  try {
    const data = c.req.valid('json');
    const { tags, ...postData } = data;

    const post = await prisma.post.create({
      data: {
        ...postData,
        publishedAt: postData.publishedAt ? new Date(postData.publishedAt) : null,
        tags: tags
          ? {
              create: tags.map((tagId) => ({
                tagId,
              })),
            }
          : undefined,
      },
      include: {
        author: true,
        category: true,
        tags: {
          include: {
            tag: true,
          },
        },
      },
    });

    return c.json(post, 201);
  } catch (error: any) {
    console.error('Error creating post:', error);
    if (error.code === 'P2002') {
      return c.json({ error: 'Post with this slug already exists' }, 400);
    }
    return c.json({ error: 'Failed to create post' }, 500);
  }
});

// PUT /api/posts/:slug - Update a post
posts.put('/:slug', zValidator('json', updatePostSchema), async (c) => {
  try {
    const slug = c.req.param('slug');
    const data = c.req.valid('json');
    const { tags, ...postData } = data;

    // Check if post exists
    const existingPost = await prisma.post.findUnique({
      where: { slug },
    });

    if (!existingPost) {
      return c.json({ error: 'Post not found' }, 404);
    }

    // Update post
    const post = await prisma.post.update({
      where: { slug },
      data: {
        ...postData,
        publishedAt: postData.publishedAt ? new Date(postData.publishedAt) : undefined,
      },
      include: {
        author: true,
        category: true,
        tags: {
          include: {
            tag: true,
          },
        },
      },
    });

    // Update tags if provided
    if (tags !== undefined) {
      // Remove existing tags
      await prisma.postTag.deleteMany({
        where: { postId: post.id },
      });

      // Add new tags
      if (tags.length > 0) {
        await prisma.postTag.createMany({
          data: tags.map((tagId) => ({
            postId: post.id,
            tagId,
          })),
        });
      }
    }

    return c.json(post);
  } catch (error) {
    console.error('Error updating post:', error);
    return c.json({ error: 'Failed to update post' }, 500);
  }
});

// DELETE /api/posts/:slug - Delete a post
posts.delete('/:slug', async (c) => {
  try {
    const slug = c.req.param('slug');

    const post = await prisma.post.findUnique({
      where: { slug },
    });

    if (!post) {
      return c.json({ error: 'Post not found' }, 404);
    }

    await prisma.post.delete({
      where: { slug },
    });

    return c.json({ message: 'Post deleted successfully' });
  } catch (error) {
    console.error('Error deleting post:', error);
    return c.json({ error: 'Failed to delete post' }, 500);
  }
});

export default posts;
