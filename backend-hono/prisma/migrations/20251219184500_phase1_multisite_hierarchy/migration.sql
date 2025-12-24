-- Phase 1: Multisite, Page Hierarchy, Tags, Media Folders, Reusable Blocks, Menus
-- This migration adds multisite support and new content organization features

-- ==========================================
-- 1. Create SITES table
-- ==========================================
CREATE TABLE "sites" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "domain" TEXT,
    "subdomain" TEXT,
    "ownerId" INTEGER NOT NULL,
    "settings" TEXT NOT NULL DEFAULT '{}',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "sites_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "users" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "sites_slug_key" ON "sites"("slug");
CREATE UNIQUE INDEX "sites_domain_key" ON "sites"("domain");
CREATE UNIQUE INDEX "sites_subdomain_key" ON "sites"("subdomain");

-- ==========================================
-- 2. Create TAGS table
-- ==========================================
CREATE TABLE "tags" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "color" TEXT,
    "siteId" INTEGER NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "tags_siteId_fkey" FOREIGN KEY ("siteId") REFERENCES "sites" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "tags_siteId_slug_key" ON "tags"("siteId", "slug");
CREATE INDEX "tags_siteId_idx" ON "tags"("siteId");

-- ==========================================
-- 3. Create PAGE_TAGS junction table
-- ==========================================
CREATE TABLE "page_tags" (
    "pageId" INTEGER NOT NULL,
    "tagId" INTEGER NOT NULL,
    PRIMARY KEY ("pageId", "tagId"),
    CONSTRAINT "page_tags_pageId_fkey" FOREIGN KEY ("pageId") REFERENCES "pages" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "page_tags_tagId_fkey" FOREIGN KEY ("tagId") REFERENCES "tags" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- ==========================================
-- 4. Create MEDIA_FOLDERS table
-- ==========================================
CREATE TABLE "media_folders" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "parentId" INTEGER,
    "siteId" INTEGER NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "media_folders_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "media_folders" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "media_folders_siteId_fkey" FOREIGN KEY ("siteId") REFERENCES "sites" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "media_folders_siteId_parentId_slug_key" ON "media_folders"("siteId", "parentId", "slug");
CREATE INDEX "media_folders_siteId_idx" ON "media_folders"("siteId");
CREATE INDEX "media_folders_parentId_idx" ON "media_folders"("parentId");

-- ==========================================
-- 5. Create REUSABLE_BLOCKS table
-- ==========================================
CREATE TABLE "reusable_blocks" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "description" TEXT,
    "sections" TEXT NOT NULL DEFAULT '[]',
    "category" TEXT,
    "thumbnail" TEXT,
    "siteId" INTEGER NOT NULL,
    "authorId" INTEGER NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "reusable_blocks_siteId_fkey" FOREIGN KEY ("siteId") REFERENCES "sites" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "reusable_blocks_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "users" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "reusable_blocks_siteId_slug_key" ON "reusable_blocks"("siteId", "slug");
CREATE INDEX "reusable_blocks_siteId_idx" ON "reusable_blocks"("siteId");
CREATE INDEX "reusable_blocks_authorId_idx" ON "reusable_blocks"("authorId");

-- ==========================================
-- 6. Create BLOCK_USAGES table
-- ==========================================
CREATE TABLE "block_usages" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "blockId" INTEGER NOT NULL,
    "pageId" INTEGER NOT NULL,
    "position" INTEGER NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "block_usages_blockId_fkey" FOREIGN KEY ("blockId") REFERENCES "reusable_blocks" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "block_usages_pageId_fkey" FOREIGN KEY ("pageId") REFERENCES "pages" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "block_usages_pageId_position_key" ON "block_usages"("pageId", "position");
CREATE INDEX "block_usages_blockId_idx" ON "block_usages"("blockId");
CREATE INDEX "block_usages_pageId_idx" ON "block_usages"("pageId");

-- ==========================================
-- 7. Create MENUS table
-- ==========================================
CREATE TABLE "menus" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "location" TEXT NOT NULL DEFAULT 'header',
    "items" TEXT NOT NULL DEFAULT '[]',
    "siteId" INTEGER NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "menus_siteId_fkey" FOREIGN KEY ("siteId") REFERENCES "sites" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "menus_siteId_slug_key" ON "menus"("siteId", "slug");
CREATE INDEX "menus_siteId_idx" ON "menus"("siteId");

-- ==========================================
-- 8. Migrate existing tables (add new columns)
-- ==========================================

-- First, create a default site for existing data
INSERT INTO "sites" ("name", "slug", "ownerId", "settings", "isActive", "createdAt", "updatedAt")
SELECT 'Default Site', 'default',
    COALESCE((SELECT "id" FROM "users" WHERE "role" = 'admin' LIMIT 1), 1),
    '{}', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
WHERE EXISTS (SELECT 1 FROM "users" LIMIT 1);

-- 8.1 Migrate PAGES table
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;

CREATE TABLE "new_pages" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "slug" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "sections" TEXT NOT NULL DEFAULT '[]',
    "headerConfig" TEXT,
    "footerConfig" TEXT,
    "hideHeader" BOOLEAN NOT NULL DEFAULT false,
    "hideFooter" BOOLEAN NOT NULL DEFAULT false,
    "metaTitle" TEXT,
    "metaDescription" TEXT,
    "ogImage" TEXT,
    "canonicalUrl" TEXT,
    "noindex" BOOLEAN NOT NULL DEFAULT false,
    "status" TEXT NOT NULL DEFAULT 'draft',
    "publishedAt" DATETIME,
    "prerender" BOOLEAN NOT NULL DEFAULT true,
    "siteId" INTEGER NOT NULL DEFAULT 1,
    "parentId" INTEGER,
    "order" INTEGER NOT NULL DEFAULT 0,
    "level" INTEGER NOT NULL DEFAULT 0,
    "path" TEXT,
    "authorId" INTEGER NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "pages_siteId_fkey" FOREIGN KEY ("siteId") REFERENCES "sites" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "pages_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "pages" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "pages_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "users" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

INSERT INTO "new_pages" ("id", "slug", "title", "description", "sections", "headerConfig", "footerConfig", "hideHeader", "hideFooter", "metaTitle", "metaDescription", "ogImage", "canonicalUrl", "noindex", "status", "publishedAt", "prerender", "siteId", "authorId", "createdAt", "updatedAt")
SELECT "id", "slug", "title", "description", "sections", "headerConfig", "footerConfig", "hideHeader", "hideFooter", "metaTitle", "metaDescription", "ogImage", "canonicalUrl", "noindex", "status", "publishedAt", "prerender",
    COALESCE((SELECT "id" FROM "sites" WHERE "slug" = 'default'), 1),
    "authorId", "createdAt", "updatedAt"
FROM "pages";

DROP TABLE "pages";
ALTER TABLE "new_pages" RENAME TO "pages";

-- Recreate indexes for pages
CREATE UNIQUE INDEX "pages_siteId_slug_key" ON "pages"("siteId", "slug");
CREATE INDEX "pages_siteId_idx" ON "pages"("siteId");
CREATE INDEX "pages_status_idx" ON "pages"("status");
CREATE INDEX "pages_authorId_idx" ON "pages"("authorId");
CREATE INDEX "pages_parentId_idx" ON "pages"("parentId");
CREATE INDEX "pages_path_idx" ON "pages"("path");

-- 8.2 Migrate MEDIA table
CREATE TABLE "new_media" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "filename" TEXT NOT NULL,
    "originalName" TEXT NOT NULL,
    "path" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "size" INTEGER NOT NULL,
    "alt" TEXT,
    "caption" TEXT,
    "width" INTEGER,
    "height" INTEGER,
    "duration" INTEGER,
    "siteId" INTEGER,
    "folderId" INTEGER,
    "uploadedById" INTEGER,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "media_siteId_fkey" FOREIGN KEY ("siteId") REFERENCES "sites" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "media_folderId_fkey" FOREIGN KEY ("folderId") REFERENCES "media_folders" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "media_uploadedById_fkey" FOREIGN KEY ("uploadedById") REFERENCES "users" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

INSERT INTO "new_media" ("id", "filename", "originalName", "path", "url", "type", "mimeType", "size", "alt", "caption", "width", "height", "duration", "siteId", "uploadedById", "createdAt")
SELECT "id", "filename", "originalName", "path", "url", "type", "mimeType", "size", "alt", "caption", "width", "height", "duration",
    (SELECT "id" FROM "sites" WHERE "slug" = 'default'),
    "uploadedById", "createdAt"
FROM "media";

DROP TABLE "media";
ALTER TABLE "new_media" RENAME TO "media";

-- Recreate indexes for media
CREATE INDEX "media_type_idx" ON "media"("type");
CREATE INDEX "media_uploadedById_idx" ON "media"("uploadedById");
CREATE INDEX "media_siteId_idx" ON "media"("siteId");
CREATE INDEX "media_folderId_idx" ON "media"("folderId");

-- 8.3 Migrate SITE_SETTINGS table
CREATE TABLE "new_site_settings" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "key" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "group" TEXT NOT NULL DEFAULT 'general',
    "siteId" INTEGER NOT NULL DEFAULT 1,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "site_settings_siteId_fkey" FOREIGN KEY ("siteId") REFERENCES "sites" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

INSERT INTO "new_site_settings" ("id", "key", "value", "group", "siteId", "updatedAt")
SELECT "id", "key", "value", "group",
    COALESCE((SELECT "id" FROM "sites" WHERE "slug" = 'default'), 1),
    "updatedAt"
FROM "site_settings";

DROP TABLE "site_settings";
ALTER TABLE "new_site_settings" RENAME TO "site_settings";

-- Recreate indexes for site_settings
CREATE UNIQUE INDEX "site_settings_siteId_key_key" ON "site_settings"("siteId", "key");
CREATE INDEX "site_settings_siteId_idx" ON "site_settings"("siteId");
CREATE INDEX "site_settings_group_idx" ON "site_settings"("group");

-- 8.4 Migrate THEME_OVERRIDES table
CREATE TABLE "new_theme_overrides" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "name" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "siteId" INTEGER NOT NULL DEFAULT 1,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "theme_overrides_siteId_fkey" FOREIGN KEY ("siteId") REFERENCES "sites" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

INSERT INTO "new_theme_overrides" ("id", "name", "value", "isActive", "siteId", "createdAt", "updatedAt")
SELECT "id", "name", "value", "isActive",
    COALESCE((SELECT "id" FROM "sites" WHERE "slug" = 'default'), 1),
    "createdAt", "updatedAt"
FROM "theme_overrides";

DROP TABLE "theme_overrides";
ALTER TABLE "new_theme_overrides" RENAME TO "theme_overrides";

-- Recreate indexes for theme_overrides
CREATE UNIQUE INDEX "theme_overrides_siteId_name_key" ON "theme_overrides"("siteId", "name");
CREATE INDEX "theme_overrides_siteId_idx" ON "theme_overrides"("siteId");

PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- ==========================================
-- 9. Create default menus for existing site
-- ==========================================
INSERT INTO "menus" ("name", "slug", "location", "items", "siteId", "createdAt", "updatedAt")
SELECT 'Header Menu', 'header', 'header', '[]',
    "id", CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
FROM "sites" WHERE "slug" = 'default';

INSERT INTO "menus" ("name", "slug", "location", "items", "siteId", "createdAt", "updatedAt")
SELECT 'Footer Menu', 'footer', 'footer', '[]',
    "id", CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
FROM "sites" WHERE "slug" = 'default';
