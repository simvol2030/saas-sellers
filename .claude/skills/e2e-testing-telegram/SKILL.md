---
name: e2e-testing-telegram
description: Production-ready навык для E2E тестирования Telegram Mini Apps с Playwright. Покрывает мокирование Telegram WebApp SDK, тестирование user flows (auth, payments, QR), visual regression, offline scenarios, CI/CD integration. Используется для обеспечения качества перед production deployment.
---

# E2E Testing for Telegram Mini Apps

Production-ready навык для comprehensive E2E тестирования Telegram Mini Apps с использованием Playwright. Покрывает мокирование Telegram WebApp SDK, автоматизацию user flows, visual regression тестирование, и CI/CD интеграцию.

## Когда использовать

- Нужно протестировать Telegram Mini App перед production
- Автоматизировать регрессионное тестирование
- Проверить critical user flows (login, payments, QR scanning)
- Тестировать offline functionality
- Выполнить visual regression testing
- Интегрировать тесты в CI/CD pipeline
- Обеспечить quality gate перед deployment

## Capabilities

### 1. Setup Playwright for Telegram WebApp

Настроить Playwright с мокированием Telegram WebApp SDK.

**Install Dependencies**:
```bash
npm install --save-dev @playwright/test
npm install --save-dev playwright
npx playwright install
```

**Playwright Configuration**:
```typescript
// playwright.config.ts
import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: [
    ['html'],
    ['junit', { outputFile: 'test-results/junit.xml' }],
    ['json', { outputFile: 'test-results/results.json' }]
  ],

  use: {
    baseURL: 'http://localhost:5173',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',

    // Emulate Telegram WebApp environment
    viewport: { width: 390, height: 844 }, // iPhone 14 Pro
    userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 Telegram/9.0',

    // Add Telegram init data
    extraHTTPHeaders: {
      'X-Telegram-Init-Data': 'query_id=...'  // Will be injected per test
    }
  },

  projects: [
    {
      name: 'telegram-ios',
      use: {
        ...devices['iPhone 14 Pro'],
        userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X) Telegram/9.0'
      }
    },
    {
      name: 'telegram-android',
      use: {
        ...devices['Pixel 7'],
        userAgent: 'Mozilla/5.0 (Linux; Android 13) Telegram/9.0'
      }
    },
    {
      name: 'telegram-desktop',
      use: {
        ...devices['Desktop Chrome'],
        userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Telegram/9.0'
      }
    }
  ],

  webServer: {
    command: 'npm run dev',
    url: 'http://localhost:5173',
    reuseExistingServer: !process.env.CI
  }
});
```

**Telegram WebApp Mock**:
```typescript
// tests/fixtures/telegram-mock.ts
import { Page } from '@playwright/test';

export interface TelegramUser {
  id: number;
  first_name: string;
  last_name?: string;
  username?: string;
  language_code?: string;
  is_premium?: boolean;
}

export interface TelegramWebAppData {
  user?: TelegramUser;
  auth_date: number;
  hash: string;
  query_id?: string;
  start_param?: string;
}

export async function injectTelegramWebApp(page: Page, userData?: TelegramUser) {
  const defaultUser: TelegramUser = {
    id: 123456789,
    first_name: 'Test',
    last_name: 'User',
    username: 'testuser',
    language_code: 'ru',
    is_premium: false,
    ...userData
  };

  const webAppData: TelegramWebAppData = {
    user: defaultUser,
    auth_date: Math.floor(Date.now() / 1000),
    hash: 'test_hash_abc123',
    query_id: 'test_query_id'
  };

  await page.addInitScript(({ user, auth_date, hash, query_id }) => {
    // Mock Telegram WebApp object
    (window as any).Telegram = {
      WebApp: {
        initData: `user=${encodeURIComponent(JSON.stringify(user))}&auth_date=${auth_date}&hash=${hash}&query_id=${query_id}`,
        initDataUnsafe: {
          user,
          auth_date,
          hash,
          query_id
        },
        version: '7.0',
        platform: 'ios',
        colorScheme: 'light',
        themeParams: {
          bg_color: '#ffffff',
          text_color: '#000000',
          hint_color: '#999999',
          link_color: '#168acd',
          button_color: '#40a7e3',
          button_text_color: '#ffffff',
          secondary_bg_color: '#f1f1f1'
        },
        isExpanded: true,
        viewportHeight: 844,
        viewportStableHeight: 844,
        headerColor: '#ffffff',
        backgroundColor: '#ffffff',
        isClosingConfirmationEnabled: false,
        BackButton: {
          isVisible: false,
          onClick: (callback: () => void) => {},
          offClick: (callback: () => void) => {},
          show: () => {},
          hide: () => {}
        },
        MainButton: {
          text: '',
          color: '#40a7e3',
          textColor: '#ffffff',
          isVisible: false,
          isActive: true,
          isProgressVisible: false,
          setText: (text: string) => {},
          onClick: (callback: () => void) => {},
          offClick: (callback: () => void) => {},
          show: () => {},
          hide: () => {},
          enable: () => {},
          disable: () => {},
          showProgress: (leaveActive: boolean) => {},
          hideProgress: () => {},
          setParams: (params: any) => {}
        },
        HapticFeedback: {
          impactOccurred: (style: 'light' | 'medium' | 'heavy' | 'rigid' | 'soft') => {
            console.log(`[Mock] Haptic impact: ${style}`);
          },
          notificationOccurred: (type: 'error' | 'success' | 'warning') => {
            console.log(`[Mock] Haptic notification: ${type}`);
          },
          selectionChanged: () => {
            console.log(`[Mock] Haptic selection changed`);
          }
        },
        ready: () => {
          console.log('[Mock] WebApp ready');
        },
        expand: () => {
          console.log('[Mock] WebApp expand');
        },
        close: () => {
          console.log('[Mock] WebApp close');
        },
        sendData: (data: string) => {
          console.log('[Mock] Send data:', data);
        },
        openLink: (url: string, options?: any) => {
          console.log('[Mock] Open link:', url, options);
          window.open(url, '_blank');
        },
        openTelegramLink: (url: string) => {
          console.log('[Mock] Open Telegram link:', url);
        },
        openInvoice: (url: string, callback?: (status: string) => void) => {
          console.log('[Mock] Open invoice:', url);
          if (callback) {
            // Simulate successful payment
            setTimeout(() => callback('paid'), 1000);
          }
        },
        showPopup: (params: any, callback?: (buttonId: string) => void) => {
          console.log('[Mock] Show popup:', params);
          if (callback) {
            setTimeout(() => callback('ok'), 500);
          }
        },
        showAlert: (message: string, callback?: () => void) => {
          console.log('[Mock] Show alert:', message);
          if (callback) {
            setTimeout(callback, 500);
          }
        },
        showConfirm: (message: string, callback?: (confirmed: boolean) => void) => {
          console.log('[Mock] Show confirm:', message);
          if (callback) {
            setTimeout(() => callback(true), 500);
          }
        },
        showScanQrPopup: (params: any, callback?: (text: string) => boolean) => {
          console.log('[Mock] Show QR scanner:', params);
          if (callback) {
            // Simulate QR scan with test data
            setTimeout(() => {
              const mockQrData = 'test_qr_12345';
              const shouldClose = callback(mockQrData);
              console.log('[Mock] QR scanned:', mockQrData, 'Close:', shouldClose);
            }, 1000);
          }
        },
        closeScanQrPopup: () => {
          console.log('[Mock] Close QR scanner');
        },
        readTextFromClipboard: (callback?: (text: string) => void) => {
          console.log('[Mock] Read clipboard');
          if (callback) {
            setTimeout(() => callback('test_clipboard_data'), 500);
          }
        }
      }
    };

    console.log('[Mock] Telegram WebApp initialized', (window as any).Telegram.WebApp.initDataUnsafe);
  }, webAppData);
}
```

---

### 2. Test User Authentication Flow

Тестировать процесс аутентификации через Telegram.

**Test Suite**:
```typescript
// tests/e2e/auth.spec.ts
import { test, expect } from '@playwright/test';
import { injectTelegramWebApp } from '../fixtures/telegram-mock';

test.describe('Authentication', () => {
  test.beforeEach(async ({ page }) => {
    // Inject Telegram WebApp mock
    await injectTelegramWebApp(page, {
      id: 123456789,
      first_name: 'Test',
      username: 'testuser'
    });

    await page.goto('/');
  });

  test('should display user info from Telegram', async ({ page }) => {
    // Wait for app to load
    await page.waitForLoadState('networkidle');

    // Check user name is displayed
    await expect(page.locator('[data-testid="user-name"]')).toHaveText('Test');

    // Check user ID is correct
    const userId = await page.locator('[data-testid="user-id"]').textContent();
    expect(userId).toBe('123456789');
  });

  test('should fetch user balance on load', async ({ page }) => {
    // Wait for API call
    await page.waitForResponse(response =>
      response.url().includes('/api/users/balance') && response.status() === 200
    );

    // Check balance is displayed
    await expect(page.locator('[data-testid="balance"]')).toBeVisible();
  });

  test('should handle unauthorized access', async ({ page }) => {
    // Create page without Telegram mock
    const unauthorizedPage = await page.context().newPage();
    await unauthorizedPage.goto('/');

    // Should redirect to error page or show error message
    await expect(unauthorizedPage.locator('[data-testid="auth-error"]')).toBeVisible();
  });

  test('should store auth token in session', async ({ page }) => {
    await page.waitForLoadState('networkidle');

    // Check session storage for auth token
    const authToken = await page.evaluate(() => sessionStorage.getItem('auth_token'));
    expect(authToken).toBeTruthy();
  });

  test('should handle premium users correctly', async ({ page }) => {
    // Re-inject with premium user
    await page.close();
    const premiumPage = await page.context().newPage();

    await injectTelegramWebApp(premiumPage, {
      id: 987654321,
      first_name: 'Premium',
      is_premium: true
    });

    await premiumPage.goto('/');
    await premiumPage.waitForLoadState('networkidle');

    // Check premium badge is visible
    await expect(premiumPage.locator('[data-testid="premium-badge"]')).toBeVisible();
  });
});
```

---

### 3. Test Payment Flow

Тестировать полный цикл оплаты через Telegram Stars.

**Test Suite**:
```typescript
// tests/e2e/payments.spec.ts
import { test, expect } from '@playwright/test';
import { injectTelegramWebApp } from '../fixtures/telegram-mock';

test.describe('Payments', () => {
  test.beforeEach(async ({ page }) => {
    await injectTelegramWebApp(page);
    await page.goto('/');
    await page.waitForLoadState('networkidle');
  });

  test('should display purchase options', async ({ page }) => {
    // Navigate to purchase page
    await page.click('[data-testid="purchase-points-btn"]');

    // Check purchase options are displayed
    await expect(page.locator('[data-testid="purchase-option"]')).toHaveCount(3);

    // Check prices
    const prices = await page.locator('[data-testid="purchase-price"]').allTextContents();
    expect(prices).toContain('5 Stars');
    expect(prices).toContain('20 Stars');
    expect(prices).toContain('50 Stars');
  });

  test('should create invoice on purchase', async ({ page }) => {
    await page.click('[data-testid="purchase-points-btn"]');

    // Click on 100 points option
    await page.click('[data-testid="purchase-option-100"]');

    // Wait for invoice creation API call
    const invoiceResponse = await page.waitForResponse(
      response => response.url().includes('/api/payments/create-invoice')
    );

    expect(invoiceResponse.status()).toBe(200);

    const invoiceData = await invoiceResponse.json();
    expect(invoiceData.invoiceLink).toBeTruthy();
  });

  test('should handle successful payment', async ({ page }) => {
    // Mock successful payment
    await page.addInitScript(() => {
      const originalOpenInvoice = (window as any).Telegram.WebApp.openInvoice;

      (window as any).Telegram.WebApp.openInvoice = (url: string, callback?: (status: string) => void) => {
        console.log('[Test] Simulating successful payment');
        if (callback) {
          setTimeout(() => callback('paid'), 500);
        }
      };
    });

    await page.click('[data-testid="purchase-points-btn"]');
    await page.click('[data-testid="purchase-option-100"]');

    // Wait for success message
    await expect(page.locator('[data-testid="payment-success"]')).toBeVisible();

    // Check balance was updated
    const balanceText = await page.locator('[data-testid="balance"]').textContent();
    expect(balanceText).toContain('100');
  });

  test('should handle cancelled payment', async ({ page }) => {
    // Mock cancelled payment
    await page.addInitScript(() => {
      (window as any).Telegram.WebApp.openInvoice = (url: string, callback?: (status: string) => void) => {
        if (callback) {
          setTimeout(() => callback('cancelled'), 500);
        }
      };
    });

    await page.click('[data-testid="purchase-points-btn"]');
    await page.click('[data-testid="purchase-option-100"]');

    // Wait for cancellation message
    await expect(page.locator('[data-testid="payment-cancelled"]')).toBeVisible();
  });

  test('should handle failed payment', async ({ page }) => {
    // Mock failed payment
    await page.addInitScript(() => {
      (window as any).Telegram.WebApp.openInvoice = (url: string, callback?: (status: string) => void) => {
        if (callback) {
          setTimeout(() => callback('failed'), 500);
        }
      };
    });

    await page.click('[data-testid="purchase-points-btn"]');
    await page.click('[data-testid="purchase-option-100"]');

    // Wait for error message
    await expect(page.locator('[data-testid="payment-error"]')).toBeVisible();
  });

  test('should display payment history', async ({ page }) => {
    await page.click('[data-testid="payment-history-btn"]');

    // Wait for history to load
    await page.waitForResponse(response =>
      response.url().includes('/api/payments/history')
    );

    // Check history items are displayed
    await expect(page.locator('[data-testid="payment-item"]').first()).toBeVisible();
  });
});
```

---

### 4. Test QR Code Scanning

Тестировать QR code scanning functionality.

**Test Suite**:
```typescript
// tests/e2e/qr-scanning.spec.ts
import { test, expect } from '@playwright/test';
import { injectTelegramWebApp } from '../fixtures/telegram-mock';

test.describe('QR Code Scanning', () => {
  test.beforeEach(async ({ page }) => {
    await injectTelegramWebApp(page);
    await page.goto('/cashier');
    await page.waitForLoadState('networkidle');
  });

  test('should open QR scanner', async ({ page }) => {
    // Click scan button
    await page.click('[data-testid="scan-qr-btn"]');

    // Check QR scanner is opened (via mock console log)
    const consoleMessages: string[] = [];

    page.on('console', msg => {
      consoleMessages.push(msg.text());
    });

    await page.waitForTimeout(100);

    expect(consoleMessages.some(msg => msg.includes('[Mock] Show QR scanner'))).toBe(true);
  });

  test('should handle scanned QR code', async ({ page }) => {
    // Mock QR scanner with specific data
    await page.addInitScript(() => {
      (window as any).Telegram.WebApp.showScanQrPopup = (params: any, callback?: (text: string) => boolean) => {
        if (callback) {
          setTimeout(() => {
            const shouldClose = callback('txn_12345_100_earn');
            return shouldClose;
          }, 500);
        }
      };
    });

    await page.click('[data-testid="scan-qr-btn"]');

    // Wait for transaction to be processed
    await expect(page.locator('[data-testid="scan-success"]')).toBeVisible();

    // Check transaction details are displayed
    await expect(page.locator('[data-testid="txn-id"]')).toHaveText('txn_12345_100_earn');
  });

  test('should handle invalid QR code', async ({ page }) => {
    // Mock QR scanner with invalid data
    await page.addInitScript(() => {
      (window as any).Telegram.WebApp.showScanQrPopup = (params: any, callback?: (text: string) => boolean) => {
        if (callback) {
          setTimeout(() => callback('invalid_qr_data'), 500);
        }
      };
    });

    await page.click('[data-testid="scan-qr-btn"]');

    // Wait for error message
    await expect(page.locator('[data-testid="scan-error"]')).toBeVisible();
  });

  test('should process earn transaction', async ({ page }) => {
    await page.addInitScript(() => {
      (window as any).Telegram.WebApp.showScanQrPopup = (params: any, callback?: (text: string) => boolean) => {
        if (callback) {
          setTimeout(() => callback('txn_99999_200_earn'), 500);
        }
      };
    });

    await page.click('[data-testid="scan-qr-btn"]');

    // Wait for API call
    const txnResponse = await page.waitForResponse(
      response => response.url().includes('/api/transactions')
    );

    expect(txnResponse.status()).toBe(201);

    // Check balance was updated
    await expect(page.locator('[data-testid="balance"]')).toContainText('200');
  });

  test('should process redeem transaction', async ({ page }) => {
    await page.addInitScript(() => {
      (window as any).Telegram.WebApp.showScanQrPopup = (params: any, callback?: (text: string) => boolean) => {
        if (callback) {
          setTimeout(() => callback('txn_88888_50_redeem'), 500);
        }
      };
    });

    await page.click('[data-testid="scan-qr-btn"]');

    await page.waitForResponse(response =>
      response.url().includes('/api/transactions')
    );

    // Check confirmation modal
    await expect(page.locator('[data-testid="redeem-confirmation"]')).toBeVisible();

    // Confirm redeem
    await page.click('[data-testid="confirm-redeem-btn"]');

    // Check success message
    await expect(page.locator('[data-testid="redeem-success"]')).toBeVisible();
  });

  test('should handle offline QR scanning', async ({ page }) => {
    // Simulate offline mode
    await page.context().setOffline(true);

    await page.addInitScript(() => {
      (window as any).Telegram.WebApp.showScanQrPopup = (params: any, callback?: (text: string) => boolean) => {
        if (callback) {
          setTimeout(() => callback('txn_77777_150_earn'), 500);
        }
      };
    });

    await page.click('[data-testid="scan-qr-btn"]');

    // Should show offline message
    await expect(page.locator('[data-testid="offline-message"]')).toBeVisible();

    // Transaction should be queued
    const queuedCount = await page.locator('[data-testid="queued-count"]').textContent();
    expect(parseInt(queuedCount || '0')).toBeGreaterThan(0);
  });
});
```

---

### 5. Visual Regression Testing

Выполнять visual regression тестирование для обнаружения UI изменений.

**Setup Visual Testing**:
```typescript
// tests/e2e/visual.spec.ts
import { test, expect } from '@playwright/test';
import { injectTelegramWebApp } from '../fixtures/telegram-mock';

test.describe('Visual Regression', () => {
  test.beforeEach(async ({ page }) => {
    await injectTelegramWebApp(page);
  });

  test('homepage should match snapshot', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    // Take screenshot
    await expect(page).toHaveScreenshot('homepage.png', {
      fullPage: true,
      animations: 'disabled'
    });
  });

  test('purchase page should match snapshot', async ({ page }) => {
    await page.goto('/purchase');
    await page.waitForLoadState('networkidle');

    await expect(page).toHaveScreenshot('purchase-page.png', {
      fullPage: true,
      animations: 'disabled'
    });
  });

  test('transaction history should match snapshot', async ({ page }) => {
    await page.goto('/history');
    await page.waitForResponse(response =>
      response.url().includes('/api/transactions/history')
    );

    await expect(page).toHaveScreenshot('history-page.png', {
      fullPage: true,
      animations: 'disabled'
    });
  });

  test('dark mode should match snapshot', async ({ page }) => {
    // Set dark theme
    await page.addInitScript(() => {
      (window as any).Telegram.WebApp.colorScheme = 'dark';
      (window as any).Telegram.WebApp.themeParams = {
        bg_color: '#1c1c1e',
        text_color: '#ffffff',
        hint_color: '#8e8e93',
        link_color: '#0a84ff',
        button_color: '#0a84ff',
        button_text_color: '#ffffff',
        secondary_bg_color: '#2c2c2e'
      };
    });

    await page.goto('/');
    await page.waitForLoadState('networkidle');

    await expect(page).toHaveScreenshot('homepage-dark.png', {
      fullPage: true,
      animations: 'disabled'
    });
  });

  test('mobile layout should match snapshot', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 }); // iPhone SE

    await page.goto('/');
    await page.waitForLoadState('networkidle');

    await expect(page).toHaveScreenshot('homepage-mobile.png', {
      fullPage: true,
      animations: 'disabled'
    });
  });

  test('tablet layout should match snapshot', async ({ page }) => {
    await page.setViewportSize({ width: 768, height: 1024 }); // iPad

    await page.goto('/');
    await page.waitForLoadState('networkidle');

    await expect(page).toHaveScreenshot('homepage-tablet.png', {
      fullPage: true,
      animations: 'disabled'
    });
  });
});
```

**Update Snapshots**:
```bash
# Update all snapshots
npx playwright test --update-snapshots

# Update specific test snapshots
npx playwright test visual.spec.ts --update-snapshots

# Update for specific browser
npx playwright test --update-snapshots --project=telegram-ios
```

---

### 6. Test Offline Functionality

Тестировать offline режим и синхронизацию.

**Test Suite**:
```typescript
// tests/e2e/offline.spec.ts
import { test, expect } from '@playwright/test';
import { injectTelegramWebApp } from '../fixtures/telegram-mock';

test.describe('Offline Functionality', () => {
  test.beforeEach(async ({ page }) => {
    await injectTelegramWebApp(page);
    await page.goto('/');
    await page.waitForLoadState('networkidle');
  });

  test('should show offline indicator when offline', async ({ page }) => {
    // Go offline
    await page.context().setOffline(true);

    // Trigger network request
    await page.click('[data-testid="refresh-btn"]');

    // Check offline indicator is visible
    await expect(page.locator('[data-testid="offline-indicator"]')).toBeVisible();
  });

  test('should queue transactions when offline', async ({ page }) => {
    // Go offline
    await page.context().setOffline(true);

    // Mock QR scan
    await page.addInitScript(() => {
      (window as any).Telegram.WebApp.showScanQrPopup = (params: any, callback?: (text: string) => boolean) => {
        if (callback) {
          setTimeout(() => callback('txn_12345_100_earn'), 500);
        }
      };
    });

    await page.click('[data-testid="scan-qr-btn"]');

    // Should show offline message
    await expect(page.locator('[data-testid="offline-queued"]')).toBeVisible();

    // Check transaction is in queue
    const queuedCount = await page.locator('[data-testid="queued-count"]').textContent();
    expect(parseInt(queuedCount || '0')).toBe(1);
  });

  test('should sync queued transactions when back online', async ({ page }) => {
    // Go offline and queue transaction
    await page.context().setOffline(true);

    await page.addInitScript(() => {
      (window as any).Telegram.WebApp.showScanQrPopup = (params: any, callback?: (text: string) => boolean) => {
        if (callback) {
          setTimeout(() => callback('txn_67890_50_earn'), 500);
        }
      };
    });

    await page.click('[data-testid="scan-qr-btn"]');
    await expect(page.locator('[data-testid="offline-queued"]')).toBeVisible();

    // Go back online
    await page.context().setOffline(false);

    // Wait for sync
    await page.waitForResponse(response =>
      response.url().includes('/api/transactions/sync')
    );

    // Check queue is empty
    const queuedCount = await page.locator('[data-testid="queued-count"]').textContent();
    expect(parseInt(queuedCount || '0')).toBe(0);

    // Check transaction is in history
    await page.click('[data-testid="history-btn"]');
    await expect(page.locator('[data-testid="txn-67890"]')).toBeVisible();
  });

  test('should persist queue across page reloads', async ({ page }) => {
    // Go offline and queue transaction
    await page.context().setOffline(true);

    await page.evaluate(() => {
      localStorage.setItem('offline_queue', JSON.stringify([
        { id: 'txn_test', amount: 100, type: 'earn', timestamp: Date.now() }
      ]));
    });

    // Reload page
    await page.reload();
    await page.waitForLoadState('networkidle');

    // Check queue count
    const queuedCount = await page.locator('[data-testid="queued-count"]').textContent();
    expect(parseInt(queuedCount || '0')).toBe(1);
  });

  test('should show cached data when offline', async ({ page }) => {
    // Load data while online
    await page.click('[data-testid="history-btn"]');
    await page.waitForResponse(response =>
      response.url().includes('/api/transactions/history')
    );

    // Go offline
    await page.context().setOffline(true);

    // Navigate away and back
    await page.click('[data-testid="home-btn"]');
    await page.click('[data-testid="history-btn"]');

    // Should show cached data
    await expect(page.locator('[data-testid="cached-data-indicator"]')).toBeVisible();
    await expect(page.locator('[data-testid="transaction-item"]').first()).toBeVisible();
  });
});
```

---

### 7. CI/CD Integration

Интегрировать тесты в CI/CD pipeline.

**GitHub Actions Workflow**:
```yaml
# .github/workflows/e2e-tests.yml
name: E2E Tests

on:
  push:
    branches: [main, develop]
  pull_request:
    branches: [main, develop]

jobs:
  test:
    timeout-minutes: 60
    runs-on: ubuntu-latest
    strategy:
      matrix:
        project: [telegram-ios, telegram-android, telegram-desktop]

    steps:
      - uses: actions/checkout@v4

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'npm'

      - name: Install dependencies
        run: npm ci

      - name: Install Playwright Browsers
        run: npx playwright install --with-deps

      - name: Build application
        run: npm run build

      - name: Run E2E tests
        run: npx playwright test --project=${{ matrix.project }}

      - name: Upload test results
        if: always()
        uses: actions/upload-artifact@v4
        with:
          name: playwright-results-${{ matrix.project }}
          path: test-results/
          retention-days: 30

      - name: Upload HTML report
        if: always()
        uses: actions/upload-artifact@v4
        with:
          name: playwright-report-${{ matrix.project }}
          path: playwright-report/
          retention-days: 30

      - name: Comment PR with test results
        if: github.event_name == 'pull_request'
        uses: daun/playwright-report-comment@v3
        with:
          report-path: playwright-report/
```

**GitLab CI**:
```yaml
# .gitlab-ci.yml
e2e-tests:
  stage: test
  image: mcr.microsoft.com/playwright:v1.40.0-jammy
  script:
    - npm ci
    - npm run build
    - npx playwright test
  artifacts:
    when: always
    paths:
      - playwright-report/
      - test-results/
    reports:
      junit: test-results/junit.xml
    expire_in: 1 week
  only:
    - merge_requests
    - main
    - develop
```

**Docker Setup** (для локального запуска):
```dockerfile
# Dockerfile.e2e
FROM mcr.microsoft.com/playwright:v1.40.0-jammy

WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY . .

RUN npm run build

CMD ["npx", "playwright", "test"]
```

```bash
# Run tests in Docker
docker build -f Dockerfile.e2e -t loyalty-e2e .
docker run --rm -v $(pwd)/playwright-report:/app/playwright-report loyalty-e2e
```

---

## Best Practices

### 1. Use Data Attributes

```svelte
<!-- src/routes/+page.svelte -->
<button data-testid="purchase-points-btn">
  Purchase Points
</button>

<div data-testid="balance">{balance} points</div>
```

### 2. Wait for Network Idle

```typescript
await page.waitForLoadState('networkidle');
```

### 3. Use Specific Selectors

```typescript
// ✅ Good
await page.click('[data-testid="submit-btn"]');

// ❌ Avoid
await page.click('button');
await page.click('.btn-primary');
```

### 4. Handle Async Operations

```typescript
// Wait for API response
await page.waitForResponse(response =>
  response.url().includes('/api/users') && response.status() === 200
);
```

### 5. Test Error States

```typescript
test('should handle API error', async ({ page }) => {
  // Mock API error
  await page.route('**/api/transactions', route =>
    route.fulfill({ status: 500, body: 'Internal Server Error' })
  );

  await page.click('[data-testid="submit-btn"]');

  await expect(page.locator('[data-testid="error-message"]')).toBeVisible();
});
```

### 6. Isolate Tests

```typescript
test.beforeEach(async ({ page }) => {
  // Reset state before each test
  await page.evaluate(() => {
    localStorage.clear();
    sessionStorage.clear();
  });

  await seedDatabase();
});

test.afterEach(async () => {
  await cleanDatabase();
});
```

---

## Related Skills

- `telegram-miniapp-production` - Telegram WebApp setup
- `monitoring-error-tracking` - Error tracking для test failures
- `sveltekit-telegram-deployment` - Production deployment

---

## Resources

- [Playwright Documentation](https://playwright.dev/)
- [Telegram WebApp Testing](https://core.telegram.org/bots/webapps#testing-web-apps)
- [Visual Regression Testing](https://playwright.dev/docs/test-snapshots)
- [CI/CD with Playwright](https://playwright.dev/docs/ci)

---

## FAQ

**Q: Как тестировать без реального Telegram?**
A: Используй мок из Capability #1 - он эмулирует Telegram WebApp SDK.

**Q: Как обновлять visual snapshots?**
A: `npx playwright test --update-snapshots`

**Q: Как запустить тесты в headless режиме?**
A: `npx playwright test` (headless по умолчанию)

**Q: Как дебажить failing тесты?**
A: `npx playwright test --debug` для step-by-step debugging

**Q: Как тестировать платежи без реальных Stars?**
A: Используй мок `openInvoice` с нужным статусом (`paid`, `cancelled`, `failed`)
