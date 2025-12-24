/**
 * Migration script using better-sqlite3
 * Run with: node scripts/apply-migration.js
 *
 * Applies all migrations in order if database doesn't exist
 */

import Database from 'better-sqlite3';
import { readFileSync, existsSync, mkdirSync, readdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Database path
const DATA_DIR = join(__dirname, '..', '..', 'data', 'db');
const DB_PATH = join(DATA_DIR, 'app.db');
const MIGRATIONS_DIR = join(__dirname, '..', 'prisma', 'migrations');

// Ensure data directory exists
if (!existsSync(DATA_DIR)) {
  mkdirSync(DATA_DIR, { recursive: true });
  console.log(`Created directory: ${DATA_DIR}`);
}

console.log(`Database path: ${DB_PATH}`);

try {
  // Open database with WAL mode
  const db = new Database(DB_PATH);
  db.pragma('journal_mode = WAL');

  // Create migrations table if not exists
  db.exec(`
    CREATE TABLE IF NOT EXISTS "_prisma_migrations" (
      "id" TEXT PRIMARY KEY,
      "checksum" TEXT NOT NULL,
      "finished_at" DATETIME,
      "migration_name" TEXT NOT NULL,
      "logs" TEXT,
      "rolled_back_at" DATETIME,
      "started_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "applied_steps_count" INTEGER NOT NULL DEFAULT 0
    )
  `);

  // Get list of migrations
  const migrationDirs = readdirSync(MIGRATIONS_DIR)
    .filter(f => f.match(/^\d+_/))
    .sort();

  console.log(`\nFound ${migrationDirs.length} migrations to check.`);

  for (const migrationDir of migrationDirs) {
    const migrationName = migrationDir;

    // Check if already applied
    const alreadyApplied = db.prepare(
      "SELECT id FROM _prisma_migrations WHERE migration_name = ? AND finished_at IS NOT NULL"
    ).get(migrationName);

    if (alreadyApplied) {
      console.log(`[SKIP] ${migrationName} (already applied)`);
      continue;
    }

    const migrationPath = join(MIGRATIONS_DIR, migrationDir, 'migration.sql');
    if (!existsSync(migrationPath)) {
      console.log(`[SKIP] ${migrationName} (no migration.sql)`);
      continue;
    }

    console.log(`[APPLY] ${migrationName}...`);

    const migrationSQL = readFileSync(migrationPath, 'utf-8');
    const migrationId = `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

    try {
      // Execute migration
      db.exec(migrationSQL);

      // Record migration
      db.prepare(`
        INSERT INTO _prisma_migrations (id, checksum, finished_at, migration_name, applied_steps_count)
        VALUES (?, ?, datetime('now'), ?, 1)
      `).run(migrationId, 'manual', migrationName);

      console.log(`[OK] ${migrationName}`);
    } catch (error) {
      console.error(`[ERROR] ${migrationName}: ${error.message}`);
      throw error;
    }
  }

  console.log('\nAll migrations applied successfully!');

  // Verify tables created
  const tables = db.prepare(
    "SELECT name FROM sqlite_master WHERE type='table' ORDER BY name"
  ).all();

  console.log('\nTables in database:');
  tables.forEach(t => console.log(`  - ${t.name}`));

  // Check sites
  const siteCount = db.prepare("SELECT COUNT(*) as count FROM sites").get();
  console.log(`\nSites count: ${siteCount.count}`);

  // Check menus
  const menuCount = db.prepare("SELECT COUNT(*) as count FROM menus").get();
  console.log(`Menus count: ${menuCount.count}`);

  db.close();
  console.log('\nDone!');
} catch (error) {
  console.error('Migration failed:', error.message);
  process.exit(1);
}
