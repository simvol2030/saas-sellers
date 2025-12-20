-- Phase 3: User Management System
-- Add isSuperadmin and isActive to users
-- Add user_sites table for many-to-many user-site access with permissions

-- Add new columns to users table
ALTER TABLE "users" ADD COLUMN "isSuperadmin" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "users" ADD COLUMN "isActive" BOOLEAN NOT NULL DEFAULT true;

-- Create user_sites table for user-site access permissions
CREATE TABLE "user_sites" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "userId" INTEGER NOT NULL,
    "siteId" INTEGER NOT NULL,
    "permissions" TEXT NOT NULL DEFAULT '{}',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "user_sites_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "user_sites_siteId_fkey" FOREIGN KEY ("siteId") REFERENCES "sites" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- Create unique index for userId + siteId combination
CREATE UNIQUE INDEX "user_sites_userId_siteId_key" ON "user_sites"("userId", "siteId");

-- Create indexes for foreign keys
CREATE INDEX "user_sites_userId_idx" ON "user_sites"("userId");
CREATE INDEX "user_sites_siteId_idx" ON "user_sites"("siteId");

-- Set first user as superadmin (migration helper)
UPDATE "users" SET "isSuperadmin" = true WHERE "id" = (SELECT MIN("id") FROM "users");
