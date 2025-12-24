/**
 * Theme Configuration - Дизайн-система для Landing Builder
 *
 * Централизованное управление всеми визуальными параметрами:
 * - Цвета (светлая/тёмная тема)
 * - Типографика
 * - Отступы и размеры
 * - Тени и радиусы
 * - Анимации
 *
 * Этот файл генерирует CSS переменные для использования в компонентах
 */

export interface ThemeColors {
  // Primary palette (синий деловой стиль)
  primary: string;
  primaryHover: string;
  primaryActive: string;
  primaryLight: string;
  primaryDark: string;

  // Secondary palette
  secondary: string;
  secondaryHover: string;
  secondaryLight: string;

  // Accent colors
  accent: string;
  accentHover: string;

  // Semantic colors
  success: string;
  successLight: string;
  warning: string;
  warningLight: string;
  error: string;
  errorLight: string;
  info: string;
  infoLight: string;

  // Backgrounds
  background: string;
  backgroundSecondary: string;
  backgroundTertiary: string;
  surface: string;
  surfaceHover: string;

  // Text
  text: string;
  textSecondary: string;
  textMuted: string;
  textInverse: string;

  // Borders
  border: string;
  borderLight: string;
  borderDark: string;

  // Overlays
  overlay: string;
  overlayLight: string;
}

export interface ThemeTypography {
  // Font families
  fontFamily: string;
  fontFamilyHeading: string;
  fontFamilyMono: string;

  // Font sizes (rem)
  fontSizeXs: string;
  fontSizeSm: string;
  fontSizeBase: string;
  fontSizeLg: string;
  fontSizeXl: string;
  fontSize2xl: string;
  fontSize3xl: string;
  fontSize4xl: string;
  fontSize5xl: string;
  fontSize6xl: string;

  // Line heights
  lineHeightTight: string;
  lineHeightBase: string;
  lineHeightRelaxed: string;

  // Font weights
  fontWeightNormal: string;
  fontWeightMedium: string;
  fontWeightSemibold: string;
  fontWeightBold: string;

  // Letter spacing
  letterSpacingTight: string;
  letterSpacingNormal: string;
  letterSpacingWide: string;
}

export interface ThemeSpacing {
  // Base spacing scale (rem)
  spacing0: string;
  spacing1: string;
  spacing2: string;
  spacing3: string;
  spacing4: string;
  spacing5: string;
  spacing6: string;
  spacing8: string;
  spacing10: string;
  spacing12: string;
  spacing16: string;
  spacing20: string;
  spacing24: string;
  spacing32: string;

  // Container widths
  containerSm: string;
  containerMd: string;
  containerLg: string;
  containerXl: string;
  container2xl: string;

  // Section padding
  sectionPaddingY: string;
  sectionPaddingYMobile: string;
}

export interface ThemeEffects {
  // Border radius
  radiusNone: string;
  radiusSm: string;
  radiusMd: string;
  radiusLg: string;
  radiusXl: string;
  radius2xl: string;
  radiusFull: string;

  // Shadows
  shadowNone: string;
  shadowSm: string;
  shadowMd: string;
  shadowLg: string;
  shadowXl: string;
  shadow2xl: string;
  shadowInner: string;

  // Transitions
  transitionFast: string;
  transitionBase: string;
  transitionSlow: string;

  // Z-index
  zIndexDropdown: string;
  zIndexSticky: string;
  zIndexFixed: string;
  zIndexModal: string;
  zIndexPopover: string;
  zIndexTooltip: string;
}

export interface ThemeBreakpoints {
  sm: string;
  md: string;
  lg: string;
  xl: string;
  '2xl': string;
}

export interface ThemeConfig {
  name: string;
  colors: {
    light: ThemeColors;
    dark: ThemeColors;
  };
  typography: ThemeTypography;
  spacing: ThemeSpacing;
  effects: ThemeEffects;
  breakpoints: ThemeBreakpoints;
}

/**
 * Default Theme Configuration
 * Строгий деловой стиль с синим как основным цветом
 */
export const defaultTheme: ThemeConfig = {
  name: 'business-blue',

  colors: {
    // Светлая тема
    light: {
      // Primary - синий деловой
      primary: '#1e40af',        // Blue 800
      primaryHover: '#1d4ed8',   // Blue 700
      primaryActive: '#1e3a8a',  // Blue 900
      primaryLight: '#dbeafe',   // Blue 100
      primaryDark: '#172554',    // Blue 950

      // Secondary - серый стальной
      secondary: '#475569',      // Slate 600
      secondaryHover: '#334155', // Slate 700
      secondaryLight: '#f1f5f9', // Slate 100

      // Accent - тёмно-синий
      accent: '#0369a1',         // Sky 700
      accentHover: '#0284c7',    // Sky 600

      // Semantic
      success: '#059669',        // Emerald 600
      successLight: '#d1fae5',   // Emerald 100
      warning: '#d97706',        // Amber 600
      warningLight: '#fef3c7',   // Amber 100
      error: '#dc2626',          // Red 600
      errorLight: '#fee2e2',     // Red 100
      info: '#0284c7',           // Sky 600
      infoLight: '#e0f2fe',      // Sky 100

      // Backgrounds
      background: '#ffffff',
      backgroundSecondary: '#f8fafc',  // Slate 50
      backgroundTertiary: '#f1f5f9',   // Slate 100
      surface: '#ffffff',
      surfaceHover: '#f8fafc',

      // Text
      text: '#0f172a',           // Slate 900
      textSecondary: '#475569',  // Slate 600
      textMuted: '#94a3b8',      // Slate 400
      textInverse: '#ffffff',

      // Borders
      border: '#e2e8f0',         // Slate 200
      borderLight: '#f1f5f9',    // Slate 100
      borderDark: '#cbd5e1',     // Slate 300

      // Overlays
      overlay: 'rgba(15, 23, 42, 0.5)',
      overlayLight: 'rgba(15, 23, 42, 0.3)',
    },

    // Тёмная тема
    dark: {
      // Primary - синий деловой
      primary: '#3b82f6',        // Blue 500
      primaryHover: '#60a5fa',   // Blue 400
      primaryActive: '#2563eb',  // Blue 600
      primaryLight: '#1e3a8a',   // Blue 900
      primaryDark: '#93c5fd',    // Blue 300

      // Secondary
      secondary: '#94a3b8',      // Slate 400
      secondaryHover: '#cbd5e1', // Slate 300
      secondaryLight: '#334155', // Slate 700

      // Accent
      accent: '#38bdf8',         // Sky 400
      accentHover: '#7dd3fc',    // Sky 300

      // Semantic
      success: '#34d399',        // Emerald 400
      successLight: '#064e3b',   // Emerald 900
      warning: '#fbbf24',        // Amber 400
      warningLight: '#78350f',   // Amber 900
      error: '#f87171',          // Red 400
      errorLight: '#7f1d1d',     // Red 900
      info: '#38bdf8',           // Sky 400
      infoLight: '#0c4a6e',      // Sky 900

      // Backgrounds
      background: '#0f172a',     // Slate 900
      backgroundSecondary: '#1e293b', // Slate 800
      backgroundTertiary: '#334155',  // Slate 700
      surface: '#1e293b',
      surfaceHover: '#334155',

      // Text
      text: '#f8fafc',           // Slate 50
      textSecondary: '#cbd5e1',  // Slate 300
      textMuted: '#64748b',      // Slate 500
      textInverse: '#0f172a',

      // Borders
      border: '#334155',         // Slate 700
      borderLight: '#1e293b',    // Slate 800
      borderDark: '#475569',     // Slate 600

      // Overlays
      overlay: 'rgba(0, 0, 0, 0.7)',
      overlayLight: 'rgba(0, 0, 0, 0.5)',
    },
  },

  typography: {
    // Font families
    fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
    fontFamilyHeading: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
    fontFamilyMono: "'JetBrains Mono', 'Fira Code', Consolas, monospace",

    // Font sizes
    fontSizeXs: '0.75rem',      // 12px
    fontSizeSm: '0.875rem',     // 14px
    fontSizeBase: '1rem',       // 16px
    fontSizeLg: '1.125rem',     // 18px
    fontSizeXl: '1.25rem',      // 20px
    fontSize2xl: '1.5rem',      // 24px
    fontSize3xl: '1.875rem',    // 30px
    fontSize4xl: '2.25rem',     // 36px
    fontSize5xl: '3rem',        // 48px
    fontSize6xl: '3.75rem',     // 60px

    // Line heights
    lineHeightTight: '1.25',
    lineHeightBase: '1.5',
    lineHeightRelaxed: '1.75',

    // Font weights
    fontWeightNormal: '400',
    fontWeightMedium: '500',
    fontWeightSemibold: '600',
    fontWeightBold: '700',

    // Letter spacing
    letterSpacingTight: '-0.025em',
    letterSpacingNormal: '0',
    letterSpacingWide: '0.025em',
  },

  spacing: {
    // Base scale
    spacing0: '0',
    spacing1: '0.25rem',   // 4px
    spacing2: '0.5rem',    // 8px
    spacing3: '0.75rem',   // 12px
    spacing4: '1rem',      // 16px
    spacing5: '1.25rem',   // 20px
    spacing6: '1.5rem',    // 24px
    spacing8: '2rem',      // 32px
    spacing10: '2.5rem',   // 40px
    spacing12: '3rem',     // 48px
    spacing16: '4rem',     // 64px
    spacing20: '5rem',     // 80px
    spacing24: '6rem',     // 96px
    spacing32: '8rem',     // 128px

    // Containers
    containerSm: '640px',
    containerMd: '768px',
    containerLg: '1024px',
    containerXl: '1280px',
    container2xl: '1536px',

    // Section padding
    sectionPaddingY: '5rem',      // 80px
    sectionPaddingYMobile: '3rem', // 48px
  },

  effects: {
    // Border radius
    radiusNone: '0',
    radiusSm: '0.25rem',   // 4px
    radiusMd: '0.375rem',  // 6px
    radiusLg: '0.5rem',    // 8px
    radiusXl: '0.75rem',   // 12px
    radius2xl: '1rem',     // 16px
    radiusFull: '9999px',

    // Shadows
    shadowNone: 'none',
    shadowSm: '0 1px 2px 0 rgba(0, 0, 0, 0.05)',
    shadowMd: '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -2px rgba(0, 0, 0, 0.1)',
    shadowLg: '0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -4px rgba(0, 0, 0, 0.1)',
    shadowXl: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 8px 10px -6px rgba(0, 0, 0, 0.1)',
    shadow2xl: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
    shadowInner: 'inset 0 2px 4px 0 rgba(0, 0, 0, 0.05)',

    // Transitions
    transitionFast: '150ms ease-in-out',
    transitionBase: '200ms ease-in-out',
    transitionSlow: '300ms ease-in-out',

    // Z-index
    zIndexDropdown: '1000',
    zIndexSticky: '1020',
    zIndexFixed: '1030',
    zIndexModal: '1040',
    zIndexPopover: '1050',
    zIndexTooltip: '1060',
  },

  breakpoints: {
    sm: '640px',
    md: '768px',
    lg: '1024px',
    xl: '1280px',
    '2xl': '1536px',
  },
};

/**
 * Generate CSS variables from theme config
 */
export function generateCSSVariables(theme: ThemeConfig = defaultTheme): string {
  const { colors, typography, spacing, effects } = theme;

  // Helper to convert camelCase to kebab-case
  const toKebab = (str: string) => str.replace(/([a-z])([A-Z])/g, '$1-$2').toLowerCase();

  // Generate color variables for a theme mode
  const generateColorVars = (colorSet: ThemeColors, prefix: string = '') => {
    return Object.entries(colorSet)
      .map(([key, value]) => `  --color-${toKebab(key)}: ${value};`)
      .join('\n');
  };

  // Generate variables from an object
  const generateVars = (obj: Record<string, string>, prefix: string) => {
    return Object.entries(obj)
      .map(([key, value]) => `  --${prefix}-${toKebab(key)}: ${value};`)
      .join('\n');
  };

  return `
/* ===========================================
   CSS Variables - Generated from theme.config.ts
   Theme: ${theme.name}
   =========================================== */

:root {
  /* Typography */
${generateVars(typography, 'font')}

  /* Spacing */
${generateVars(spacing, 'spacing')}

  /* Effects */
${generateVars(effects, 'effect')}

  /* Light Theme Colors (default) */
${generateColorVars(colors.light)}
}

/* Dark Theme Colors */
[data-theme="dark"] {
${generateColorVars(colors.dark)}
}

/* System preference dark mode */
@media (prefers-color-scheme: dark) {
  :root:not([data-theme="light"]) {
${generateColorVars(colors.dark)}
  }
}
`.trim();
}

/**
 * Get current theme from localStorage or system preference
 */
export function getCurrentTheme(): 'light' | 'dark' {
  if (typeof window === 'undefined') return 'light';

  const stored = localStorage.getItem('theme');
  if (stored === 'light' || stored === 'dark') return stored;

  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

/**
 * Set theme and persist to localStorage
 */
export function setTheme(theme: 'light' | 'dark' | 'system'): void {
  if (typeof window === 'undefined') return;

  if (theme === 'system') {
    localStorage.removeItem('theme');
    document.documentElement.removeAttribute('data-theme');
  } else {
    localStorage.setItem('theme', theme);
    document.documentElement.setAttribute('data-theme', theme);
  }
}

/**
 * Initialize theme on page load
 */
export function initTheme(): void {
  if (typeof window === 'undefined') return;

  const theme = getCurrentTheme();
  document.documentElement.setAttribute('data-theme', theme);
}

export default defaultTheme;
