/**
 * Astro Content Collections Configuration
 * Определяет схемы для MD/MDX контента
 */
import { defineCollection, z } from 'astro:content';

// ==========================================
// BLOG COLLECTION
// ==========================================
const blogCollection = defineCollection({
  type: 'content',
  schema: z.object({
    // Required fields
    title: z.string(),
    description: z.string(),

    // Publishing
    publishedAt: z.coerce.date(),
    updatedAt: z.coerce.date().optional(),
    draft: z.boolean().default(false),
    featured: z.boolean().default(false),

    // Categorization
    category: z.string().optional(),
    tags: z.array(z.string()).default([]),

    // Author
    author: z.object({
      name: z.string(),
      avatar: z.string().optional(),
      url: z.string().optional(),
    }).optional(),

    // Media
    image: z.object({
      src: z.string(),
      alt: z.string(),
    }).optional(),
    ogImage: z.string().optional(),

    // SEO
    metaTitle: z.string().optional(),
    metaDescription: z.string().optional(),
    canonicalUrl: z.string().optional(),

    // Reading time (will be computed)
    readingTime: z.string().optional(),
  }),
});

// ==========================================
// PAGES COLLECTION (статические страницы)
// ==========================================
const pagesCollection = defineCollection({
  type: 'content',
  schema: z.object({
    title: z.string(),
    description: z.string().optional(),

    // SEO
    metaTitle: z.string().optional(),
    metaDescription: z.string().optional(),
    ogImage: z.string().optional(),

    // Layout options
    layout: z.enum(['default', 'wide', 'full']).default('default'),
    showToc: z.boolean().default(false), // Table of Contents

    // Publishing
    draft: z.boolean().default(false),
    updatedAt: z.coerce.date().optional(),
  }),
});

// ==========================================
// AUTHORS COLLECTION
// ==========================================
const authorsCollection = defineCollection({
  type: 'content',
  schema: z.object({
    name: z.string(),
    role: z.string().optional(),
    avatar: z.string().optional(),
    bio: z.string().optional(),

    // Social links
    social: z.object({
      twitter: z.string().optional(),
      github: z.string().optional(),
      linkedin: z.string().optional(),
      website: z.string().optional(),
    }).optional(),
  }),
});

// ==========================================
// EXPORT
// ==========================================
export const collections = {
  blog: blogCollection,
  pages: pagesCollection,
  authors: authorsCollection,
};
