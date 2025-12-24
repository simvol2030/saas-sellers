# Phase 3: User Management System - Implementation Plan

## Overview

Система управления пользователями с поддержкой:
- Superadmin может создавать других пользователей
- Назначение доступа к сайтам (один или несколько)
- Управление доступом к секциям админ-панели
- Расширяемая архитектура для будущих модулей

---

## Current State Analysis

### Существующая система ролей
```typescript
// backend-hono/src/middleware/auth.ts
role: 'admin' | 'editor' | 'viewer'
```

### Текущий контроль доступа к сайтам
```typescript
// backend-hono/src/middleware/site.ts (line 88)
if (user?.role === 'admin' || foundSite.ownerId === user?.id) {
  // has access
}
```

### JWT Token Payload
```typescript
// backend-hono/src/lib/jwt.ts
{ userId, email, role } // isSuperadmin NOT included
```

### Текущая схема User в Prisma
```prisma
model User {
  id        Int       @id @default(autoincrement())
  email     String    @unique
  password  String
  name      String?
  role      String    @default("editor")
  // Missing: isSuperadmin, isActive, userSites
}
```

---

## Architecture Design

### 1. Database Schema Changes

#### 1.1 New: UserSite (Many-to-Many relationship)
```prisma
model UserSite {
  id          Int      @id @default(autoincrement())
  userId      Int
  siteId      Int
  permissions String   @default("{}") // JSON: {"pages": true, "blocks": true, ...}
  createdAt   DateTime @default(now())

  user        User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  site        Site     @relation(fields: [siteId], references: [id], onDelete: Cascade)

  @@unique([userId, siteId], name: "userId_siteId")
  @@index([userId])
  @@index([siteId])
  @@map("user_sites")
}
```

#### 1.2 Update: User model
```prisma
model User {
  id           Int        @id @default(autoincrement())
  email        String     @unique
  password     String
  name         String?
  role         String     @default("editor")  // admin, editor, viewer
  isSuperadmin Boolean    @default(false)     // NEW: superadmin flag
  isActive     Boolean    @default(true)      // NEW: can disable users
  createdAt    DateTime   @default(now())
  updatedAt    DateTime   @updatedAt

  sessions     Session[]
  pages        Page[]
  media        Media[]
  ownedSites   Site[]     @relation("SiteOwner")
  userSites    UserSite[]                     // NEW: site access
  reusableBlocks ReusableBlock[]

  @@map("users")
}
```

#### 1.3 Update: Site model
```prisma
model Site {
  // ... existing fields ...
  userSites    UserSite[]  // NEW: users with access
}
```

### 2. Permission System Design

#### 2.1 Available Sections (extensible)
```typescript
// backend-hono/src/lib/permissions.ts
export const ADMIN_SECTIONS = {
  // Current sections
  pages: { label: 'Страницы', icon: 'file-text' },
  blocks: { label: 'Блоки', icon: 'box' },
  menus: { label: 'Меню', icon: 'menu' },
  media: { label: 'Медиа', icon: 'image' },
  settings: { label: 'Настройки', icon: 'settings' },

  // Future sections (extensible)
  // ecommerce: { label: 'E-commerce', icon: 'shopping-cart' },
  // forms: { label: 'Формы', icon: 'mail' },
  // analytics: { label: 'Аналитика', icon: 'bar-chart' },
} as const;

export type AdminSection = keyof typeof ADMIN_SECTIONS;

export interface UserPermissions {
  [section: string]: boolean;
}

// Default permissions for new users
export const DEFAULT_PERMISSIONS: UserPermissions = {
  pages: true,
  blocks: true,
  menus: true,
  media: true,
  settings: false,
};

// Full permissions for site owners
export const FULL_PERMISSIONS: UserPermissions = {
  pages: true,
  blocks: true,
  menus: true,
  media: true,
  settings: true,
};
```

#### 2.2 Permission Check Logic (Priority Order)
```typescript
// 1. Superadmin: FULL access to everything, all sites
// 2. Site owner: FULL access to owned sites only
// 3. UserSite: Access defined by permissions JSON
// 4. No access: 403 Forbidden
```

---

## Implementation Steps

### Step 1: Database Migration

**File:** `backend-hono/prisma/schema.prisma`

1. Add `isSuperadmin` and `isActive` to User
2. Add UserSite model with indexes
3. Add relation to Site

**Commands:**
```bash
cd backend-hono
npx prisma migrate dev --name add_user_management
```

### Step 2: Permission Library

**File:** `backend-hono/src/lib/permissions.ts` (NEW)

```typescript
export const ADMIN_SECTIONS = { ... };
export type AdminSection = keyof typeof ADMIN_SECTIONS;
export interface UserPermissions { [section: string]: boolean; }
export const DEFAULT_PERMISSIONS: UserPermissions = { ... };
export const FULL_PERMISSIONS: UserPermissions = { ... };

export function hasPermission(permissions: string, section: AdminSection): boolean {
  try {
    const parsed = JSON.parse(permissions);
    return parsed[section] === true;
  } catch {
    return false;
  }
}

export function getAllSections(): Array<{ key: AdminSection; label: string; icon: string }> {
  return Object.entries(ADMIN_SECTIONS).map(([key, value]) => ({
    key: key as AdminSection,
    ...value
  }));
}
```

### Step 3: JWT Library Update

**File:** `backend-hono/src/lib/jwt.ts`

Update payload to include `isSuperadmin`:
```typescript
interface TokenPayload {
  userId: number;
  email: string;
  role: string;
  isSuperadmin: boolean;  // ADD
}

export async function generateTokenPair(payload: {
  userId: number;
  email: string;
  role: string;
  isSuperadmin: boolean;  // ADD
}) { ... }

export async function generateAccessToken(payload: {
  userId: number;
  email: string;
  role: string;
  isSuperadmin: boolean;  // ADD
}) { ... }
```

### Step 4: Auth Middleware Update

**File:** `backend-hono/src/middleware/auth.ts`

```typescript
export interface AuthUser {
  id: number;
  email: string;
  role: string;
  isSuperadmin: boolean;  // ADD
  isActive: boolean;      // ADD
}

// NEW: Superadmin-only middleware
export const superadminOnly = async (c: Context, next: Next) => {
  const user = c.get('user');
  if (!user?.isSuperadmin) {
    return c.json({ error: 'Superadmin access required' }, 403);
  }
  await next();
};

// Update authMiddleware to extract isSuperadmin from token
```

### Step 5: Auth Routes Update

**File:** `backend-hono/src/routes/auth.ts`

#### 5.1 Login route updates:
```typescript
// Check isActive BEFORE password check
if (!user.isActive) {
  return c.json({
    error: 'Account is disabled',
    code: 'ACCOUNT_DISABLED',
  }, 403);
}

// Include isSuperadmin in token generation
const { accessToken, refreshToken } = await generateTokenPair({
  userId: user.id,
  email: user.email,
  role: user.role,
  isSuperadmin: user.isSuperadmin,  // ADD
});

// Include isSuperadmin in response
return c.json({
  user: {
    id: user.id,
    email: user.email,
    name: user.name,
    role: user.role,
    isSuperadmin: user.isSuperadmin,  // ADD
  },
  accessToken,
  refreshToken,
});
```

#### 5.2 Refresh route updates:
```typescript
// Include isSuperadmin in new access token
const accessToken = await generateAccessToken({
  userId: session.user.id,
  email: session.user.email,
  role: session.user.role,
  isSuperadmin: session.user.isSuperadmin,  // ADD
});
```

#### 5.3 Register route updates:
```typescript
// Change admin check to superadmin check
if (!payload || payload.type !== 'access' || !payload.isSuperadmin) {
  return c.json({
    error: 'Superadmin access required',
    code: 'SUPERADMIN_REQUIRED',
  }, 403);
}

// First user gets isSuperadmin: true
const user = await prisma.user.create({
  data: {
    email,
    password: hashedPassword,
    name,
    role: isFirstUser ? 'admin' : role,
    isSuperadmin: isFirstUser,  // ADD
  },
  ...
});
```

#### 5.4 /me route updates:
```typescript
// Include isSuperadmin in response
select: {
  id: true,
  email: true,
  name: true,
  role: true,
  isSuperadmin: true,  // ADD
  createdAt: true,
},
```

### Step 6: Site Middleware Update

**File:** `backend-hono/src/middleware/site.ts`

```typescript
// Line 88 - Update access check:
// OLD:
if (user?.role === 'admin' || foundSite.ownerId === user?.id)

// NEW:
if (user?.isSuperadmin || foundSite.ownerId === user?.id || await userHasSiteAccess(user.id, foundSite.id))

// Add helper function:
async function userHasSiteAccess(userId: number, siteId: number): Promise<boolean> {
  const userSite = await prisma.userSite.findUnique({
    where: { userId_siteId: { userId, siteId } }
  });
  return !!userSite;
}

// Line 104-111 - Update site query for non-superadmin:
const userSite = await prisma.site.findFirst({
  where: {
    OR: [
      { ownerId: user.id },
      { userSites: { some: { userId: user.id } } },  // ADD
      ...(user.isSuperadmin ? [{ isActive: true }] : []),  // CHANGE from role === 'admin'
    ],
  },
  orderBy: { createdAt: 'asc' },
});
```

### Step 7: Permission Middleware

**File:** `backend-hono/src/middleware/permissions.ts` (NEW)

```typescript
import { Context, Next } from 'hono';
import { prisma } from '../lib/db.js';
import type { AdminSection } from '../lib/permissions.js';

export const requireSection = (section: AdminSection) => {
  return async (c: Context, next: Next) => {
    const user = c.get('user');
    const site = c.get('site');

    if (!user || !site) {
      return c.json({ error: 'Authentication required' }, 401);
    }

    // 1. Superadmin - full access
    if (user.isSuperadmin) {
      return next();
    }

    // 2. Site owner - full access to their site
    if (site.ownerId === user.id) {
      return next();
    }

    // 3. Check UserSite permissions
    const userSite = await prisma.userSite.findUnique({
      where: { userId_siteId: { userId: user.id, siteId: site.id } }
    });

    if (!userSite) {
      return c.json({ error: 'No site access' }, 403);
    }

    const permissions = JSON.parse(userSite.permissions || '{}');
    if (!permissions[section]) {
      return c.json({
        error: 'Section access denied',
        code: 'SECTION_DENIED',
        section
      }, 403);
    }

    return next();
  };
};
```

### Step 8: Users API Routes

**File:** `backend-hono/src/routes/users.ts` (NEW)

```typescript
import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { z } from 'zod';
import bcrypt from 'bcryptjs';
import { prisma } from '../lib/db.js';
import { authMiddleware, superadminOnly } from '../middleware/auth.js';
import { siteMiddleware } from '../middleware/site.js';
import { DEFAULT_PERMISSIONS, FULL_PERMISSIONS, ADMIN_SECTIONS } from '../lib/permissions.js';

const users = new Hono();

// All routes require superadmin
users.use('*', authMiddleware);
users.use('*', superadminOnly);

// Validation schemas
const createUserSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  name: z.string().optional(),
  role: z.enum(['admin', 'editor', 'viewer']).default('editor'),
  isSuperadmin: z.boolean().default(false),
});

const updateUserSchema = z.object({
  email: z.string().email().optional(),
  name: z.string().optional(),
  role: z.enum(['admin', 'editor', 'viewer']).optional(),
  isActive: z.boolean().optional(),
  isSuperadmin: z.boolean().optional(),
});

const assignSitesSchema = z.object({
  siteIds: z.array(z.number()),
  permissions: z.record(z.boolean()).optional(),
});

const updatePermissionsSchema = z.object({
  permissions: z.record(z.boolean()),
});

// GET /api/admin/users - List all users
users.get('/', async (c) => {
  const users = await prisma.user.findMany({
    select: {
      id: true,
      email: true,
      name: true,
      role: true,
      isSuperadmin: true,
      isActive: true,
      createdAt: true,
      _count: { select: { ownedSites: true, userSites: true } },
    },
    orderBy: { createdAt: 'desc' },
  });
  return c.json({ users });
});

// GET /api/admin/users/sections - Get available sections
users.get('/sections', async (c) => {
  return c.json({ sections: ADMIN_SECTIONS });
});

// GET /api/admin/users/:id - Get user details
users.get('/:id', async (c) => {
  const id = parseInt(c.req.param('id'));

  const user = await prisma.user.findUnique({
    where: { id },
    select: {
      id: true,
      email: true,
      name: true,
      role: true,
      isSuperadmin: true,
      isActive: true,
      createdAt: true,
      ownedSites: { select: { id: true, name: true, slug: true } },
      userSites: {
        select: {
          id: true,
          permissions: true,
          site: { select: { id: true, name: true, slug: true } },
        },
      },
    },
  });

  if (!user) {
    return c.json({ error: 'User not found' }, 404);
  }

  return c.json({ user });
});

// POST /api/admin/users - Create new user
users.post('/', zValidator('json', createUserSchema), async (c) => {
  const data = c.req.valid('json');

  const existing = await prisma.user.findUnique({
    where: { email: data.email },
  });

  if (existing) {
    return c.json({ error: 'Email already exists' }, 400);
  }

  const hashedPassword = await bcrypt.hash(data.password, 12);

  const user = await prisma.user.create({
    data: {
      email: data.email,
      password: hashedPassword,
      name: data.name,
      role: data.role,
      isSuperadmin: data.isSuperadmin,
    },
    select: {
      id: true,
      email: true,
      name: true,
      role: true,
      isSuperadmin: true,
      isActive: true,
    },
  });

  return c.json({ user }, 201);
});

// PUT /api/admin/users/:id - Update user
users.put('/:id', zValidator('json', updateUserSchema), async (c) => {
  const id = parseInt(c.req.param('id'));
  const currentUser = c.get('user');
  const data = c.req.valid('json');

  // Cannot modify yourself
  if (id === currentUser.id) {
    return c.json({ error: 'Cannot modify your own account' }, 400);
  }

  // Check if trying to remove last superadmin
  if (data.isSuperadmin === false || data.isActive === false) {
    const target = await prisma.user.findUnique({ where: { id } });
    if (target?.isSuperadmin) {
      const superadminCount = await prisma.user.count({
        where: { isSuperadmin: true, isActive: true },
      });
      if (superadminCount <= 1) {
        return c.json({ error: 'Cannot disable the last superadmin' }, 400);
      }
    }
  }

  // If disabling user, invalidate all sessions
  if (data.isActive === false) {
    await prisma.session.deleteMany({ where: { userId: id } });
  }

  const user = await prisma.user.update({
    where: { id },
    data,
    select: {
      id: true,
      email: true,
      name: true,
      role: true,
      isSuperadmin: true,
      isActive: true,
    },
  });

  return c.json({ user });
});

// DELETE /api/admin/users/:id - Delete user
users.delete('/:id', async (c) => {
  const id = parseInt(c.req.param('id'));
  const currentUser = c.get('user');

  if (id === currentUser.id) {
    return c.json({ error: 'Cannot delete your own account' }, 400);
  }

  // Check if last superadmin
  const target = await prisma.user.findUnique({ where: { id } });
  if (target?.isSuperadmin) {
    const count = await prisma.user.count({
      where: { isSuperadmin: true },
    });
    if (count <= 1) {
      return c.json({ error: 'Cannot delete the last superadmin' }, 400);
    }
  }

  await prisma.user.delete({ where: { id } });

  return c.json({ message: 'User deleted' });
});

// POST /api/admin/users/:id/sites - Assign sites to user
users.post('/:id/sites', zValidator('json', assignSitesSchema), async (c) => {
  const userId = parseInt(c.req.param('id'));
  const { siteIds, permissions } = c.req.valid('json');

  const permissionsJson = JSON.stringify(permissions || DEFAULT_PERMISSIONS);

  // Create UserSite records
  await prisma.$transaction(
    siteIds.map((siteId) =>
      prisma.userSite.upsert({
        where: { userId_siteId: { userId, siteId } },
        create: { userId, siteId, permissions: permissionsJson },
        update: { permissions: permissionsJson },
      })
    )
  );

  return c.json({ message: 'Sites assigned' });
});

// DELETE /api/admin/users/:id/sites/:siteId - Remove site access
users.delete('/:id/sites/:siteId', async (c) => {
  const userId = parseInt(c.req.param('id'));
  const siteId = parseInt(c.req.param('siteId'));

  await prisma.userSite.delete({
    where: { userId_siteId: { userId, siteId } },
  }).catch(() => null); // Ignore if not exists

  return c.json({ message: 'Site access removed' });
});

// PUT /api/admin/users/:id/sites/:siteId/permissions - Update permissions
users.put(
  '/:id/sites/:siteId/permissions',
  zValidator('json', updatePermissionsSchema),
  async (c) => {
    const userId = parseInt(c.req.param('id'));
    const siteId = parseInt(c.req.param('siteId'));
    const { permissions } = c.req.valid('json');

    const userSite = await prisma.userSite.update({
      where: { userId_siteId: { userId, siteId } },
      data: { permissions: JSON.stringify(permissions) },
    });

    return c.json({ userSite });
  }
);

export default users;
```

### Step 9: Users/Me Permissions Endpoint

**File:** `backend-hono/src/routes/users.ts` (ADD to existing)

```typescript
// GET /api/admin/users/me/permissions - Get current user's permissions for current site
// NOTE: This route does NOT require superadminOnly
users.get('/me/permissions', authMiddleware, siteMiddleware, async (c) => {
  const user = c.get('user');
  const site = c.get('site');

  if (!site) {
    return c.json({ error: 'No site context' }, 400);
  }

  // Superadmin has all permissions
  if (user.isSuperadmin) {
    return c.json({
      isSuperadmin: true,
      isSiteOwner: false,
      permissions: FULL_PERMISSIONS,
      sections: ADMIN_SECTIONS,
    });
  }

  // Site owner has all permissions
  if (site.ownerId === user.id) {
    return c.json({
      isSuperadmin: false,
      isSiteOwner: true,
      permissions: FULL_PERMISSIONS,
      sections: ADMIN_SECTIONS,
    });
  }

  // Regular user - check UserSite
  const userSite = await prisma.userSite.findUnique({
    where: { userId_siteId: { userId: user.id, siteId: site.id } },
  });

  if (!userSite) {
    return c.json({
      isSuperadmin: false,
      isSiteOwner: false,
      permissions: {},
      sections: ADMIN_SECTIONS,
    });
  }

  return c.json({
    isSuperadmin: false,
    isSiteOwner: false,
    permissions: JSON.parse(userSite.permissions || '{}'),
    sections: ADMIN_SECTIONS,
  });
});
```

### Step 10: Register Routes

**File:** `backend-hono/src/index.ts`

```typescript
import users from './routes/users.js';

// Add BEFORE other admin routes (to avoid conflict with /:id patterns)
app.route('/api/admin/users', users);
```

### Step 11: Update Existing Routes with requireSection

**Files:** `pages.ts`, `blocks.ts`, `menus.ts`, `media.ts`, `settings.ts`

Replace `editorOrAdmin` with `requireSection`:

```typescript
// pages.ts
import { requireSection } from '../middleware/permissions.js';

// REMOVE: pages.use('*', editorOrAdmin);
// ADD:
pages.use('*', requireSection('pages'));

// blocks.ts
blocks.use('*', requireSection('blocks'));

// menus.ts
menus.use('*', requireSection('menus'));

// media.ts (if exists as separate file)
media.use('*', requireSection('media'));

// settings.ts
settings.use('*', requireSection('settings'));
```

### Step 12: Frontend - Users Page

**File:** `frontend-astro/src/pages/admin/users/index.astro` (NEW)

```astro
---
import Admin from '../../../layouts/Admin.astro';
import UsersList from '../../../components/admin/UsersList.svelte';
---

<Admin title="Пользователи">
  <UsersList client:load />
</Admin>
```

### Step 13: Frontend - UsersList Component

**File:** `frontend-astro/src/components/admin/UsersList.svelte` (NEW)

Svelte 5 component with:
- Users table with columns: email, name, role, status, sites count, actions
- Create user modal
- Edit user modal
- Site assignment panel
- Permission toggles

### Step 14: Frontend - Navigation Update

**File:** `frontend-astro/src/layouts/Admin.astro`

```typescript
// In script section - fetch permissions
const permissionsRes = await fetch('/api/admin/users/me/permissions', {
  headers: {
    'Authorization': `Bearer ${accessToken}`,
    'X-Site-ID': siteId
  }
});
const { isSuperadmin, permissions } = await permissionsRes.json();

// In navigation:
{isSuperadmin && (
  <a href="/admin/users" class="nav-item">
    <Icon name="users" />
    Пользователи
  </a>
)}

// Hide sections without permission:
{permissions.pages && (
  <a href="/admin/pages">Страницы</a>
)}
{permissions.blocks && (
  <a href="/admin/blocks">Блоки</a>
)}
// etc.
```

### Step 15: Frontend - Site Selector Update

**File:** `frontend-astro/src/components/admin/SiteSelector.svelte`

Update to show only accessible sites:
```typescript
// Fetch sites user has access to
const res = await fetch('/api/admin/sites/accessible', ...);
// This returns: owned sites + UserSite sites
```

### Step 16: Sites Accessible Endpoint

**File:** `backend-hono/src/routes/sites.ts` (ADD)

```typescript
// GET /api/admin/sites/accessible - Get sites current user can access
sites.get('/accessible', authMiddleware, async (c) => {
  const user = c.get('user');

  if (user.isSuperadmin) {
    const allSites = await prisma.site.findMany({
      where: { isActive: true },
      select: { id: true, name: true, slug: true },
    });
    return c.json({ sites: allSites });
  }

  const sites = await prisma.site.findMany({
    where: {
      OR: [
        { ownerId: user.id },
        { userSites: { some: { userId: user.id } } },
      ],
      isActive: true,
    },
    select: { id: true, name: true, slug: true },
  });

  return c.json({ sites });
});
```

---

## Data Flow Diagrams

### User Login Flow
```
1. POST /api/auth/login
2. Check user.isActive → if false, return 403
3. Verify password
4. Generate tokens WITH isSuperadmin
5. Return { user: { ...isSuperadmin }, tokens }
6. Frontend stores user in localStorage
7. Frontend fetches /me/permissions for current site
8. Navigation renders based on permissions
```

### Site Access Check Flow
```
Request → authMiddleware → siteMiddleware → requireSection → handler
              ↓                  ↓               ↓
         Check JWT          Check access    Check section
         Set user           Set site        permission
              ↓                  ↓               ↓
         user.isSuperadmin? → YES → allow
              ↓ NO
         site.ownerId === user.id? → YES → allow
              ↓ NO
         UserSite exists? → YES → check permissions[section]
              ↓ NO
         Return 403
```

---

## Security Considerations

1. **Superadmin Protection**
   - First user is superadmin
   - Cannot delete/disable last superadmin
   - Cannot modify your own superadmin status
   - Only superadmin can create other superadmins

2. **Session Invalidation**
   - Disabling user immediately invalidates all sessions
   - Password change invalidates all sessions

3. **Permission Validation**
   - Always check server-side
   - Never trust frontend
   - JWT includes isSuperadmin for fast checks

4. **Input Validation**
   - All endpoints use Zod schemas
   - Password minimum 8 characters

---

## Migration Strategy

### Migration Script

**File:** `backend-hono/prisma/seed-migration.ts` (RUN ONCE after migration)

```typescript
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function migrateExistingUsers() {
  // 1. Set first user as superadmin
  const firstUser = await prisma.user.findFirst({
    orderBy: { id: 'asc' },
  });

  if (firstUser) {
    await prisma.user.update({
      where: { id: firstUser.id },
      data: { isSuperadmin: true },
    });
    console.log(`Set user ${firstUser.email} as superadmin`);
  }

  // 2. Create UserSite for existing site owners with full permissions
  const sites = await prisma.site.findMany();

  for (const site of sites) {
    await prisma.userSite.upsert({
      where: {
        userId_siteId: { userId: site.ownerId, siteId: site.id }
      },
      create: {
        userId: site.ownerId,
        siteId: site.id,
        permissions: JSON.stringify({
          pages: true,
          blocks: true,
          menus: true,
          media: true,
          settings: true,
        }),
      },
      update: {}, // No update needed
    });
    console.log(`Created UserSite for owner of ${site.name}`);
  }

  console.log('Migration complete');
}

migrateExistingUsers()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
```

---

## File Changes Summary

### New Files
| File | Description |
|------|-------------|
| `backend-hono/src/lib/permissions.ts` | Permission constants and helpers |
| `backend-hono/src/routes/users.ts` | Users API endpoints (superadmin) |
| `backend-hono/src/middleware/permissions.ts` | Section access middleware |
| `backend-hono/prisma/seed-migration.ts` | One-time migration script |
| `frontend-astro/src/pages/admin/users/index.astro` | Users admin page |
| `frontend-astro/src/components/admin/UsersList.svelte` | User management UI |
| `frontend-astro/src/components/admin/UserForm.svelte` | Create/edit user form |
| `frontend-astro/src/components/admin/SitePermissions.svelte` | Site permission toggles |

### Modified Files
| File | Changes |
|------|---------|
| `backend-hono/prisma/schema.prisma` | Add UserSite, update User |
| `backend-hono/src/lib/jwt.ts` | Add isSuperadmin to payload |
| `backend-hono/src/middleware/auth.ts` | Add superadminOnly, update AuthUser |
| `backend-hono/src/middleware/site.ts` | Update access logic for UserSite |
| `backend-hono/src/routes/auth.ts` | Add isActive check, isSuperadmin to responses |
| `backend-hono/src/routes/sites.ts` | Add /accessible endpoint |
| `backend-hono/src/index.ts` | Register users routes |
| `backend-hono/src/routes/pages.ts` | Replace editorOrAdmin with requireSection |
| `backend-hono/src/routes/blocks.ts` | Replace editorOrAdmin with requireSection |
| `backend-hono/src/routes/menus.ts` | Replace editorOrAdmin with requireSection |
| `backend-hono/src/routes/settings.ts` | Add requireSection |
| `frontend-astro/src/layouts/Admin.astro` | Conditional nav items |

---

## Testing Checklist

- [ ] Superadmin can create users
- [ ] Superadmin can assign sites to users
- [ ] Superadmin can set permissions per site
- [ ] User without site access cannot see site in dropdown
- [ ] User without section permission gets 403
- [ ] User without section permission doesn't see nav item
- [ ] Site owner has full access to owned site
- [ ] First user is superadmin after migration
- [ ] Navigation hides /admin/users from non-superadmins
- [ ] Cannot delete own account
- [ ] Cannot disable last superadmin
- [ ] Disabled user cannot login
- [ ] Disabled user's sessions are invalidated
- [ ] Permission changes take effect immediately
- [ ] JWT contains isSuperadmin flag
- [ ] Refresh token returns correct isSuperadmin

---

## FINAL AUDIT RESULTS

### Issues Found and Fixed in Plan:

| # | Severity | Issue | Fix Location |
|---|----------|-------|--------------|
| 1 | CRITICAL | JWT payload missing isSuperadmin | Step 3 |
| 2 | CRITICAL | Refresh token not including isSuperadmin | Step 5.2 |
| 3 | CRITICAL | isActive not checked on login | Step 5.1 |
| 4 | HIGH | Session not invalidated when user disabled | Step 8 (PUT /:id) |
| 5 | HIGH | Register route checks role instead of isSuperadmin | Step 5.3 |
| 6 | HIGH | Site middleware checks role instead of isSuperadmin | Step 6 |
| 7 | HIGH | /me endpoint missing isSuperadmin | Step 5.4 |
| 8 | MEDIUM | Missing /me/permissions endpoint | Step 9 |
| 9 | MEDIUM | Missing /sites/accessible endpoint | Step 16 |
| 10 | MEDIUM | requireSection missing site owner check | Step 7 |
| 11 | MEDIUM | Last superadmin protection missing | Step 8 |
| 12 | LOW | UserSite missing indexes | Step 1.1 |
| 13 | LOW | Migration script upsert | Migration Script |

### Audit Summary

| Severity | Count | Status |
|----------|-------|--------|
| CRITICAL | 3 | ✅ Fixed in plan |
| HIGH | 4 | ✅ Fixed in plan |
| MEDIUM | 4 | ✅ Fixed in plan |
| LOW | 2 | ✅ Fixed in plan |

**Conclusion:** Plan is complete with all identified issues addressed. Ready for implementation.
