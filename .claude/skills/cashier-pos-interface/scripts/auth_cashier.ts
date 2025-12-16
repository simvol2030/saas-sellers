/**
 * Cashier Authentication & Authorization
 *
 * Provides JWT-based authentication with role-based access control for POS cashiers.
 * Validates Telegram initData and issues JWT tokens with permissions.
 */

import { validateTelegramInitData } from './validate_init_data';
import jwt from 'jsonwebtoken';

export interface CashierPermissions {
  canProcessSales: boolean;
  canRefund: boolean;
  canViewReports: boolean;
  canManageInventory: boolean;
  storeId: string;
}

export interface CashierJWTPayload {
  userId: string;
  telegramId: number;
  role: 'cashier' | 'manager' | 'admin';
  storeId: string;
  permissions: CashierPermissions;
  iat: number;
  exp: number;
}

/**
 * Authenticate cashier using Telegram initData
 *
 * @returns JWT payload with user info and permissions
 * @throws Error if authentication fails
 */
export async function authenticateCashier(initData: string): Promise<CashierJWTPayload> {
  // 1. Валидируем Telegram initData
  const validated = validateTelegramInitData(
    initData,
    process.env.TELEGRAM_BOT_TOKEN!,
    86400 // 24 часа
  );

  // 2. Проверяем, что пользователь зарегистрирован как кассир
  const response = await fetch('/api/auth/cashier-login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      telegramId: validated.user.id,
      initData
    })
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.message || 'Authentication failed');
  }

  const { token } = await response.json();

  // 3. Декодируем JWT и проверяем права
  const payload = jwt.verify(
    token,
    process.env.JWT_SECRET!
  ) as CashierJWTPayload;

  if (payload.role !== 'cashier' && payload.role !== 'manager' && payload.role !== 'admin') {
    throw new Error('Access denied: insufficient permissions');
  }

  // Сохраняем токен для последующих запросов
  if (typeof localStorage !== 'undefined') {
    localStorage.setItem('pos_auth_token', token);
    localStorage.setItem('pos_cashier_id', payload.userId);
    localStorage.setItem('pos_store_id', payload.storeId);
  }

  return payload;
}

/**
 * Middleware для защиты POS routes
 *
 * @returns Decoded JWT payload if valid
 * @throws Error if token is missing or invalid
 */
export async function requireCashierAuth(request: Request): Promise<CashierJWTPayload> {
  const authHeader = request.headers.get('Authorization');

  if (!authHeader?.startsWith('Bearer ')) {
    throw new Error('Missing authorization token');
  }

  const token = authHeader.substring(7);

  try {
    const payload = jwt.verify(
      token,
      process.env.JWT_SECRET!
    ) as CashierJWTPayload;

    // Проверяем роль
    if (!['cashier', 'manager', 'admin'].includes(payload.role)) {
      throw new Error('Invalid role');
    }

    // Проверяем, что токен не истёк (дополнительная проверка)
    const now = Math.floor(Date.now() / 1000);
    if (payload.exp < now) {
      throw new Error('Token expired');
    }

    return payload;

  } catch (error) {
    if (error instanceof jwt.JsonWebTokenError) {
      throw new Error('Invalid token');
    }
    if (error instanceof jwt.TokenExpiredError) {
      throw new Error('Token expired');
    }
    throw error;
  }
}

/**
 * Проверка конкретного permission
 *
 * @throws Error if permission is denied
 */
export function checkPermission(
  payload: CashierJWTPayload,
  permission: keyof CashierPermissions
): void {
  if (permission === 'storeId') {
    // storeId - это не boolean permission, пропускаем
    return;
  }

  const hasPermission = payload.permissions[permission];

  if (!hasPermission) {
    throw new Error(`Permission denied: ${permission}`);
  }
}

/**
 * Get current auth token from localStorage
 */
export function getAuthToken(): string | null {
  if (typeof localStorage === 'undefined') {
    return null;
  }

  return localStorage.getItem('pos_auth_token');
}

/**
 * Get current cashier ID from localStorage
 */
export function getCurrentCashierId(): string | null {
  if (typeof localStorage === 'undefined') {
    return null;
  }

  return localStorage.getItem('pos_cashier_id');
}

/**
 * Get current store ID from localStorage
 */
export function getCurrentStoreId(): string | null {
  if (typeof localStorage === 'undefined') {
    return null;
  }

  return localStorage.getItem('pos_store_id');
}

/**
 * Logout (clear auth data)
 */
export function logout(): void {
  if (typeof localStorage !== 'undefined') {
    localStorage.removeItem('pos_auth_token');
    localStorage.removeItem('pos_cashier_id');
    localStorage.removeItem('pos_store_id');
  }
}

/**
 * Check if user is authenticated
 */
export function isAuthenticated(): boolean {
  const token = getAuthToken();
  if (!token) return false;

  try {
    const payload = jwt.decode(token) as CashierJWTPayload;
    if (!payload) return false;

    // Проверяем, не истёк ли токен
    const now = Math.floor(Date.now() / 1000);
    return payload.exp > now;
  } catch {
    return false;
  }
}

/**
 * Example usage:
 *
 * ```typescript
 * // Frontend (SvelteKit)
 * import { authenticateCashier, isAuthenticated } from './auth_cashier';
 *
 * async function loginCashier() {
 *   const initData = window.Telegram?.WebApp.initData;
 *
 *   if (!initData) {
 *     throw new Error('Telegram WebApp not initialized');
 *   }
 *
 *   const auth = await authenticateCashier(initData);
 *
 *   console.log('Logged in:', auth.userId);
 *   console.log('Role:', auth.role);
 *   console.log('Permissions:', auth.permissions);
 * }
 *
 * // Protected route
 * if (!isAuthenticated()) {
 *   goto('/login');
 * }
 * ```
 *
 * Backend example in SKILL.md (routes/auth.ts)
 */
