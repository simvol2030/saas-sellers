/**
 * Authentication Middleware
 *
 * JWT-based authentication for protected routes
 */

import { Context, Next } from 'hono';
import { verifyToken, type TokenPayload } from '../lib/jwt.js';

export interface AuthUser {
  id: number;
  email: string;
  role: string;
}

// Extend Hono context
declare module 'hono' {
  interface ContextVariableMap {
    user: AuthUser;
  }
}

/**
 * Extract token from Authorization header
 */
function extractToken(c: Context): string | null {
  const authHeader = c.req.header('Authorization');
  if (!authHeader) return null;

  // Support both "Bearer <token>" and just "<token>"
  if (authHeader.startsWith('Bearer ')) {
    return authHeader.slice(7);
  }

  return authHeader;
}

/**
 * Auth middleware - requires valid access token
 */
export const authMiddleware = async (c: Context, next: Next) => {
  const token = extractToken(c);

  if (!token) {
    return c.json({
      error: 'Authentication required',
      code: 'NO_TOKEN',
    }, 401);
  }

  const payload = await verifyToken(token);

  if (!payload) {
    return c.json({
      error: 'Invalid or expired token',
      code: 'INVALID_TOKEN',
    }, 401);
  }

  // Ensure it's an access token, not a refresh token
  if (payload.type !== 'access') {
    return c.json({
      error: 'Invalid token type',
      code: 'WRONG_TOKEN_TYPE',
    }, 401);
  }

  // Set user in context
  c.set('user', {
    id: payload.userId,
    email: payload.email,
    role: payload.role,
  });

  await next();
};

/**
 * Optional auth middleware - doesn't require token but populates user if present
 */
export const optionalAuthMiddleware = async (c: Context, next: Next) => {
  const token = extractToken(c);

  if (token) {
    const payload = await verifyToken(token);
    if (payload && payload.type === 'access') {
      c.set('user', {
        id: payload.userId,
        email: payload.email,
        role: payload.role,
      });
    }
  }

  await next();
};

/**
 * Role-based authorization middleware
 * Use after authMiddleware
 */
export const requireRole = (...allowedRoles: string[]) => {
  return async (c: Context, next: Next) => {
    const user = c.get('user');

    if (!user) {
      return c.json({
        error: 'Authentication required',
        code: 'NO_USER',
      }, 401);
    }

    if (!allowedRoles.includes(user.role)) {
      return c.json({
        error: 'Insufficient permissions',
        code: 'FORBIDDEN',
        required: allowedRoles,
        current: user.role,
      }, 403);
    }

    await next();
  };
};

/**
 * Admin-only middleware
 */
export const adminOnly = requireRole('admin');

/**
 * Editor or Admin middleware
 */
export const editorOrAdmin = requireRole('editor', 'admin');
