/**
 * Sections Registry - реестр секций для Landing Builder
 *
 * Определяет все доступные секции и их метаданные
 * для использования в парсере и админке
 */

import type { Section } from './parser';

// ===========================================
// SECTION METADATA
// ===========================================

export interface SectionMeta {
  type: string;
  name: string;
  description: string;
  category: SectionCategory;
  icon: string;
  component: string;
  defaultProps?: Partial<Section>;
}

export type SectionCategory =
  | 'hero'
  | 'content'
  | 'media'
  | 'conversion'
  | 'info'
  | 'social';

export const categoryLabels: Record<SectionCategory, string> = {
  hero: 'Баннеры',
  content: 'Контент',
  media: 'Медиа',
  conversion: 'Конверсия',
  info: 'Информация',
  social: 'Social-style',
};

// ===========================================
// SECTIONS REGISTRY
// ===========================================

export const sectionsRegistry: SectionMeta[] = [
  // Hero Sections
  {
    type: 'hero',
    name: 'Hero',
    description: 'Главный баннер с фото/видео фоном, заголовком и CTA',
    category: 'hero',
    icon: 'layout-dashboard',
    component: 'Hero',
    defaultProps: {
      type: 'hero',
      title: 'Заголовок',
      subtitle: 'Подзаголовок',
      ctaText: 'Узнать больше',
      ctaHref: '#',
      align: 'center',
      height: 'large',
      overlay: true,
      overlayOpacity: 0.5,
    },
  },
  {
    type: 'heroMin',
    name: 'HeroMin',
    description: 'Мини-баннер для подстраниц с хлебными крошками',
    category: 'hero',
    icon: 'layout-navbar',
    component: 'HeroMin',
    defaultProps: {
      type: 'heroMin',
      title: 'Заголовок страницы',
    },
  },

  // Content Sections
  {
    type: 'textBlock',
    name: 'Текстовый блок',
    description: 'Текстовый блок с поддержкой Markdown',
    category: 'content',
    icon: 'text',
    component: 'TextBlock',
    defaultProps: {
      type: 'textBlock',
      content: 'Ваш текст здесь...',
      maxWidth: 'md',
    },
  },
  {
    type: 'snippet',
    name: 'Snippet',
    description: 'Блок с изображением и текстом',
    category: 'content',
    icon: 'layout-sidebar',
    component: 'Snippet',
    defaultProps: {
      type: 'snippet',
      title: 'Заголовок',
      content: 'Описание...',
      image: '/placeholder.jpg',
      imagePosition: 'left',
    },
  },
  {
    type: 'longread',
    name: 'Longread',
    description: 'Длинная статья с оглавлением',
    category: 'content',
    icon: 'file-text',
    component: 'Longread',
    defaultProps: {
      type: 'longread',
      content: '# Заголовок\n\nТекст статьи...',
      showToc: true,
    },
  },

  // Media Sections
  {
    type: 'photoGallery',
    name: 'Фотогалерея',
    description: 'Галерея изображений с lightbox и swipe',
    category: 'media',
    icon: 'photo',
    component: 'PhotoGallery',
    defaultProps: {
      type: 'photoGallery',
      images: [],
      columns: 3,
    },
  },
  {
    type: 'photoSlider',
    name: 'Слайдер',
    description: 'Слайдер изображений с автопрокруткой',
    category: 'media',
    icon: 'slideshow',
    component: 'PhotoSlider',
    defaultProps: {
      type: 'photoSlider',
      images: [],
      autoplay: true,
      interval: 5000,
    },
  },
  {
    type: 'videoYouTube',
    name: 'YouTube видео',
    description: 'Встроенное видео с YouTube',
    category: 'media',
    icon: 'brand-youtube',
    component: 'VideoYouTube',
    defaultProps: {
      type: 'videoYouTube',
      videoId: '',
      aspectRatio: '16:9',
    },
  },
  {
    type: 'videoLocal',
    name: 'Локальное видео',
    description: 'Видео с автовоспроизведением при скролле',
    category: 'media',
    icon: 'video',
    component: 'VideoLocal',
    defaultProps: {
      type: 'videoLocal',
      src: '',
      autoplay: true,
      muted: true,
      loop: true,
    },
  },
  {
    type: 'mediaMix',
    name: 'MediaMix',
    description: 'Instagram-style лента (фото + видео + текст)',
    category: 'media',
    icon: 'brand-instagram',
    component: 'MediaMix',
    defaultProps: {
      type: 'mediaMix',
      items: [],
    },
  },

  // Conversion Sections
  {
    type: 'cta',
    name: 'CTA',
    description: 'Призыв к действию с кнопкой',
    category: 'conversion',
    icon: 'click',
    component: 'CTA',
    defaultProps: {
      type: 'cta',
      title: 'Готовы начать?',
      description: 'Свяжитесь с нами сегодня',
      buttonText: 'Начать',
      buttonHref: '#contact',
      variant: 'primary',
    },
  },
  {
    type: 'faq',
    name: 'FAQ',
    description: 'Вопросы и ответы (аккордеон)',
    category: 'conversion',
    icon: 'help',
    component: 'FAQ',
    defaultProps: {
      type: 'faq',
      title: 'Часто задаваемые вопросы',
      items: [],
    },
  },
  {
    type: 'contactForm',
    name: 'Форма обратной связи',
    description: 'Контактная форма с настраиваемыми полями',
    category: 'conversion',
    icon: 'mail',
    component: 'ContactForm',
    defaultProps: {
      type: 'contactForm',
      title: 'Свяжитесь с нами',
      submitText: 'Отправить',
    },
  },
  {
    type: 'pricing',
    name: 'Тарифы',
    description: 'Таблица тарифов с выделением',
    category: 'conversion',
    icon: 'currency-dollar',
    component: 'Pricing',
    defaultProps: {
      type: 'pricing',
      title: 'Наши тарифы',
      plans: [],
    },
  },
  {
    type: 'compareTable',
    name: 'Сравнительная таблица',
    description: 'Таблица сравнения функций/тарифов',
    category: 'conversion',
    icon: 'table',
    component: 'CompareTable',
    defaultProps: {
      type: 'compareTable',
      headers: [],
      rows: [],
    },
  },
  {
    type: 'testimonials',
    name: 'Отзывы',
    description: 'Карточки или слайдер с отзывами',
    category: 'conversion',
    icon: 'message-circle',
    component: 'Testimonials',
    defaultProps: {
      type: 'testimonials',
      items: [],
      layout: 'grid',
    },
  },

  // Info Sections
  {
    type: 'features',
    name: 'Преимущества',
    description: 'Сетка преимуществ с иконками',
    category: 'info',
    icon: 'star',
    component: 'Features',
    defaultProps: {
      type: 'features',
      title: 'Наши преимущества',
      items: [],
      columns: 3,
    },
  },
  {
    type: 'timeline',
    name: 'Таймлайн',
    description: 'Этапы работы или история',
    category: 'info',
    icon: 'timeline',
    component: 'Timeline',
    defaultProps: {
      type: 'timeline',
      title: 'Этапы работы',
      items: [],
    },
  },
  {
    type: 'stats',
    name: 'Статистика',
    description: 'Числа с анимацией счётчика',
    category: 'info',
    icon: 'chart-bar',
    component: 'Stats',
    defaultProps: {
      type: 'stats',
      items: [],
      variant: 'default',
    },
  },
  {
    type: 'team',
    name: 'Команда',
    description: 'Карточки членов команды',
    category: 'info',
    icon: 'users',
    component: 'Team',
    defaultProps: {
      type: 'team',
      title: 'Наша команда',
      members: [],
    },
  },
  {
    type: 'partners',
    name: 'Партнёры',
    description: 'Логотипы партнёров/клиентов',
    category: 'info',
    icon: 'building',
    component: 'Partners',
    defaultProps: {
      type: 'partners',
      logos: [],
      grayscale: true,
    },
  },

  // Social-style Sections
  {
    type: 'instagramFeed',
    name: 'Instagram Feed',
    description: 'Лента в стиле Instagram',
    category: 'social',
    icon: 'brand-instagram',
    component: 'InstagramFeed',
    defaultProps: {
      type: 'instagramFeed',
      posts: [],
    },
  },
  {
    type: 'facebookPost',
    name: 'Facebook Post',
    description: 'Пост в стиле Facebook',
    category: 'social',
    icon: 'brand-facebook',
    component: 'FacebookPost',
    defaultProps: {
      type: 'facebookPost',
      author: { name: '', avatar: '', verified: false },
      date: '',
      content: '',
    },
  },
];

// ===========================================
// HELPER FUNCTIONS
// ===========================================

/**
 * Get section metadata by type
 */
export function getSectionMeta(type: string): SectionMeta | undefined {
  return sectionsRegistry.find(s => s.type === type);
}

/**
 * Get all sections grouped by category
 */
export function getSectionsByCategory(): Record<SectionCategory, SectionMeta[]> {
  const grouped: Record<SectionCategory, SectionMeta[]> = {
    hero: [],
    content: [],
    media: [],
    conversion: [],
    info: [],
    social: [],
  };

  sectionsRegistry.forEach(section => {
    grouped[section.category].push(section);
  });

  return grouped;
}

/**
 * Get section component name by type
 */
export function getSectionComponent(type: string): string | undefined {
  return getSectionMeta(type)?.component;
}

/**
 * Get default props for section type
 */
export function getSectionDefaultProps(type: string): Partial<Section> | undefined {
  return getSectionMeta(type)?.defaultProps;
}

/**
 * Get all available section types
 */
export function getAvailableSectionTypes(): string[] {
  return sectionsRegistry.map(s => s.type);
}

/**
 * Check if section type is valid
 */
export function isValidSectionType(type: string): boolean {
  return sectionsRegistry.some(s => s.type === type);
}

export default {
  sectionsRegistry,
  categoryLabels,
  getSectionMeta,
  getSectionsByCategory,
  getSectionComponent,
  getSectionDefaultProps,
  getAvailableSectionTypes,
  isValidSectionType,
};
