/**
 * Authentication Routes
 *
 * Endpoints:
 * POST /api/auth/login    - Login with email/password
 * POST /api/auth/refresh  - Refresh access token
 * POST /api/auth/logout   - Invalidate refresh token
 * GET  /api/auth/me       - Get current user
 * POST /api/auth/register - Register new user (admin only initially)
 */

import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { z } from 'zod';
import bcrypt from 'bcryptjs';
import { prisma } from '../lib/db.js';
import {
  generateTokenPair,
  verifyToken,
  generateAccessToken,
  getRefreshTokenExpiry,
} from '../lib/jwt.js';
import { authMiddleware, adminOnly } from '../middleware/auth.js';

const auth = new Hono();

// ===========================================
// VALIDATION SCHEMAS
// ===========================================

const loginSchema = z.object({
  email: z.string().email('Invalid email format'),
  password: z.string().min(1, 'Password is required'),
});

const registerSchema = z.object({
  email: z.string().email('Invalid email format'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
  name: z.string().min(1, 'Name is required').optional(),
  role: z.enum(['admin', 'editor', 'viewer']).default('editor'),
});

const refreshSchema = z.object({
  refreshToken: z.string().min(1, 'Refresh token is required'),
});

// ===========================================
// ROUTES
// ===========================================

/**
 * POST /api/auth/login
 * Login with email and password
 */
auth.post('/login', zValidator('json', loginSchema), async (c) => {
  const { email, password } = c.req.valid('json');

  try {
    // Find user
    const user = await prisma.user.findUnique({
      where: { email },
    });

    if (!user) {
      return c.json({
        error: 'Invalid credentials',
        code: 'INVALID_CREDENTIALS',
      }, 401);
    }

    // Phase 3: Check if user is active
    if (!user.isActive) {
      return c.json({
        error: 'Account is disabled',
        code: 'ACCOUNT_DISABLED',
      }, 403);
    }

    // Verify password
    const validPassword = await bcrypt.compare(password, user.password);
    if (!validPassword) {
      return c.json({
        error: 'Invalid credentials',
        code: 'INVALID_CREDENTIALS',
      }, 401);
    }

    // Generate tokens
    const { accessToken, refreshToken } = await generateTokenPair({
      userId: user.id,
      email: user.email,
      role: user.role,
      isSuperadmin: user.isSuperadmin,
    });

    // Store refresh token in database
    await prisma.session.create({
      data: {
        userId: user.id,
        refreshToken,
        userAgent: c.req.header('User-Agent'),
        ipAddress: c.req.header('X-Forwarded-For') || 'unknown',
        expiresAt: getRefreshTokenExpiry(),
      },
    });

    return c.json({
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        isSuperadmin: user.isSuperadmin,
      },
      accessToken,
      refreshToken,
    });
  } catch (error) {
    console.error('Login error:', error);
    return c.json({
      error: 'Login failed',
      code: 'LOGIN_ERROR',
    }, 500);
  }
});

/**
 * POST /api/auth/refresh
 * Get new access token using refresh token
 */
auth.post('/refresh', zValidator('json', refreshSchema), async (c) => {
  const { refreshToken } = c.req.valid('json');

  try {
    // Verify token
    const payload = await verifyToken(refreshToken);
    if (!payload || payload.type !== 'refresh') {
      return c.json({
        error: 'Invalid refresh token',
        code: 'INVALID_REFRESH_TOKEN',
      }, 401);
    }

    // Check if token exists in database (not revoked)
    const session = await prisma.session.findUnique({
      where: { refreshToken },
      include: { user: true },
    });

    if (!session) {
      return c.json({
        error: 'Session not found or revoked',
        code: 'SESSION_NOT_FOUND',
      }, 401);
    }

    // Check if session expired
    if (session.expiresAt < new Date()) {
      // Clean up expired session
      await prisma.session.delete({ where: { id: session.id } });
      return c.json({
        error: 'Session expired',
        code: 'SESSION_EXPIRED',
      }, 401);
    }

    // Phase 3: Check if user is still active
    if (!session.user.isActive) {
      await prisma.session.delete({ where: { id: session.id } });
      return c.json({
        error: 'Account is disabled',
        code: 'ACCOUNT_DISABLED',
      }, 403);
    }

    // Generate new access token
    const accessToken = await generateAccessToken({
      userId: session.user.id,
      email: session.user.email,
      role: session.user.role,
      isSuperadmin: session.user.isSuperadmin,
    });

    return c.json({ accessToken });
  } catch (error) {
    console.error('Refresh error:', error);
    return c.json({
      error: 'Token refresh failed',
      code: 'REFRESH_ERROR',
    }, 500);
  }
});

/**
 * POST /api/auth/logout
 * Invalidate refresh token
 */
auth.post('/logout', zValidator('json', refreshSchema), async (c) => {
  const { refreshToken } = c.req.valid('json');

  try {
    // Delete session from database
    await prisma.session.deleteMany({
      where: { refreshToken },
    });

    return c.json({ message: 'Logged out successfully' });
  } catch (error) {
    console.error('Logout error:', error);
    return c.json({
      error: 'Logout failed',
      code: 'LOGOUT_ERROR',
    }, 500);
  }
});

/**
 * GET /api/auth/me
 * Get current authenticated user
 */
auth.get('/me', authMiddleware, async (c) => {
  const authUser = c.get('user');

  try {
    const user = await prisma.user.findUnique({
      where: { id: authUser.id },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        isSuperadmin: true,
        isActive: true,
        createdAt: true,
      },
    });

    if (!user) {
      return c.json({
        error: 'User not found',
        code: 'USER_NOT_FOUND',
      }, 404);
    }

    return c.json({ user });
  } catch (error) {
    console.error('Get user error:', error);
    return c.json({
      error: 'Failed to get user',
      code: 'GET_USER_ERROR',
    }, 500);
  }
});

/**
 * POST /api/auth/register
 * Register new user (admin only, or first user)
 */
auth.post('/register', zValidator('json', registerSchema), async (c) => {
  const { email, password, name, role } = c.req.valid('json');

  try {
    // Check if this is the first user (allow registration without auth)
    const userCount = await prisma.user.count();
    const isFirstUser = userCount === 0;

    // If not first user, require admin auth
    if (!isFirstUser) {
      // Check for auth header
      const authHeader = c.req.header('Authorization');
      if (!authHeader) {
        return c.json({
          error: 'Admin authentication required',
          code: 'AUTH_REQUIRED',
        }, 401);
      }

      const token = authHeader.replace('Bearer ', '');
      const payload = await verifyToken(token);

      // Phase 3: Check for superadmin instead of admin role
      if (!payload || payload.type !== 'access' || !payload.isSuperadmin) {
        return c.json({
          error: 'Superadmin access required',
          code: 'SUPERADMIN_REQUIRED',
        }, 403);
      }
    }

    // Check if email already exists
    const existingUser = await prisma.user.findUnique({
      where: { email },
    });

    if (existingUser) {
      return c.json({
        error: 'Email already registered',
        code: 'EMAIL_EXISTS',
      }, 400);
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 12);

    // Create user (first user is always admin + superadmin)
    const user = await prisma.user.create({
      data: {
        email,
        password: hashedPassword,
        name,
        role: isFirstUser ? 'admin' : role,
        isSuperadmin: isFirstUser,  // Phase 3: first user is superadmin
      },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        isSuperadmin: true,
        createdAt: true,
      },
    });

    // If first user, create default site with menus
    let defaultSite = null;
    if (isFirstUser) {
      defaultSite = await prisma.site.create({
        data: {
          name: 'Default Site',
          slug: 'default',
          ownerId: user.id,
          settings: '{}',
        },
      });

      // Create default menus for the site
      await prisma.menu.createMany({
        data: [
          { name: 'Header Menu', slug: 'header', location: 'header', items: '[]', siteId: defaultSite.id },
          { name: 'Footer Menu', slug: 'footer', location: 'footer', items: '[]', siteId: defaultSite.id },
        ],
      });
    }

    return c.json({
      message: 'User created successfully',
      user,
      isFirstUser,
      ...(defaultSite && { site: { id: defaultSite.id, slug: defaultSite.slug, name: defaultSite.name } }),
    }, 201);
  } catch (error) {
    console.error('Register error:', error);
    return c.json({
      error: 'Registration failed',
      code: 'REGISTER_ERROR',
    }, 500);
  }
});

/**
 * POST /api/auth/change-password
 * Change current user's password
 */
auth.post(
  '/change-password',
  authMiddleware,
  zValidator('json', z.object({
    currentPassword: z.string().min(1, 'Current password is required'),
    newPassword: z.string().min(8, 'New password must be at least 8 characters'),
  })),
  async (c) => {
    const authUser = c.get('user');
    const { currentPassword, newPassword } = c.req.valid('json');

    try {
      const user = await prisma.user.findUnique({
        where: { id: authUser.id },
      });

      if (!user) {
        return c.json({
          error: 'User not found',
          code: 'USER_NOT_FOUND',
        }, 404);
      }

      // Verify current password
      const validPassword = await bcrypt.compare(currentPassword, user.password);
      if (!validPassword) {
        return c.json({
          error: 'Current password is incorrect',
          code: 'INVALID_PASSWORD',
        }, 400);
      }

      // Hash new password
      const hashedPassword = await bcrypt.hash(newPassword, 12);

      // Update password
      await prisma.user.update({
        where: { id: user.id },
        data: { password: hashedPassword },
      });

      // Invalidate all sessions (force re-login)
      await prisma.session.deleteMany({
        where: { userId: user.id },
      });

      return c.json({ message: 'Password changed successfully' });
    } catch (error) {
      console.error('Change password error:', error);
      return c.json({
        error: 'Failed to change password',
        code: 'CHANGE_PASSWORD_ERROR',
      }, 500);
    }
  }
);

export default auth;
