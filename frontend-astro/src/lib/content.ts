/**
 * Content Provider - унифицированный доступ к контенту
 * Поддержка: MD файлы (Content Collections) и API (SQLite)
 */
import { getCollection, getEntry, type CollectionEntry } from 'astro:content';

// ==========================================
// TYPES
// ==========================================

export interface ContentSource {
  type: 'md' | 'api';
}

export interface PostFilters {
  category?: string;
  tag?: string;
  limit?: number;
  offset?: number;
  featured?: boolean;
  draft?: boolean;
}

// ==========================================
// MD CONTENT (Content Collections)
// ==========================================

/**
 * Получить все посты из MD файлов
 */
export async function getMdPosts(filters: PostFilters = {}): Promise<CollectionEntry<'blog'>[]> {
  const allPosts = await getCollection('blog', ({ data }) => {
    // Фильтруем черновики в production
    if (import.meta.env.PROD && data.draft) {
      return false;
    }
    return true;
  });

  let posts = allPosts;

  // Фильтр по категории
  if (filters.category) {
    posts = posts.filter((post) => post.data.category === filters.category);
  }

  // Фильтр по тегу
  if (filters.tag) {
    posts = posts.filter((post) => post.data.tags?.includes(filters.tag!));
  }

  // Фильтр по featured
  if (filters.featured !== undefined) {
    posts = posts.filter((post) => post.data.featured === filters.featured);
  }

  // Сортировка по дате публикации (новые первые)
  posts.sort((a, b) => {
    return new Date(b.data.publishedAt).getTime() - new Date(a.data.publishedAt).getTime();
  });

  // Pagination
  if (filters.offset) {
    posts = posts.slice(filters.offset);
  }
  if (filters.limit) {
    posts = posts.slice(0, filters.limit);
  }

  return posts;
}

/**
 * Получить один пост по slug
 */
export async function getMdPost(slug: string): Promise<CollectionEntry<'blog'> | undefined> {
  return await getEntry('blog', slug);
}

/**
 * Получить все уникальные категории
 */
export async function getMdCategories(): Promise<string[]> {
  const posts = await getCollection('blog');
  const categories = new Set<string>();

  posts.forEach((post) => {
    if (post.data.category) {
      categories.add(post.data.category);
    }
  });

  return Array.from(categories).sort();
}

/**
 * Получить все уникальные теги
 */
export async function getMdTags(): Promise<string[]> {
  const posts = await getCollection('blog');
  const tags = new Set<string>();

  posts.forEach((post) => {
    post.data.tags?.forEach((tag) => tags.add(tag));
  });

  return Array.from(tags).sort();
}

/**
 * Получить статическую страницу
 */
export async function getMdPage(slug: string): Promise<CollectionEntry<'pages'> | undefined> {
  return await getEntry('pages', slug);
}

/**
 * Получить все статические страницы
 */
export async function getMdPages(): Promise<CollectionEntry<'pages'>[]> {
  const pages = await getCollection('pages', ({ data }) => {
    if (import.meta.env.PROD && data.draft) {
      return false;
    }
    return true;
  });

  return pages;
}

// ==========================================
// API CONTENT (SQLite через Hono)
// ==========================================

const API_URL = import.meta.env.PUBLIC_API_URL || 'http://localhost:3001';

/**
 * Универсальный fetch с обработкой ошибок
 */
async function apiFetch<T>(endpoint: string): Promise<T | null> {
  try {
    const response = await fetch(`${API_URL}${endpoint}`);
    if (!response.ok) {
      console.error(`API Error: ${response.status} ${response.statusText}`);
      return null;
    }
    return await response.json();
  } catch (error) {
    console.error('API fetch error:', error);
    return null;
  }
}

/**
 * Получить посты из API
 */
export async function getApiPosts(filters: PostFilters = {}): Promise<any[]> {
  const params = new URLSearchParams();

  if (filters.category) params.set('category', filters.category);
  if (filters.tag) params.set('tag', filters.tag);
  if (filters.limit) params.set('limit', String(filters.limit));
  if (filters.offset) params.set('offset', String(filters.offset));
  if (filters.featured !== undefined) params.set('featured', String(filters.featured));

  const query = params.toString() ? `?${params.toString()}` : '';
  const posts = await apiFetch<any[]>(`/api/posts${query}`);

  return posts || [];
}

/**
 * Получить один пост из API по slug
 */
export async function getApiPost(slug: string): Promise<any | null> {
  return await apiFetch(`/api/posts/${slug}`);
}

/**
 * Получить категории из API
 */
export async function getApiCategories(): Promise<any[]> {
  const categories = await apiFetch<any[]>('/api/categories');
  return categories || [];
}

/**
 * Получить теги из API
 */
export async function getApiTags(): Promise<any[]> {
  const tags = await apiFetch<any[]>('/api/tags');
  return tags || [];
}

// ==========================================
// UNIFIED CONTENT (комбинированный доступ)
// ==========================================

export type ContentSourceType = 'md' | 'api' | 'both';

/**
 * Получить посты из указанного источника
 */
export async function getPosts(
  source: ContentSourceType = 'md',
  filters: PostFilters = {}
) {
  switch (source) {
    case 'md':
      return await getMdPosts(filters);
    case 'api':
      return await getApiPosts(filters);
    case 'both':
      // Объединяем оба источника
      const [mdPosts, apiPosts] = await Promise.all([
        getMdPosts(filters),
        getApiPosts(filters),
      ]);
      // TODO: Нормализовать структуру и объединить
      return [...mdPosts, ...apiPosts];
    default:
      return await getMdPosts(filters);
  }
}

// ==========================================
// HELPERS
// ==========================================

/**
 * Подсчет времени чтения
 */
export function calculateReadingTime(content: string): string {
  const wordsPerMinute = 200;
  const wordCount = content.split(/\s+/).length;
  const minutes = Math.ceil(wordCount / wordsPerMinute);
  return `${minutes} мин.`;
}

/**
 * Генерация excerpt из контента
 */
export function generateExcerpt(content: string, maxLength: number = 160): string {
  // Удаляем markdown разметку
  const plainText = content
    .replace(/#{1,6}\s/g, '') // заголовки
    .replace(/\*\*|__/g, '') // bold
    .replace(/\*|_/g, '') // italic
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1') // ссылки
    .replace(/`{1,3}[^`]*`{1,3}/g, '') // code
    .replace(/\n+/g, ' ') // переносы строк
    .trim();

  if (plainText.length <= maxLength) {
    return plainText;
  }

  return plainText.substring(0, maxLength).trim() + '...';
}
