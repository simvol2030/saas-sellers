/**
 * Landing Page Parser - парсинг MD файлов для лендингов
 *
 * Парсит frontmatter с массивом sections и подготавливает данные
 * для динамического рендеринга компонентов
 */

import { z } from 'zod';

// ===========================================
// SECTION TYPES
// ===========================================

/** Базовая секция */
export interface BaseSection {
  type: string;
  id?: string;
  className?: string;
  hidden?: boolean;
}

/** Hero - главный баннер */
export interface HeroSection extends BaseSection {
  type: 'hero';
  title: string;
  subtitle?: string;
  description?: string;
  backgroundImage?: string;
  backgroundVideo?: string;
  overlay?: boolean;
  overlayOpacity?: number;
  ctaText?: string;
  ctaHref?: string;
  ctaSecondaryText?: string;
  ctaSecondaryHref?: string;
  align?: 'left' | 'center' | 'right';
  height?: 'full' | 'large' | 'medium' | 'small';
}

/** HeroMin - мини-баннер для подстраниц */
export interface HeroMinSection extends BaseSection {
  type: 'heroMin';
  title: string;
  subtitle?: string;
  breadcrumbs?: Array<{ label: string; href: string }>;
  backgroundImage?: string;
}

/** TextBlock - текстовый блок с Markdown */
export interface TextBlockSection extends BaseSection {
  type: 'textBlock';
  content: string;
  columns?: 1 | 2;
  maxWidth?: 'sm' | 'md' | 'lg' | 'full';
}

/** Snippet - фото + текст */
export interface SnippetSection extends BaseSection {
  type: 'snippet';
  title: string;
  content: string;
  image: string;
  imageAlt?: string;
  imagePosition?: 'left' | 'right';
  ctaText?: string;
  ctaHref?: string;
}

/** CTA - призыв к действию */
export interface CTASection extends BaseSection {
  type: 'cta';
  title: string;
  description?: string;
  buttonText: string;
  buttonHref: string;
  secondaryText?: string;
  secondaryHref?: string;
  variant?: 'default' | 'primary' | 'dark';
}

/** PhotoGallery - галерея с lightbox */
export interface PhotoGallerySection extends BaseSection {
  type: 'photoGallery';
  title?: string;
  images: Array<{
    src: string;
    alt?: string;
    caption?: string;
  }>;
  columns?: 2 | 3 | 4;
}

/** PhotoSlider - слайдер изображений */
export interface PhotoSliderSection extends BaseSection {
  type: 'photoSlider';
  title?: string;
  images: Array<{
    src: string;
    alt?: string;
    caption?: string;
    link?: string;
  }>;
  autoplay?: boolean;
  interval?: number;
}

/** VideoYouTube - встроенное YouTube видео */
export interface VideoYouTubeSection extends BaseSection {
  type: 'videoYouTube';
  title?: string;
  videoId: string;
  aspectRatio?: '16:9' | '4:3' | '1:1';
}

/** VideoLocal - локальное видео */
export interface VideoLocalSection extends BaseSection {
  type: 'videoLocal';
  title?: string;
  src: string;
  poster?: string;
  autoplay?: boolean;
  muted?: boolean;
  loop?: boolean;
  controls?: boolean;
}

/** MediaMix - Instagram-style (фото + видео + текст expand) */
export interface MediaMixSection extends BaseSection {
  type: 'mediaMix';
  title?: string;
  items: Array<{
    type: 'image' | 'video';
    src: string;
    poster?: string;
    caption?: string;
    expandedContent?: string;
  }>;
}

/** FAQ - вопросы-ответы */
export interface FAQSection extends BaseSection {
  type: 'faq';
  title?: string;
  subtitle?: string;
  items: Array<{
    question: string;
    answer: string;
  }>;
}

/** ContactForm - форма обратной связи */
export interface ContactFormSection extends BaseSection {
  type: 'contactForm';
  title?: string;
  description?: string;
  submitText?: string;
  successMessage?: string;
  fields?: Array<{
    name: string;
    type: 'text' | 'email' | 'tel' | 'textarea' | 'select';
    label: string;
    placeholder?: string;
    required?: boolean;
    options?: string[];
  }>;
}

/** Pricing - таблица тарифов */
export interface PricingSection extends BaseSection {
  type: 'pricing';
  title?: string;
  subtitle?: string;
  plans: Array<{
    name: string;
    price: string;
    period?: string;
    description?: string;
    features: string[];
    ctaText: string;
    ctaHref: string;
    highlighted?: boolean;
  }>;
}

/** CompareTable - сравнительная таблица */
export interface CompareTableSection extends BaseSection {
  type: 'compareTable';
  title?: string;
  headers: string[];
  rows: Array<{
    feature: string;
    values: Array<string | boolean>;
  }>;
}

/** Testimonials - отзывы */
export interface TestimonialsSection extends BaseSection {
  type: 'testimonials';
  title?: string;
  items: Array<{
    content: string;
    author: string;
    role?: string;
    avatar?: string;
    rating?: number;
  }>;
  layout?: 'grid' | 'slider';
}

/** Features - преимущества */
export interface FeaturesSection extends BaseSection {
  type: 'features';
  title?: string;
  subtitle?: string;
  items: Array<{
    icon?: string;
    title: string;
    description: string;
  }>;
  columns?: 2 | 3 | 4;
}

/** Timeline - этапы/таймлайн */
export interface TimelineSection extends BaseSection {
  type: 'timeline';
  title?: string;
  items: Array<{
    title: string;
    description: string;
    date?: string;
    icon?: string;
  }>;
}

/** Stats - статистика с анимацией */
export interface StatsSection extends BaseSection {
  type: 'stats';
  title?: string;
  items: Array<{
    value: string | number;
    label: string;
    prefix?: string;
    suffix?: string;
  }>;
  variant?: 'default' | 'cards' | 'minimal';
}

/** Team - команда */
export interface TeamSection extends BaseSection {
  type: 'team';
  title?: string;
  subtitle?: string;
  members: Array<{
    name: string;
    role: string;
    avatar?: string;
    bio?: string;
    socials?: Array<{ name: string; href: string }>;
  }>;
}

/** Partners - логотипы партнёров */
export interface PartnersSection extends BaseSection {
  type: 'partners';
  title?: string;
  logos: Array<{
    src: string;
    alt: string;
    href?: string;
  }>;
  grayscale?: boolean;
}

/** InstagramFeed - лента Instagram-style */
export interface InstagramFeedSection extends BaseSection {
  type: 'instagramFeed';
  title?: string;
  posts: Array<{
    image: string;
    likes?: number;
    comments?: number;
    caption?: string;
    link?: string;
  }>;
}

/** Longread - длинная статья с TOC */
export interface LongreadSection extends BaseSection {
  type: 'longread';
  content: string;
  showToc?: boolean;
  tocTitle?: string;
}

// Union type for all sections
export type Section =
  | HeroSection
  | HeroMinSection
  | TextBlockSection
  | SnippetSection
  | CTASection
  | PhotoGallerySection
  | PhotoSliderSection
  | VideoYouTubeSection
  | VideoLocalSection
  | MediaMixSection
  | FAQSection
  | ContactFormSection
  | PricingSection
  | CompareTableSection
  | TestimonialsSection
  | FeaturesSection
  | TimelineSection
  | StatsSection
  | TeamSection
  | PartnersSection
  | InstagramFeedSection
  | LongreadSection;

// ===========================================
// LANDING PAGE DATA
// ===========================================

export interface LandingPageData {
  // Meta
  title: string;
  description?: string;
  image?: string;
  canonicalUrl?: string;
  noindex?: boolean;

  // Layout
  hideHeader?: boolean;
  hideFooter?: boolean;
  headerConfig?: Record<string, unknown>;
  footerConfig?: Record<string, unknown>;

  // Sections
  sections: Section[];

  // Page settings
  slug?: string;
  status?: 'draft' | 'published';
  publishedAt?: string;
  updatedAt?: string;

  // SSG/SSR
  prerender?: boolean;
}

// ===========================================
// ZOD SCHEMAS FOR VALIDATION
// ===========================================

const baseSectionSchema = z.object({
  type: z.string(),
  id: z.string().optional(),
  className: z.string().optional(),
  hidden: z.boolean().optional(),
});

const heroSectionSchema = baseSectionSchema.extend({
  type: z.literal('hero'),
  title: z.string(),
  subtitle: z.string().optional(),
  description: z.string().optional(),
  backgroundImage: z.string().optional(),
  backgroundVideo: z.string().optional(),
  overlay: z.boolean().optional(),
  overlayOpacity: z.number().min(0).max(1).optional(),
  ctaText: z.string().optional(),
  ctaHref: z.string().optional(),
  ctaSecondaryText: z.string().optional(),
  ctaSecondaryHref: z.string().optional(),
  align: z.enum(['left', 'center', 'right']).optional(),
  height: z.enum(['full', 'large', 'medium', 'small']).optional(),
});

const faqSectionSchema = baseSectionSchema.extend({
  type: z.literal('faq'),
  title: z.string().optional(),
  subtitle: z.string().optional(),
  items: z.array(z.object({
    question: z.string(),
    answer: z.string(),
  })),
});

const featuresSectionSchema = baseSectionSchema.extend({
  type: z.literal('features'),
  title: z.string().optional(),
  subtitle: z.string().optional(),
  items: z.array(z.object({
    icon: z.string().optional(),
    title: z.string(),
    description: z.string(),
  })),
  columns: z.union([z.literal(2), z.literal(3), z.literal(4)]).optional(),
});

// More schemas can be added as needed...

export const landingPageSchema = z.object({
  title: z.string(),
  description: z.string().optional(),
  image: z.string().optional(),
  canonicalUrl: z.string().optional(),
  noindex: z.boolean().optional(),
  hideHeader: z.boolean().optional(),
  hideFooter: z.boolean().optional(),
  headerConfig: z.record(z.unknown()).optional(),
  footerConfig: z.record(z.unknown()).optional(),
  sections: z.array(z.union([
    heroSectionSchema,
    faqSectionSchema,
    featuresSectionSchema,
    // Add more section schemas as they are implemented
    baseSectionSchema, // Fallback for other section types
  ])),
  slug: z.string().optional(),
  status: z.enum(['draft', 'published']).optional(),
  publishedAt: z.string().optional(),
  updatedAt: z.string().optional(),
  prerender: z.boolean().optional(),
});

// ===========================================
// PARSER FUNCTIONS
// ===========================================

/**
 * Parse and validate landing page data from frontmatter
 */
export function parseLandingData(data: unknown): LandingPageData {
  const result = landingPageSchema.safeParse(data);

  if (!result.success) {
    console.error('Landing page validation errors:', result.error.issues);
    throw new Error(`Invalid landing page data: ${result.error.message}`);
  }

  return result.data as LandingPageData;
}

/**
 * Filter visible sections (not hidden)
 */
export function getVisibleSections(sections: Section[]): Section[] {
  return sections.filter(section => !section.hidden);
}

/**
 * Get section by id
 */
export function getSectionById(sections: Section[], id: string): Section | undefined {
  return sections.find(section => section.id === id);
}

/**
 * Get sections by type
 */
export function getSectionsByType<T extends Section['type']>(
  sections: Section[],
  type: T
): Extract<Section, { type: T }>[] {
  return sections.filter(
    (section): section is Extract<Section, { type: T }> => section.type === type
  );
}

/**
 * Generate table of contents from sections
 */
export function generateTOC(sections: Section[]): Array<{ id: string; title: string; type: string }> {
  const toc: Array<{ id: string; title: string; type: string }> = [];

  sections.forEach((section, index) => {
    if (section.hidden) return;

    const id = section.id || `section-${index}`;
    let title = '';

    // Extract title based on section type
    if ('title' in section && section.title) {
      title = section.title;
    } else if (section.type === 'hero' && 'title' in section) {
      title = section.title;
    }

    if (title) {
      toc.push({ id, title, type: section.type });
    }
  });

  return toc;
}

export default {
  parseLandingData,
  getVisibleSections,
  getSectionById,
  getSectionsByType,
  generateTOC,
};
