---
name: telegram-miniapp-production
description: Production-ready Telegram Mini App (WebApp) development skill. Use when building or deploying Telegram Mini Apps that require initData validation, QR code scanning, MainButton/BackButton UI, HapticFeedback, CloudStorage, theme synchronization, or HTTPS deployment. Essential for passing Telegram's moderation requirements and building secure, user-friendly Mini Apps integrated with Telegram client.
---

# Telegram Mini App Production

## Overview

This skill provides production-ready patterns, security best practices, and code examples for building Telegram Mini Apps (WebApps). It covers critical requirements for passing Telegram's moderation, ensuring security through initData validation, and leveraging native Telegram UI components.

**Use this skill when:**
- Validating Telegram `initData` to prevent spoofing attacks
- Implementing QR code scanning via Telegram's native scanner
- Adding MainButton, BackButton, or other native UI controls
- Working with CloudStorage for persistent user data
- Syncing app theme with Telegram client
- Deploying Mini Apps with HTTPS requirements
- Integrating HapticFeedback for better UX
- Debugging Telegram WebApp API issues

## Core Capabilities

### 1. InitData Validation (Critical Security)

**Why:** Telegram sends user data via `initDataUnsafe` which can be spoofed. Always validate `initData` on the backend using HMAC SHA-256 with your bot token.

**Frontend Integration:**
```typescript
// Send initData to backend for validation
const initData = window.Telegram.WebApp.initData;

const response = await fetch('/api/telegram/auth', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ initData })
});

if (!response.ok) {
  // Validation failed - possible spoofing attack
  window.Telegram.WebApp.close();
}
```

**Backend Validation (use script):**
See `scripts/validate_init_data.ts` for complete implementation. The script provides:
- HMAC SHA-256 validation against bot token
- Query string parsing and reconstruction
- Timing-safe comparison to prevent timing attacks
- TypeScript types for validated user data

**Key points:**
- NEVER trust `initDataUnsafe` without backend validation
- Validation MUST happen on server-side (bot token is secret)
- Use timing-safe comparison functions
- Check `auth_date` to prevent replay attacks (max age: 24 hours recommended)

### 2. QR Code Scanner

**Why:** Telegram provides native QR scanner with better UX than web-based solutions (camera permissions, better scanning). Perfect for loyalty cards, payment codes, authentication.

**Implementation:**
```typescript
function scanQRCode(): Promise<string> {
  return new Promise((resolve, reject) => {
    window.Telegram.WebApp.showScanQrPopup({
      text: 'Отсканируйте QR-код карты лояльности'
    }, (data) => {
      if (data) {
        // QR scanned successfully
        window.Telegram.WebApp.closeScanQrPopup();
        resolve(data);
        return true; // Stop scanning
      }
      return false; // Continue scanning
    });
  });
}

// Usage in cashier interface
try {
  const qrData = await scanQRCode();
  const parsed = parseQRData(qrData); // Validate & parse

  // Process loyalty card
  window.Telegram.WebApp.HapticFeedback.notificationOccurred('success');
} catch (error) {
  window.Telegram.WebApp.HapticFeedback.notificationOccurred('error');
  showToast('Ошибка сканирования');
}
```

**Best practices:**
- Always provide descriptive `text` parameter (what user should scan)
- Close popup explicitly after successful scan
- Return `true` to stop scanning, `false` to continue
- Add haptic feedback for success/error
- Validate scanned data on backend (could be malicious)

### 3. MainButton & BackButton

**MainButton** - Primary action button fixed at bottom of the screen. Essential for conversion flows (checkout, confirmation, etc.).

**Implementation:**
```typescript
const mainButton = window.Telegram.WebApp.MainButton;

// Configure button
mainButton.setText('Начислить баллы');
mainButton.color = '#ff6b00'; // Your brand color
mainButton.textColor = '#ffffff';

// Show with loading state
mainButton.show();
mainButton.showProgress(false); // false = disable button

// Handle click
mainButton.onClick(() => {
  mainButton.showProgress(true); // Show loading

  processTransaction()
    .then(() => {
      mainButton.hideProgress();
      mainButton.hide();
      window.Telegram.WebApp.HapticFeedback.notificationOccurred('success');
    })
    .catch(() => {
      mainButton.hideProgress();
      window.Telegram.WebApp.HapticFeedback.notificationOccurred('error');
    });
});

// Cleanup on page leave
onDestroy(() => {
  mainButton.offClick();
  mainButton.hide();
});
```

**BackButton** - Top-left back button for navigation.

```typescript
const backButton = window.Telegram.WebApp.BackButton;

// Show when entering nested view
backButton.show();

backButton.onClick(() => {
  // Handle navigation
  goto('/previous-page');
});

// Hide when returning to root
onDestroy(() => {
  backButton.offClick();
  backButton.hide();
});
```

**Critical rules:**
- ALWAYS call `offClick()` before re-attaching handlers (prevents duplicates)
- Hide MainButton when not needed (don't leave disabled button visible)
- Match MainButton color to your brand (use `themeParams.button_color`)
- Use `showProgress()` for async operations (prevents double-clicks)

### 4. HapticFeedback

**Why:** Provides tactile feedback for better UX. Works on iOS/Android (vibration).

**Types:**
```typescript
const haptic = window.Telegram.WebApp.HapticFeedback;

// Notifications (recommended for most cases)
haptic.notificationOccurred('success'); // Light success vibration
haptic.notificationOccurred('warning'); // Medium warning vibration
haptic.notificationOccurred('error');   // Strong error vibration

// Impact (for UI interactions)
haptic.impactOccurred('light');  // Soft tap
haptic.impactOccurred('medium'); // Button press
haptic.impactOccurred('heavy');  // Important action
haptic.impactOccurred('rigid');  // Precise interaction
haptic.impactOccurred('soft');   // Smooth interaction

// Selection (for pickers/sliders)
haptic.selectionChanged(); // Tick when scrolling through options
```

**Best practices:**
- Use `notificationOccurred('success')` after successful operations
- Use `notificationOccurred('error')` for errors
- Use `impactOccurred('light')` for button taps
- Use `selectionChanged()` in pickers/carousels
- Don't overuse - haptics should enhance, not annoy

### 5. CloudStorage (Persistent User Data)

**Why:** Store user preferences, settings, or small data (up to 1024 keys, each up to 4096 bytes). Data persists across sessions and devices.

**Implementation:**
```typescript
const storage = window.Telegram.WebApp.CloudStorage;

// Save theme preference
storage.setItem('theme', 'dark', (error) => {
  if (error) {
    console.error('Failed to save theme:', error);
  }
});

// Load theme preference
storage.getItem('theme', (error, value) => {
  if (!error && value) {
    applyTheme(value);
  }
});

// Save multiple values
storage.setItems([
  { key: 'language', value: 'ru' },
  { key: 'notifications', value: 'enabled' }
], (error) => {
  if (error) console.error('Failed to save settings:', error);
});

// Get multiple values
storage.getItems(['language', 'notifications'], (error, values) => {
  if (!error) {
    console.log(values); // { language: 'ru', notifications: 'enabled' }
  }
});

// Delete value
storage.removeItem('old_setting');

// Get all keys
storage.getKeys((error, keys) => {
  console.log('Stored keys:', keys);
});
```

**Limitations:**
- Max 1024 keys per user
- Max 4096 bytes per value (strings only)
- NOT suitable for large data (use backend database)
- Async operations (callbacks or promisify)

**Use cases:**
- User preferences (theme, language, notifications)
- Feature flags (onboarding completed, tutorial seen)
- Small user-specific data (selected store, favorite category)

### 6. Theme Synchronization

**Why:** Mini Apps should match Telegram's theme (light/dark mode). Improves UX consistency.

**Implementation:**
```typescript
const themeParams = window.Telegram.WebApp.themeParams;
const colorScheme = window.Telegram.WebApp.colorScheme; // 'light' | 'dark'

// Apply theme on load
function applyTelegramTheme() {
  document.documentElement.style.setProperty('--tg-bg-color', themeParams.bg_color);
  document.documentElement.style.setProperty('--tg-text-color', themeParams.text_color);
  document.documentElement.style.setProperty('--tg-hint-color', themeParams.hint_color);
  document.documentElement.style.setProperty('--tg-link-color', themeParams.link_color);
  document.documentElement.style.setProperty('--tg-button-color', themeParams.button_color);
  document.documentElement.style.setProperty('--tg-button-text-color', themeParams.button_text_color);

  // Set color scheme class
  document.documentElement.setAttribute('data-theme', colorScheme);
}

// Listen for theme changes
window.Telegram.WebApp.onEvent('themeChanged', () => {
  applyTelegramTheme();
});

// Initial application
applyTelegramTheme();
```

**CSS Usage:**
```css
:root {
  /* Use Telegram colors */
  background-color: var(--tg-bg-color);
  color: var(--tg-text-color);
}

button.primary {
  background-color: var(--tg-button-color);
  color: var(--tg-button-text-color);
}

a {
  color: var(--tg-link-color);
}

/* Theme-specific overrides */
[data-theme="dark"] {
  /* Dark mode specific styles */
}
```

**Available theme parameters:**
- `bg_color` - Main background
- `text_color` - Primary text
- `hint_color` - Secondary text
- `link_color` - Links
- `button_color` - Primary button background
- `button_text_color` - Primary button text
- `secondary_bg_color` - Secondary background (cards, panels)

### 7. Viewport Management

**Why:** Telegram WebApps can be expanded to full screen. Detect viewport changes to adjust UI.

**Implementation:**
```typescript
// Expand to full screen on load
window.Telegram.WebApp.expand();

// Disable closing confirmation (user can close without warning)
window.Telegram.WebApp.disableClosingConfirmation();

// Enable closing confirmation for unsaved changes
window.Telegram.WebApp.enableClosingConfirmation();

// Listen for viewport changes
window.Telegram.WebApp.onEvent('viewportChanged', (event) => {
  const { isStateStable, height } = event;

  if (isStateStable) {
    // Viewport animation finished - safe to measure/adjust UI
    adjustLayoutForHeight(height);
  }
});

// Get current viewport info
const { height, isExpanded } = window.Telegram.WebApp;
```

**Best practices:**
- Call `expand()` immediately on load (better UX)
- Use `disableClosingConfirmation()` for read-only apps
- Use `enableClosingConfirmation()` for forms with unsaved data
- Handle `viewportChanged` for responsive layouts
- Check `isStateStable` before measuring DOM elements

### 8. Safe Area & Mobile Layout

**Why:** iOS devices have notches, rounded corners, home indicators. Telegram provides safe area insets.

**CSS Implementation:**
```css
/* Use Telegram's CSS variables for safe areas */
.header {
  padding-top: max(16px, env(safe-area-inset-top));
}

.bottom-nav {
  padding-bottom: max(16px, env(safe-area-inset-bottom));
}

.content {
  padding-left: env(safe-area-inset-left);
  padding-right: env(safe-area-inset-right);
}

/* Full viewport height accounting for safe area */
.full-screen {
  height: 100vh;
  height: calc(var(--tg-viewport-height, 100vh) - env(safe-area-inset-bottom));
}
```

**Viewport meta tag (required):**
```html
<meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no, viewport-fit=cover">
```

**Note:** `viewport-fit=cover` is critical for safe area insets to work.

### 9. Links & Navigation

**Why:** Links behave differently in Telegram Mini Apps. External links open in Telegram's in-app browser.

**Implementation:**
```typescript
// Open external link in Telegram browser
window.Telegram.WebApp.openLink('https://example.com');

// Open link in external browser (requires user confirmation)
window.Telegram.WebApp.openLink('https://example.com', { try_instant_view: true });

// Open Telegram link (user profile, channel, bot)
window.Telegram.WebApp.openTelegramLink('https://t.me/username');

// Check if link can be opened
const canOpen = window.Telegram.WebApp.isVersionAtLeast('6.1'); // openLink added in 6.1
```

**Best practices:**
- Use `openLink()` for external URLs (keeps user in Telegram)
- Use `openTelegramLink()` for t.me links (better UX)
- Always check version with `isVersionAtLeast()` before using new APIs
- Avoid `target="_blank"` in `<a>` tags (doesn't work as expected)

### 10. Version Detection & Graceful Degradation

**Why:** Telegram updates WebApp API frequently. New features aren't available in old clients.

**Implementation:**
```typescript
// Check if feature is available
if (window.Telegram.WebApp.isVersionAtLeast('6.2')) {
  // Use QR Scanner (added in 6.2)
  window.Telegram.WebApp.showScanQrPopup(options, callback);
} else {
  // Fallback: manual input
  showManualInputDialog();
}

// Check specific features
const hasCloudStorage = window.Telegram.WebApp.CloudStorage !== undefined;
const hasMainButton = window.Telegram.WebApp.MainButton !== undefined;

// Get current version
const version = window.Telegram.WebApp.version; // e.g., "6.4"
```

**Version history (critical features):**
- 6.0: Basic WebApp API
- 6.1: MainButton, HapticFeedback
- 6.2: QR Scanner (`showScanQrPopup`)
- 6.4: CloudStorage
- 6.9: BackButton
- 7.0: Theme events

**Best practice:** Always provide fallbacks for critical features.

## Security Best Practices

See `references/security_best_practices.md` for comprehensive security guidelines including:
- InitData validation (HMAC SHA-256 implementation)
- CSRF protection for Mini Apps
- Rate limiting for API endpoints
- Input sanitization for QR data
- Secure storage of bot token
- HTTPS requirements and CSP headers

## Deployment Checklist

See `references/deployment_checklist.md` for production deployment requirements including:
- HTTPS/SSL certificate setup
- Domain configuration for Telegram
- CSP headers configuration
- nginx reverse proxy setup
- Bot token security
- Testing in all Telegram clients (iOS, Android, Desktop, Web)

## TypeScript Types

Use `scripts/telegram_types.d.ts` for complete TypeScript definitions of Telegram WebApp API. Import in your project:

```typescript
/// <reference path="./telegram_types.d.ts" />

// Now you have full autocomplete and type safety
const webApp: TelegramWebApp = window.Telegram.WebApp;
```

## Debugging

**Enable debug mode:**
```typescript
// Show debug info in Telegram client (iOS/Android)
window.Telegram.WebApp.isVersionAtLeast('6.1') && console.log(window.Telegram.WebApp);
```

**Common issues:**
1. **InitData empty in dev** - Use Telegram Bot Father to create test environment URL
2. **CORS errors** - Add `https://web.telegram.org` to allowed origins
3. **MainButton not showing** - Check if `show()` was called and version >= 6.1
4. **Theme not applied** - Check if `themeParams` is accessed after `ready()` event
5. **QR Scanner not working** - Check version >= 6.2 and provide fallback

**Testing:**
- Use @BotFather to set Mini App URL
- Test in Telegram iOS/Android/Desktop/Web (behavior differs!)
- Use Telegram Dev Tools (Desktop client)
- Test theme switching in Telegram settings
- Test on devices with notches (safe area)

## Resources

### scripts/
- **validate_init_data.ts** - Complete HMAC SHA-256 validation function for backend
- **telegram_types.d.ts** - TypeScript type definitions for Telegram WebApp API

### references/
- **telegram_webapp_api.md** - Complete Telegram WebApp API reference with all methods and events
- **security_best_practices.md** - Security guidelines for production Mini Apps
- **deployment_checklist.md** - Step-by-step deployment checklist for production

## Quick Reference

**Initialization:**
```typescript
window.Telegram.WebApp.ready();
window.Telegram.WebApp.expand();
```

**Most used APIs:**
```typescript
// User info (after validation!)
const user = window.Telegram.WebApp.initDataUnsafe.user;

// UI Controls
window.Telegram.WebApp.MainButton.setText('Action').show();
window.Telegram.WebApp.BackButton.show();

// Feedback
window.Telegram.WebApp.HapticFeedback.notificationOccurred('success');

// QR Scanner
window.Telegram.WebApp.showScanQrPopup(options, callback);

// Storage
window.Telegram.WebApp.CloudStorage.setItem('key', 'value');

// Theme
const theme = window.Telegram.WebApp.themeParams;
const colorScheme = window.Telegram.WebApp.colorScheme;
```

**Critical security rule:** ALWAYS validate `initData` on backend before trusting user identity.
