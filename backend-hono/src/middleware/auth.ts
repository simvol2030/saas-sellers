import { Context, Next } from 'hono';

/**
 * Authentication Middleware Stub
 *
 * TODO: Implement your authentication logic here
 *
 * Suggested implementations:
 * - JWT token validation
 * - Session-based authentication
 * - API key verification
 * - OAuth 2.0 / OpenID Connect
 *
 * Example JWT implementation:
 * ```typescript
 * import { jwt } from 'hono/jwt';
 *
 * const token = c.req.header('Authorization')?.split(' ')[1];
 * if (!token) return c.json({ error: 'No token provided' }, 401);
 *
 * try {
 *   const payload = await jwt.verify(token, process.env.JWT_SECRET!);
 *   c.set('user', payload);
 *   await next();
 * } catch (error) {
 *   return c.json({ error: 'Invalid token' }, 401);
 * }
 * ```
 */

export interface UserPayload {
  id: number;
  email: string;
  // Add other user properties as needed
}

export const authMiddleware = async (c: Context, next: Next) => {
  // TODO: Implement authentication logic

  // For now, this is a stub that allows all requests
  // Remove this and add your auth logic
  await next();

  // Example: Reject unauthenticated requests
  // return c.json({ error: 'Authentication required' }, 401);
};

/**
 * Optional role-based authorization middleware
 * Use this after authMiddleware to check user roles/permissions
 */
export const requireRole = (roles: string[]) => {
  return async (c: Context, next: Next) => {
    // TODO: Check if user (from c.get('user')) has required role
    await next();
  };
};
