/**
 * Telegram WebApp InitData Validation
 *
 * CRITICAL SECURITY: Always validate initData on the backend before trusting user identity.
 * This prevents spoofing attacks where malicious users can fake Telegram user data.
 *
 * How it works:
 * 1. Telegram signs initData with your bot token using HMAC SHA-256
 * 2. You verify the signature on your backend
 * 3. If valid, you can trust the user data (id, username, etc.)
 *
 * Usage:
 * ```typescript
 * import { validateTelegramInitData } from './validate_init_data';
 *
 * // In your API endpoint
 * app.post('/api/telegram/auth', async (req, res) => {
 *   const { initData } = req.body;
 *   const botToken = process.env.TELEGRAM_BOT_TOKEN;
 *
 *   try {
 *     const validatedData = validateTelegramInitData(initData, botToken);
 *
 *     // Data is valid - create session, etc.
 *     const user = validatedData.user;
 *     res.json({ success: true, user });
 *   } catch (error) {
 *     // Invalid initData - possible attack
 *     res.status(401).json({ error: 'Invalid Telegram data' });
 *   }
 * });
 * ```
 */

import { createHmac, timingSafeEqual } from 'crypto';

/**
 * Telegram user object from initData
 */
export interface TelegramUser {
  id: number;
  first_name: string;
  last_name?: string;
  username?: string;
  language_code?: string;
  is_premium?: boolean;
  photo_url?: string;
}

/**
 * Validated initData structure
 */
export interface ValidatedInitData {
  user: TelegramUser;
  chat_instance?: string;
  chat_type?: string;
  start_param?: string;
  auth_date: number;
  hash: string;
}

/**
 * Validates Telegram WebApp initData using HMAC SHA-256
 *
 * @param initData - Raw initData string from window.Telegram.WebApp.initData
 * @param botToken - Your Telegram bot token (from @BotFather)
 * @param maxAge - Maximum age of initData in seconds (default: 86400 = 24 hours)
 * @returns Validated and parsed initData
 * @throws Error if validation fails
 */
export function validateTelegramInitData(
  initData: string,
  botToken: string,
  maxAge: number = 86400
): ValidatedInitData {
  // Parse initData query string
  const params = new URLSearchParams(initData);
  const hash = params.get('hash');

  if (!hash) {
    throw new Error('Missing hash in initData');
  }

  // Remove hash from params to reconstruct data_check_string
  params.delete('hash');

  // Sort parameters alphabetically and create data_check_string
  const dataCheckArray: string[] = [];
  params.sort();
  params.forEach((value, key) => {
    dataCheckArray.push(`${key}=${value}`);
  });
  const dataCheckString = dataCheckArray.join('\n');

  // Create secret key from bot token
  const secretKey = createHmac('sha256', 'WebAppData')
    .update(botToken)
    .digest();

  // Calculate expected hash
  const expectedHash = createHmac('sha256', secretKey)
    .update(dataCheckString)
    .digest('hex');

  // Timing-safe comparison to prevent timing attacks
  const hashBuffer = Buffer.from(hash, 'hex');
  const expectedHashBuffer = Buffer.from(expectedHash, 'hex');

  if (hashBuffer.length !== expectedHashBuffer.length) {
    throw new Error('Invalid hash length');
  }

  if (!timingSafeEqual(hashBuffer, expectedHashBuffer)) {
    throw new Error('Invalid hash - possible spoofing attack');
  }

  // Check auth_date to prevent replay attacks
  const authDate = parseInt(params.get('auth_date') || '0', 10);
  if (!authDate) {
    throw new Error('Missing auth_date in initData');
  }

  const currentTime = Math.floor(Date.now() / 1000);
  if (currentTime - authDate > maxAge) {
    throw new Error(`InitData expired (older than ${maxAge} seconds)`);
  }

  // Parse user data
  const userJson = params.get('user');
  if (!userJson) {
    throw new Error('Missing user data in initData');
  }

  let user: TelegramUser;
  try {
    user = JSON.parse(userJson);
  } catch (error) {
    throw new Error('Invalid user JSON in initData');
  }

  // Construct validated result
  const result: ValidatedInitData = {
    user,
    auth_date: authDate,
    hash
  };

  // Add optional fields if present
  const chatInstance = params.get('chat_instance');
  if (chatInstance) result.chat_instance = chatInstance;

  const chatType = params.get('chat_type');
  if (chatType) result.chat_type = chatType;

  const startParam = params.get('start_param');
  if (startParam) result.start_param = startParam;

  return result;
}

/**
 * Express middleware for validating Telegram initData
 *
 * Usage:
 * ```typescript
 * import { validateTelegramMiddleware } from './validate_init_data';
 *
 * app.post('/api/telegram/*', validateTelegramMiddleware, (req, res) => {
 *   // req.telegramUser is available and validated
 *   const user = req.telegramUser;
 *   res.json({ user });
 * });
 * ```
 */
export function validateTelegramMiddleware(req: any, res: any, next: any) {
  const initData = req.body.initData || req.headers['x-telegram-init-data'];
  const botToken = process.env.TELEGRAM_BOT_TOKEN;

  if (!botToken) {
    return res.status(500).json({ error: 'TELEGRAM_BOT_TOKEN not configured' });
  }

  if (!initData) {
    return res.status(400).json({ error: 'Missing initData' });
  }

  try {
    const validatedData = validateTelegramInitData(initData, botToken);
    req.telegramUser = validatedData.user;
    req.telegramData = validatedData;
    next();
  } catch (error: any) {
    return res.status(401).json({
      error: 'Invalid Telegram authentication',
      details: error.message
    });
  }
}

/**
 * Example: Using validation in SvelteKit
 *
 * File: src/routes/api/telegram/auth/+server.ts
 *
 * ```typescript
 * import { validateTelegramInitData } from '$lib/server/telegram/validate';
 * import { TELEGRAM_BOT_TOKEN } from '$env/static/private';
 * import type { RequestHandler } from './$types';
 *
 * export const POST: RequestHandler = async ({ request }) => {
 *   const { initData } = await request.json();
 *
 *   try {
 *     const validatedData = validateTelegramInitData(initData, TELEGRAM_BOT_TOKEN);
 *
 *     // Create or update user in database
 *     const user = await db.upsertTelegramUser(validatedData.user);
 *
 *     // Create session
 *     const session = await createSession(user.id);
 *
 *     return new Response(JSON.stringify({ success: true, user }), {
 *       headers: {
 *         'Set-Cookie': `session=${session.token}; HttpOnly; Secure; SameSite=Strict; Path=/`
 *       }
 *     });
 *   } catch (error: any) {
 *     return new Response(JSON.stringify({ error: error.message }), {
 *       status: 401
 *     });
 *   }
 * };
 * ```
 */
