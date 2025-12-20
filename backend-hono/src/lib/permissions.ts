/**
 * Permission System - Phase 3
 *
 * Manages admin panel section permissions for users.
 * Sections are extensible for future modules (e-commerce, forms, analytics).
 */

// Available admin sections (extensible)
export const ADMIN_SECTIONS = {
  // Current sections
  pages: { label: 'Страницы', icon: 'file-text' },
  blocks: { label: 'Блоки', icon: 'box' },
  menus: { label: 'Меню', icon: 'menu' },
  media: { label: 'Медиа', icon: 'image' },
  settings: { label: 'Настройки', icon: 'settings' },

  // Phase 4: E-commerce sections
  products: { label: 'Товары', icon: 'shopping-cart' },
  orders: { label: 'Заказы', icon: 'package' },
  currencies: { label: 'Валюты', icon: 'currency' },

  // Future sections (uncomment when needed)
  // forms: { label: 'Формы', icon: 'mail' },
  // analytics: { label: 'Аналитика', icon: 'bar-chart' },
} as const;

export type AdminSection = keyof typeof ADMIN_SECTIONS;

export interface UserPermissions {
  [section: string]: boolean;
}

// Default permissions for new users (restricted)
export const DEFAULT_PERMISSIONS: UserPermissions = {
  pages: true,
  blocks: true,
  menus: true,
  media: true,
  settings: false,
  products: false,
  orders: false,
  currencies: false,
};

// Full permissions for site owners and superadmins
export const FULL_PERMISSIONS: UserPermissions = {
  pages: true,
  blocks: true,
  menus: true,
  media: true,
  settings: true,
  products: true,
  orders: true,
  currencies: true,
};

/**
 * Check if user has permission for a section
 */
export function hasPermission(permissionsJson: string, section: AdminSection): boolean {
  try {
    const permissions = JSON.parse(permissionsJson || '{}');
    return permissions[section] === true;
  } catch {
    return false;
  }
}

/**
 * Parse permissions JSON safely
 */
export function parsePermissions(permissionsJson: string): UserPermissions {
  try {
    return JSON.parse(permissionsJson || '{}');
  } catch {
    return {};
  }
}

/**
 * Get all sections as array for UI
 */
export function getAllSections(): Array<{
  key: AdminSection;
  label: string;
  icon: string;
}> {
  return Object.entries(ADMIN_SECTIONS).map(([key, value]) => ({
    key: key as AdminSection,
    ...value,
  }));
}

/**
 * Merge permissions with defaults
 */
export function mergeWithDefaults(permissions: UserPermissions): UserPermissions {
  return {
    ...DEFAULT_PERMISSIONS,
    ...permissions,
  };
}

/**
 * Validate permissions object
 */
export function validatePermissions(permissions: unknown): permissions is UserPermissions {
  if (typeof permissions !== 'object' || permissions === null) {
    return false;
  }

  const validKeys = Object.keys(ADMIN_SECTIONS);
  for (const key of Object.keys(permissions)) {
    if (!validKeys.includes(key)) {
      return false;
    }
    if (typeof (permissions as Record<string, unknown>)[key] !== 'boolean') {
      return false;
    }
  }

  return true;
}
