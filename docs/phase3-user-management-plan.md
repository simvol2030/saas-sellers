# Phase 3: User Management System - Implementation Plan

## Overview

Система управления пользователями с поддержкой:
- Superadmin может создавать других пользователей
- Назначение доступа к сайтам (один или несколько)
- Управление доступом к секциям админ-панели
- Расширяемая архитектура для будущих модулей

## Current State Analysis

### Существующая система ролей
```typescript
// backend-hono/src/middleware/auth.ts
role: 'admin' | 'editor' | 'viewer'
```

### Текущий контроль доступа к сайтам
```typescript
// backend-hono/src/middleware/site.ts
if (user?.role === 'admin' || foundSite.ownerId === user?.id) {
  // has access
}
```

### Текущая схема User в Prisma
```prisma
model User {
  id        Int       @id @default(autoincrement())
  email     String    @unique
  password  String
  name      String?
  role      String    @default("editor")
  createdAt DateTime  @default(now())
  updatedAt DateTime  @updatedAt
  sessions  Session[]
  sites     Site[]    @relation("SiteOwner")
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

  @@unique([userId, siteId])
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
  ownedSites   Site[]     @relation("SiteOwner")
  userSites    UserSite[]                     // NEW: site access
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
```

#### 2.2 Permission Check Logic
```typescript
// Superadmin: full access to everything
// Site owner: full access to owned sites
// UserSite: access defined by permissions JSON
```

---

## Implementation Steps

### Step 1: Database Migration

**File:** `backend-hono/prisma/schema.prisma`

1. Add `isSuperadmin` and `isActive` to User
2. Add UserSite model
3. Add relation to Site

**Commands:**
```bash
cd backend-hono
npx prisma migrate dev --name add_user_management
```

### Step 2: Permission Library

**File:** `backend-hono/src/lib/permissions.ts`

Create permission constants and helper functions:
- `ADMIN_SECTIONS` - list of sections
- `DEFAULT_PERMISSIONS` - default for new users
- `hasPermission(userSite, section)` - check access
- `getAllPermissions()` - get all sections list

### Step 3: Auth Middleware Update

**File:** `backend-hono/src/middleware/auth.ts`

Add:
- `superadminOnly` middleware
- Update `AuthUser` interface to include `isSuperadmin`

### Step 4: Site Middleware Update

**File:** `backend-hono/src/middleware/site.ts`

Update access check logic:
```typescript
// Old:
if (user?.role === 'admin' || foundSite.ownerId === user?.id)

// New:
if (user?.isSuperadmin || foundSite.ownerId === user?.id || userHasSiteAccess(user.id, siteId))
```

Add helper to check UserSite access.

### Step 5: Users API Routes

**File:** `backend-hono/src/routes/users.ts` (NEW)

Endpoints:
```
GET    /api/admin/users          - List all users (superadmin only)
GET    /api/admin/users/:id      - Get user details
POST   /api/admin/users          - Create new user
PUT    /api/admin/users/:id      - Update user
DELETE /api/admin/users/:id      - Delete user
POST   /api/admin/users/:id/sites - Assign sites to user
DELETE /api/admin/users/:id/sites/:siteId - Remove site access
PUT    /api/admin/users/:id/sites/:siteId/permissions - Update permissions
```

### Step 6: Register Routes

**File:** `backend-hono/src/index.ts`

Add users routes:
```typescript
import users from './routes/users.js';
// ...
app.route('/api/admin/users', users);
```

### Step 7: Frontend - Users Page

**File:** `frontend-astro/src/pages/admin/users/index.astro` (NEW)

Admin page for user management with Svelte components.

### Step 8: Frontend - UsersList Component

**File:** `frontend-astro/src/components/admin/UsersList.svelte` (NEW)

Features:
- Table of users with status
- Create/edit user modal
- Site assignment interface
- Permission toggles per site

### Step 9: Frontend - Navigation Update

**File:** `frontend-astro/src/layouts/Admin.astro`

Add conditional navigation item:
```typescript
// Only show for superadmin
{user?.isSuperadmin && (
  <a href="/admin/users">Пользователи</a>
)}
```

### Step 10: Permission Middleware for Sections

**File:** `backend-hono/src/middleware/permissions.ts` (NEW)

```typescript
export const requireSection = (section: AdminSection) => {
  return async (c: Context, next: Next) => {
    const user = c.get('user');
    const siteId = c.get('siteId');

    // Superadmin or site owner - full access
    if (user.isSuperadmin) {
      return next();
    }

    // Check UserSite permissions
    const userSite = await prisma.userSite.findUnique({
      where: { userId_siteId: { userId: user.id, siteId } }
    });

    if (!userSite) {
      return c.json({ error: 'No site access' }, 403);
    }

    const permissions = JSON.parse(userSite.permissions);
    if (!permissions[section]) {
      return c.json({ error: 'Section access denied' }, 403);
    }

    return next();
  };
};
```

### Step 11: Apply Section Middleware to Routes

Update existing routes to use `requireSection`:

```typescript
// pages.ts
pages.get('/', requireSection('pages'), async (c) => { ... });

// blocks.ts
blocks.get('/', requireSection('blocks'), async (c) => { ... });

// menus.ts
menus.get('/', requireSection('menus'), async (c) => { ... });
```

---

## Data Flow

### Creating a New User

1. Superadmin opens /admin/users
2. Clicks "Create User"
3. Fills form: email, password, name, role
4. Backend creates User with `isSuperadmin: false`
5. Superadmin selects sites for user
6. Backend creates UserSite records with default permissions
7. Superadmin can customize permissions per site

### User Login Flow

1. User logs in
2. Backend returns user info including `isSuperadmin`
3. Frontend stores in localStorage
4. Navigation shows/hides items based on permissions
5. API requests include X-Site-ID header
6. Backend middleware checks UserSite permissions

### Site Access Check Flow

```
Request → authMiddleware → siteMiddleware → requireSection → route handler
                              ↓
                    Check: isSuperadmin?
                              ↓ no
                    Check: site.ownerId === user.id?
                              ↓ no
                    Check: UserSite exists with permission?
                              ↓ no
                    Return 403 Forbidden
```

---

## Security Considerations

1. **Superadmin Protection**
   - First user is superadmin (already implemented)
   - Only superadmin can create other superadmins
   - Cannot delete yourself

2. **Password Security**
   - bcrypt with cost 12 (already implemented)
   - Minimum 8 characters (already implemented)

3. **Permission Validation**
   - Always check permissions server-side
   - Never trust frontend permission state
   - Validate siteId access before any operation

4. **Audit Trail** (future consideration)
   - Log user creation/modification
   - Log permission changes

---

## Migration Strategy

### For Existing Users

1. Run migration to add new fields
2. First user (id=1) gets `isSuperadmin: true`
3. Existing site owners get UserSite records with full permissions
4. Other users remain unchanged

### Migration Script

```typescript
// Run after schema migration
async function migrateExistingUsers() {
  // Set first user as superadmin
  await prisma.user.updateMany({
    where: { id: 1 },
    data: { isSuperadmin: true }
  });

  // Create UserSite for existing site owners
  const sites = await prisma.site.findMany({
    include: { owner: true }
  });

  for (const site of sites) {
    await prisma.userSite.create({
      data: {
        userId: site.ownerId,
        siteId: site.id,
        permissions: JSON.stringify({
          pages: true,
          blocks: true,
          menus: true,
          media: true,
          settings: true,
        })
      }
    });
  }
}
```

---

## File Changes Summary

### New Files
| File | Description |
|------|-------------|
| `backend-hono/src/lib/permissions.ts` | Permission constants and helpers |
| `backend-hono/src/routes/users.ts` | Users API endpoints |
| `backend-hono/src/middleware/permissions.ts` | Section access middleware |
| `frontend-astro/src/pages/admin/users/index.astro` | Users admin page |
| `frontend-astro/src/components/admin/UsersList.svelte` | User management UI |
| `frontend-astro/src/components/admin/UserForm.svelte` | Create/edit user form |
| `frontend-astro/src/components/admin/SitePermissions.svelte` | Site permission toggles |

### Modified Files
| File | Changes |
|------|---------|
| `backend-hono/prisma/schema.prisma` | Add UserSite, update User |
| `backend-hono/src/middleware/auth.ts` | Add superadminOnly |
| `backend-hono/src/middleware/site.ts` | Update access logic |
| `backend-hono/src/index.ts` | Register users routes |
| `backend-hono/src/routes/pages.ts` | Add requireSection |
| `backend-hono/src/routes/blocks.ts` | Add requireSection |
| `backend-hono/src/routes/menus.ts` | Add requireSection |
| `frontend-astro/src/layouts/Admin.astro` | Conditional nav items |
| `frontend-astro/src/lib/api.ts` | Store superadmin flag |

---

## Testing Checklist

- [ ] Superadmin can create users
- [ ] Superadmin can assign sites to users
- [ ] Superadmin can set permissions per site
- [ ] User without site access cannot see site
- [ ] User without section permission gets 403
- [ ] Site owner has full access to owned site
- [ ] First user is superadmin
- [ ] Navigation hides /admin/users from non-superadmins
- [ ] Cannot delete own account
- [ ] Disabled user cannot login
- [ ] Permission changes take effect immediately

---

## Estimated Implementation Order

1. **Database** - Schema migration (15 min)
2. **Backend Core** - Permission lib + middleware (30 min)
3. **Backend Routes** - Users API (45 min)
4. **Apply Section Middleware** - Update existing routes (20 min)
5. **Frontend Page** - Users admin page (30 min)
6. **Frontend Components** - UsersList, UserForm, SitePermissions (60 min)
7. **Frontend Navigation** - Conditional items (10 min)
8. **Testing** - Full flow verification (30 min)
9. **Migration Script** - Handle existing data (15 min)

---

## Notes

- Keeping existing `role` field for backwards compatibility
- `isSuperadmin` is a separate flag, not a role value
- Permissions stored as JSON string for flexibility
- Section list in `permissions.ts` is single source of truth

---

## AUDIT RESULTS

### Issue #1: Missing auth.ts routes update (HIGH)
**Problem:** Plan mentions updating middleware but doesn't update auth.ts routes to return `isSuperadmin` in login response.
**Fix:** Add Step 3.1 - Update auth.ts routes:
```typescript
// In POST /login response:
return c.json({
  user: {
    id: user.id,
    email: user.email,
    name: user.name,
    role: user.role,
    isSuperadmin: user.isSuperadmin, // ADD THIS
  },
  accessToken,
  refreshToken,
});
```

### Issue #2: Missing frontend token storage update (HIGH)
**Problem:** Plan mentions storing `isSuperadmin` but doesn't specify where/how.
**Fix:** Update Step 7 - Add to login page handling:
```typescript
// frontend-astro/src/pages/admin/login.astro (or login handler)
localStorage.setItem('user', JSON.stringify(data.user)); // includes isSuperadmin
```

### Issue #3: Route middleware application strategy unclear (MEDIUM)
**Problem:** Current routes use `pages.use('*', editorOrAdmin)` but plan suggests per-route `requireSection`.
**Fix:** Clarify that `requireSection` REPLACES `editorOrAdmin` for section-based routes:
```typescript
// Before:
pages.use('*', editorOrAdmin);

// After:
pages.use('*', requireSection('pages'));
// Remove editorOrAdmin - permission check is now in requireSection
```

### Issue #4: isActive check missing in login flow (HIGH)
**Problem:** Adding `isActive` field but not checking it during login.
**Fix:** Add to Step 3.1 - Update login route:
```typescript
// In POST /login:
if (!user.isActive) {
  return c.json({
    error: 'Account is disabled',
    code: 'ACCOUNT_DISABLED',
  }, 403);
}
```

### Issue #5: Site owner check needs update in requireSection (MEDIUM)
**Problem:** `requireSection` only checks superadmin but not site owner.
**Fix:** Update Step 10:
```typescript
export const requireSection = (section: AdminSection) => {
  return async (c: Context, next: Next) => {
    const user = c.get('user');
    const site = c.get('site');

    // Superadmin - full access
    if (user.isSuperadmin) {
      return next();
    }

    // Site owner - full access to their site
    if (site && site.ownerId === user.id) {  // ADD THIS CHECK
      return next();
    }

    // Check UserSite permissions
    // ... rest of the code
  };
};
```

### Issue #6: UserSite unique constraint name (LOW)
**Problem:** Prisma generates compound unique name as `userId_siteId` but this should be verified.
**Fix:** Explicitly name the constraint:
```prisma
@@unique([userId, siteId], name: "userId_siteId")
```

### Issue #7: Missing `/api/admin/users/me/permissions` endpoint (MEDIUM)
**Problem:** Frontend needs to know current user's permissions for current site to show/hide nav items.
**Fix:** Add endpoint:
```
GET /api/admin/users/me/permissions - Get current user's permissions for current site
```
Response:
```json
{
  "isSuperadmin": false,
  "isSiteOwner": true,
  "permissions": { "pages": true, "blocks": true, ... }
}
```

### Issue #8: Migration script may fail on duplicate UserSite (LOW)
**Problem:** If owner already has UserSite record, migration script will fail on unique constraint.
**Fix:** Use upsert instead of create:
```typescript
await prisma.userSite.upsert({
  where: { userId_siteId: { userId: site.ownerId, siteId: site.id } },
  create: { userId: site.ownerId, siteId: site.id, permissions: '...' },
  update: {} // no update needed
});
```

---

## AUDIT SUMMARY

| Severity | Count | Status |
|----------|-------|--------|
| HIGH     | 3     | Fixes documented |
| MEDIUM   | 3     | Fixes documented |
| LOW      | 2     | Fixes documented |

**Conclusion:** Plan is viable with documented fixes. All issues are addressable during implementation.
