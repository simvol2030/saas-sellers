---
name: drizzle-orm-production
description: Production-ready Drizzle ORM patterns for PostgreSQL and SQLite. Use when creating database schemas with relations, generating and applying migrations, implementing transactions for data integrity, optimizing queries with indexes, configuring connection pooling, seeding test data, or setting up backup strategies. Covers type-safe queries, foreign keys, batch operations, and migration best practices for SvelteKit and Node.js applications.
---

# Drizzle ORM Production

## Overview

This skill provides production-ready patterns for using Drizzle ORM in TypeScript applications. It covers schema design, migrations, relations, transactions, performance optimization, and deployment best practices for both PostgreSQL and SQLite databases.

Use this skill when:
- Defining database schemas with TypeScript type safety
- Creating and applying database migrations
- Implementing relations (one-to-many, many-to-many, one-to-one)
- Running transactions for atomic operations (e.g., loyalty points transfer)
- Optimizing queries with indexes
- Setting up connection pooling for PostgreSQL
- Seeding databases with test or initial data
- Planning backup and restore strategies
- Migrating from SQLite (development) to PostgreSQL (production)
- Troubleshooting Drizzle ORM queries and performance issues

## Core Capabilities

### 1. Schema Definition

Define type-safe database schemas with Drizzle ORM.

**Basic Table Definition:**

```typescript
import { pgTable, serial, text, timestamp, integer, boolean } from 'drizzle-orm/pg-core';

export const users = pgTable('users', {
  id: serial('id').primaryKey(),
  name: text('name').notNull(),
  email: text('email').notNull().unique(),
  cardNumber: text('card_number').notNull().unique(),
  balance: integer('balance').default(0).notNull(),
  tier: text('tier', { enum: ['bronze', 'silver', 'gold', 'platinum'] }).default('bronze'),
  isActive: boolean('is_active').default(true).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull()
});
```

**Column Types (PostgreSQL):**

Refer to `scripts/schema_example.ts` for complete schema examples.

| TypeScript | Drizzle Type | PostgreSQL | Example |
|------------|-------------|-----------|---------|
| number | `serial()` | SERIAL | Auto-increment ID |
| number | `integer()` | INTEGER | Age, balance |
| number | `real()` | REAL | Decimal numbers |
| number | `numeric()` | NUMERIC(10,2) | Money (precise) |
| string | `text()` | TEXT | Name, description |
| string | `varchar(255)` | VARCHAR(255) | Email, SKU |
| boolean | `boolean()` | BOOLEAN | isActive |
| Date | `timestamp()` | TIMESTAMP | createdAt |
| string | `uuid()` | UUID | Unique identifiers |
| object | `json()` / `jsonb()` | JSON/JSONB | Metadata |

**SQLite Types:**

```typescript
import { sqliteTable, integer, text } from 'drizzle-orm/sqlite-core';

export const users = sqliteTable('users', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  name: text('name').notNull(),
  email: text('email').notNull().unique(),
  balance: integer('balance').default(0),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull()
});
```

**Best Practices:**
- Use `serial()` for auto-increment IDs in PostgreSQL
- Use `integer().primaryKey({ autoIncrement: true })` for SQLite
- Always add `.notNull()` for required fields
- Use `.unique()` for unique constraints (email, cardNumber)
- Set `.default()` values for optional fields
- Use `timestamp()` with `.defaultNow()` for timestamps
- Use enums for limited string values (tier, status)

---

### 2. Migrations

Generate and apply database migrations for schema changes.

**Configuration (drizzle.config.ts):**

```typescript
import type { Config } from 'drizzle-kit';

export default {
  schema: './src/lib/server/db/schema.ts',
  out: './src/lib/server/db/migrations',
  driver: 'pg', // or 'better-sqlite'
  dbCredentials: {
    connectionString: process.env.DATABASE_URL!
  }
} satisfies Config;
```

**Generate Migration:**

```bash
# After changing schema.ts
npm run db:generate

# Drizzle Kit will:
# 1. Compare schema.ts with current database
# 2. Generate SQL migration in migrations/ folder
# 3. Create meta/_journal.json for tracking
```

**Generated Migration Example:**

```sql
-- migrations/0001_create_transactions_table.sql
CREATE TABLE IF NOT EXISTS "transactions" (
  "id" serial PRIMARY KEY NOT NULL,
  "user_id" integer NOT NULL,
  "amount" numeric(10, 2) NOT NULL,
  "points" integer NOT NULL,
  "type" text NOT NULL,
  "created_at" timestamp DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS "user_id_idx" ON "transactions" ("user_id");

ALTER TABLE "transactions"
  ADD CONSTRAINT "transactions_user_id_users_id_fk"
  FOREIGN KEY ("user_id") REFERENCES "users"("id")
  ON DELETE CASCADE;
```

**Apply Migration:**

```bash
# Apply all pending migrations
npm run db:migrate

# Or programmatically in code:
```

```typescript
import { drizzle } from 'drizzle-orm/postgres-js';
import { migrate } from 'drizzle-orm/postgres-js/migrator';
import postgres from 'postgres';

const sql = postgres(process.env.DATABASE_URL!);
const db = drizzle(sql);

await migrate(db, { migrationsFolder: './src/lib/server/db/migrations' });
```

**Push Schema (Development Only):**

```bash
# Push schema changes directly without migrations
npm run db:push

# WARNING: Use only in development! Production should use migrations.
```

**Migration Best Practices:**
- ALWAYS use migrations in production
- NEVER edit existing migration files (create new ones)
- Test migrations on staging before production
- Keep migrations small and focused (one feature per migration)
- Add indexes in migrations, not in schema file
- Use `db:push` only in development for rapid prototyping
- Backup database before applying migrations in production

Refer to `scripts/run_migrations.ts` for programmatic migration examples.

---

### 3. Relations

Define relations between tables for type-safe joins.

**One-to-Many Relation:**

```typescript
import { relations } from 'drizzle-orm';
import { users, transactions } from './schema';

// User has many transactions
export const usersRelations = relations(users, ({ many }) => ({
  transactions: many(transactions)
}));

// Transaction belongs to user
export const transactionsRelations = relations(transactions, ({ one }) => ({
  user: one(users, {
    fields: [transactions.userId],
    references: [users.id]
  })
}));
```

**Query with Relations:**

```typescript
// Get user with all transactions
const userWithTransactions = await db.query.users.findFirst({
  where: eq(users.id, 1),
  with: {
    transactions: true
  }
});

// Type-safe result:
// {
//   id: 1,
//   name: "Alice",
//   transactions: [
//     { id: 1, amount: 100, points: 10 },
//     { id: 2, amount: 200, points: 20 }
//   ]
// }
```

**Many-to-Many Relation:**

```typescript
// Users can have multiple roles, roles can have multiple users
export const users = pgTable('users', {
  id: serial('id').primaryKey(),
  name: text('name').notNull()
});

export const roles = pgTable('roles', {
  id: serial('id').primaryKey(),
  name: text('name').notNull()
});

// Junction table
export const usersToRoles = pgTable('users_to_roles', {
  userId: integer('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  roleId: integer('role_id').notNull().references(() => roles.id, { onDelete: 'cascade' })
}, (table) => ({
  pk: primaryKey(table.userId, table.roleId)
}));

// Relations
export const usersRelations = relations(users, ({ many }) => ({
  usersToRoles: many(usersToRoles)
}));

export const rolesRelations = relations(roles, ({ many }) => ({
  usersToRoles: many(usersToRoles)
}));

export const usersToRolesRelations = relations(usersToRoles, ({ one }) => ({
  user: one(users, {
    fields: [usersToRoles.userId],
    references: [users.id]
  }),
  role: one(roles, {
    fields: [usersToRoles.roleId],
    references: [roles.id]
  })
}));

// Query
const userWithRoles = await db.query.users.findFirst({
  with: {
    usersToRoles: {
      with: {
        role: true
      }
    }
  }
});
```

**Cascading Deletes:**

```typescript
// When user deleted, delete all transactions
export const transactions = pgTable('transactions', {
  id: serial('id').primaryKey(),
  userId: integer('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' })
});
```

**Best Practices:**
- Define relations in separate file (`relations.ts`)
- Use `onDelete: 'cascade'` for dependent data
- Use `onDelete: 'set null'` for optional references
- Limit relation depth with `with` (avoid N+1 queries)
- Use indexes on foreign key columns

---

### 4. Transactions

Ensure data integrity with atomic operations.

**Basic Transaction:**

```typescript
import { db } from './db';
import { users, transactions } from './schema';

// Transfer points between users (atomic)
await db.transaction(async (tx) => {
  // Deduct points from sender
  await tx.update(users)
    .set({ balance: sql`${users.balance} - ${points}` })
    .where(eq(users.id, senderId));

  // Add points to receiver
  await tx.update(users)
    .set({ balance: sql`${users.balance} + ${points}` })
    .where(eq(users.id, receiverId));

  // Record transaction
  await tx.insert(transactions).values({
    userId: senderId,
    amount: -points,
    type: 'transfer',
    createdAt: new Date()
  });

  await tx.insert(transactions).values({
    userId: receiverId,
    amount: points,
    type: 'transfer',
    createdAt: new Date()
  });
});
```

**Transaction with Rollback:**

```typescript
try {
  await db.transaction(async (tx) => {
    // Check sender balance
    const sender = await tx.query.users.findFirst({
      where: eq(users.id, senderId)
    });

    if (!sender || sender.balance < points) {
      throw new Error('Insufficient balance');
    }

    // Perform transfer (code from above)
    // ...

  });
} catch (error) {
  // Transaction automatically rolled back on error
  console.error('Transfer failed:', error);
}
```

**Transaction Isolation Levels (PostgreSQL):**

```typescript
await db.transaction(async (tx) => {
  // Operations here
}, {
  isolationLevel: 'read committed' // 'read uncommitted' | 'read committed' | 'repeatable read' | 'serializable'
});
```

**Use Cases for Transactions:**
- Point transfers between users
- Order creation (deduct inventory, create order, record payment)
- Multi-step data updates that must succeed together
- Batch operations that should be all-or-nothing

**Best Practices:**
- Keep transactions short (minimize time holding locks)
- Don't call external APIs inside transactions
- Use appropriate isolation level (default is usually fine)
- Handle errors explicitly and log failures
- Test rollback scenarios

Refer to `scripts/transaction_example.ts` for complete examples.

---

### 5. Indexes

Optimize query performance with database indexes.

**Create Index in Migration:**

```sql
-- migrations/0002_add_indexes.sql
CREATE INDEX IF NOT EXISTS "users_email_idx" ON "users" ("email");
CREATE INDEX IF NOT EXISTS "users_card_number_idx" ON "users" ("card_number");
CREATE INDEX IF NOT EXISTS "transactions_user_id_idx" ON "transactions" ("user_id");
CREATE INDEX IF NOT EXISTS "transactions_created_at_idx" ON "transactions" ("created_at");
```

**Composite Index:**

```sql
-- Index on user_id + created_at for filtering transactions by user and date
CREATE INDEX IF NOT EXISTS "transactions_user_created_idx"
  ON "transactions" ("user_id", "created_at" DESC);
```

**Index in Schema (Drizzle Kit will generate migration):**

```typescript
import { pgTable, serial, text, index } from 'drizzle-orm/pg-core';

export const users = pgTable('users', {
  id: serial('id').primaryKey(),
  email: text('email').notNull(),
  cardNumber: text('card_number').notNull()
}, (table) => ({
  emailIdx: index('email_idx').on(table.email),
  cardNumberIdx: index('card_number_idx').on(table.cardNumber)
}));
```

**When to Add Indexes:**
- ✅ Foreign key columns (userId, productId, etc.)
- ✅ Columns used in WHERE clauses frequently
- ✅ Columns used in ORDER BY
- ✅ Unique constraints (email, cardNumber)
- ✅ Composite indexes for common query patterns

**When NOT to Add Indexes:**
- ❌ Small tables (<1000 rows)
- ❌ Columns with low cardinality (few unique values)
- ❌ Columns rarely queried
- ❌ Write-heavy tables (indexes slow down inserts)

**Analyze Query Performance:**

```sql
-- PostgreSQL EXPLAIN
EXPLAIN ANALYZE SELECT * FROM users WHERE email = 'test@example.com';

-- Should show "Index Scan" not "Seq Scan"
```

**Best Practices:**
- Add indexes based on actual query patterns (not guesses)
- Use composite indexes for multi-column WHERE clauses
- Monitor index usage with database tools
- Remove unused indexes (they slow down writes)
- Rebuild indexes periodically in production

---

### 6. Connection Pooling

Configure connection pooling for PostgreSQL production deployments.

**PostgreSQL with node-postgres (pg):**

```typescript
import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import * as schema from './schema';

const pool = new Pool({
  host: process.env.DB_HOST,
  port: parseInt(process.env.DB_PORT || '5432'),
  database: process.env.DB_NAME,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,

  // Connection pool settings
  max: 20, // Max connections in pool
  idleTimeoutMillis: 30000, // Close idle connections after 30s
  connectionTimeoutMillis: 2000, // Timeout waiting for connection

  // Keep-alive
  keepAlive: true,
  keepAliveInitialDelayMillis: 10000
});

export const db = drizzle(pool, { schema });

// Graceful shutdown
process.on('SIGTERM', async () => {
  await pool.end();
});
```

**PostgreSQL with postgres.js:**

```typescript
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';

const sql = postgres(process.env.DATABASE_URL!, {
  max: 20, // Max connections
  idle_timeout: 20, // Idle timeout (seconds)
  connect_timeout: 10 // Connect timeout (seconds)
});

export const db = drizzle(sql, { schema });
```

**SQLite (No Pooling Needed):**

```typescript
import { drizzle } from 'drizzle-orm/better-sqlite3';
import Database from 'better-sqlite3';

const sqlite = new Database('./data/db/app.db');

// Enable WAL mode for better concurrency
sqlite.pragma('journal_mode = WAL');

export const db = drizzle(sqlite, { schema });
```

**Pool Size Recommendations:**

| Environment | Max Connections | Notes |
|-------------|----------------|-------|
| Development | 5-10 | Local database |
| Staging | 10-20 | Similar to prod |
| Production (small) | 20-50 | 1-2 app instances |
| Production (large) | 50-100 | Multiple app instances |

**Formula:** `max_connections = (app_instances * max_pool_size) + buffer`

**Best Practices:**
- Set `max` based on database server limits
- Use `idleTimeoutMillis` to free unused connections
- Monitor pool usage (active vs idle connections)
- Use connection pooling only for PostgreSQL (not SQLite)
- Configure `statement_timeout` in PostgreSQL to prevent long queries

---

### 7. Query Optimization

Write efficient queries with Drizzle ORM.

**Select Specific Columns:**

```typescript
// ❌ Bad: Select all columns
const users = await db.select().from(users);

// ✅ Good: Select only needed columns
const users = await db.select({
  id: users.id,
  name: users.name,
  email: users.email
}).from(users);
```

**Limit Results:**

```typescript
// Get top 10 users by balance
const topUsers = await db.select()
  .from(users)
  .orderBy(desc(users.balance))
  .limit(10);
```

**Pagination:**

```typescript
const page = 2;
const pageSize = 20;

const paginatedUsers = await db.select()
  .from(users)
  .limit(pageSize)
  .offset((page - 1) * pageSize);
```

**Conditional Queries:**

```typescript
const filters = {
  tier: 'gold',
  minBalance: 100
};

const conditions = [];

if (filters.tier) {
  conditions.push(eq(users.tier, filters.tier));
}

if (filters.minBalance) {
  conditions.push(gte(users.balance, filters.minBalance));
}

const filteredUsers = await db.select()
  .from(users)
  .where(and(...conditions));
```

**Batch Inserts:**

```typescript
// ❌ Bad: Insert one by one
for (const product of products) {
  await db.insert(productsTable).values(product);
}

// ✅ Good: Batch insert
await db.insert(productsTable).values(products);
```

**Upsert (Insert or Update):**

```typescript
await db.insert(users)
  .values({ email: 'test@example.com', name: 'Test' })
  .onConflictDoUpdate({
    target: users.email,
    set: { name: 'Test Updated' }
  });
```

**Raw SQL (When Needed):**

```typescript
import { sql } from 'drizzle-orm';

// Complex aggregation
const stats = await db.execute(sql`
  SELECT
    DATE_TRUNC('day', created_at) as date,
    COUNT(*) as count,
    SUM(points) as total_points
  FROM transactions
  WHERE created_at > NOW() - INTERVAL '30 days'
  GROUP BY DATE_TRUNC('day', created_at)
  ORDER BY date DESC
`);
```

**Performance Tips:**
- Use indexes on filtered/sorted columns
- Select only needed columns
- Use pagination for large result sets
- Batch insert/update operations
- Use prepared statements (Drizzle does this automatically)
- Profile queries with EXPLAIN ANALYZE

---

### 8. Seed Data

Populate database with initial or test data.

**Seed Script:**

Refer to `scripts/seed.ts` for complete example.

```typescript
import { db } from './db';
import { users, products, transactions } from './schema';

export async function seed() {
  console.log('Seeding database...');

  // Clear existing data (development only!)
  if (process.env.NODE_ENV !== 'production') {
    await db.delete(transactions);
    await db.delete(users);
    await db.delete(products);
  }

  // Seed users
  const userIds = await db.insert(users).values([
    { name: 'Alice Johnson', email: 'alice@example.com', cardNumber: 'LC-000001', balance: 500, tier: 'gold' },
    { name: 'Bob Smith', email: 'bob@example.com', cardNumber: 'LC-000002', balance: 200, tier: 'silver' },
    { name: 'Charlie Brown', email: 'charlie@example.com', cardNumber: 'LC-000003', balance: 50, tier: 'bronze' }
  ]).returning({ id: users.id });

  console.log(`Seeded ${userIds.length} users`);

  // Seed products
  await db.insert(products).values([
    { name: 'Product A', sku: 'SKU-001', price: 1000, stock: 100 },
    { name: 'Product B', sku: 'SKU-002', price: 2000, stock: 50 },
    { name: 'Product C', sku: 'SKU-003', price: 500, stock: 200 }
  ]);

  console.log('Seeded products');

  // Seed transactions
  await db.insert(transactions).values([
    { userId: userIds[0].id, amount: 100, points: 10, type: 'earn' },
    { userId: userIds[0].id, amount: 50, points: 5, type: 'earn' },
    { userId: userIds[1].id, amount: 200, points: 20, type: 'earn' }
  ]);

  console.log('Seeded transactions');
  console.log('Seed completed!');
}

// Run if called directly
if (require.main === module) {
  seed()
    .then(() => process.exit(0))
    .catch((error) => {
      console.error('Seed failed:', error);
      process.exit(1);
    });
}
```

**Run Seed:**

```bash
# Add to package.json
"scripts": {
  "db:seed": "tsx src/lib/server/db/seed.ts"
}

# Run
npm run db:seed
```

**Best Practices:**
- NEVER run seed in production with data deletion
- Use environment check (`NODE_ENV !== 'production'`)
- Make seed script idempotent (can run multiple times safely)
- Generate realistic test data (use faker.js)
- Seed reference data (tiers, roles) in migrations, not seed script

---

### 9. Backup & Restore

Implement backup strategies for production databases.

**PostgreSQL Backup:**

```bash
# Full database backup
pg_dump -U postgres -d loyalty_db > backup_$(date +%Y%m%d_%H%M%S).sql

# Compressed backup
pg_dump -U postgres -d loyalty_db | gzip > backup_$(date +%Y%m%d_%H%M%S).sql.gz

# Schema only
pg_dump -U postgres -d loyalty_db --schema-only > schema_backup.sql

# Data only
pg_dump -U postgres -d loyalty_db --data-only > data_backup.sql
```

**PostgreSQL Restore:**

```bash
# Restore from backup
psql -U postgres -d loyalty_db < backup_20250115_120000.sql

# Restore from compressed
gunzip -c backup_20250115_120000.sql.gz | psql -U postgres -d loyalty_db
```

**SQLite Backup:**

```bash
# Simple copy (ensure database is not in use)
cp data/db/app.db data/db/backup_$(date +%Y%m%d_%H%M%S).db

# Online backup (using SQLite3 tool)
sqlite3 data/db/app.db ".backup 'data/db/backup.db'"
```

**Automated Backup Script:**

```bash
#!/bin/bash
# backup.sh

BACKUP_DIR="/backups"
DB_NAME="loyalty_db"
RETENTION_DAYS=30

# Create backup
pg_dump -U postgres -d $DB_NAME | gzip > "$BACKUP_DIR/backup_$(date +%Y%m%d_%H%M%S).sql.gz"

# Delete old backups
find $BACKUP_DIR -name "backup_*.sql.gz" -mtime +$RETENTION_DAYS -delete

echo "Backup completed"
```

**Cron Schedule:**

```bash
# Daily backup at 2 AM
0 2 * * * /path/to/backup.sh
```

**Backup Best Practices:**
- Automate backups (daily minimum)
- Store backups off-site (AWS S3, Google Cloud Storage)
- Test restore process regularly
- Keep multiple backup versions (7 daily, 4 weekly, 12 monthly)
- Encrypt backups containing sensitive data
- Monitor backup success/failure

---

## Resources

### scripts/
- **schema_example.ts** - Complete schema example with users, transactions, products tables and relations
- **run_migrations.ts** - Programmatic migration runner for production deployments
- **transaction_example.ts** - Transaction examples for atomic operations (point transfers, order processing)
- **seed.ts** - Database seeding script with realistic test data

---

## Quick Reference

**Common Operations:**

```typescript
// Insert
await db.insert(users).values({ name: 'Alice', email: 'alice@example.com' });

// Select
const allUsers = await db.select().from(users);

// Select with condition
const user = await db.query.users.findFirst({
  where: eq(users.email, 'alice@example.com')
});

// Update
await db.update(users)
  .set({ balance: 100 })
  .where(eq(users.id, 1));

// Delete
await db.delete(users).where(eq(users.id, 1));

// Transaction
await db.transaction(async (tx) => {
  await tx.insert(users).values({ name: 'Bob' });
  await tx.insert(transactions).values({ userId: 1, amount: 100 });
});
```

**Critical Rules:**
- ALWAYS use migrations in production (never `db:push`)
- ALWAYS use transactions for multi-step operations
- ALWAYS add indexes on foreign keys
- ALWAYS use connection pooling for PostgreSQL
- BACKUP database before migrations in production
