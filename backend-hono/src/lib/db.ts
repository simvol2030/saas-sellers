import { PrismaClient } from '@prisma/client';

/**
 * Prisma Client with SQLite optimizations
 *
 * WAL mode benefits:
 * - Better concurrent read/write performance
 * - Reduced lock contention
 * - Faster writes for most workloads
 * - Better crash recovery
 */
export const prisma = new PrismaClient({
  log: process.env.NODE_ENV === 'development'
    ? ['query', 'error', 'warn']
    : ['error'],
});

/**
 * Initialize database with SQLite optimizations
 */
export async function initDatabase() {
  try {
    // Enable WAL mode for better concurrency
    await prisma.$executeRawUnsafe('PRAGMA journal_mode = WAL;');

    // Set synchronous mode to NORMAL for better performance
    // (still safe with WAL mode)
    await prisma.$executeRawUnsafe('PRAGMA synchronous = NORMAL;');

    // Increase cache size (negative = KB, so -64000 = 64MB)
    await prisma.$executeRawUnsafe('PRAGMA cache_size = -64000;');

    // Enable foreign keys
    await prisma.$executeRawUnsafe('PRAGMA foreign_keys = ON;');

    // Set busy timeout to 5 seconds
    await prisma.$executeRawUnsafe('PRAGMA busy_timeout = 5000;');

    // Verify WAL mode is enabled
    const result = await prisma.$queryRawUnsafe(
      'PRAGMA journal_mode;'
    ) as Array<{ journal_mode: string }>;

    console.log(`✅ SQLite initialized with journal_mode: ${result[0]?.journal_mode}`);

    return true;
  } catch (error) {
    console.error('❌ Failed to initialize database:', error);
    return false;
  }
}
