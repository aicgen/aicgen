# Database Indexing

## When to Add Indexes

```sql
-- ✅ Columns in WHERE clauses
CREATE INDEX idx_users_email ON users(email);

-- ✅ Foreign key columns
CREATE INDEX idx_orders_user_id ON orders(user_id);

-- ✅ Columns used in ORDER BY
CREATE INDEX idx_products_created_at ON products(created_at DESC);

-- ✅ Columns used in JOIN conditions
CREATE INDEX idx_order_items_product_id ON order_items(product_id);
```

## Composite Indexes

```sql
-- Order matters! Put most selective column first
CREATE INDEX idx_orders_user_status ON orders(user_id, status);

-- This index helps with:
SELECT * FROM orders WHERE user_id = 123;
SELECT * FROM orders WHERE user_id = 123 AND status = 'pending';

-- But NOT with:
SELECT * FROM orders WHERE status = 'pending'; -- Can't use index
```

## Partial Indexes

```sql
-- Index only rows matching condition
CREATE INDEX idx_active_users ON users(email) WHERE is_active = true;

-- Smaller index, faster queries on active users
SELECT * FROM users WHERE email = 'x@y.com' AND is_active = true;
```

## Unique Indexes

```sql
-- Enforces uniqueness and improves lookup
CREATE UNIQUE INDEX idx_users_email ON users(email);

-- Multi-column unique
CREATE UNIQUE INDEX idx_unique_order_item ON order_items(order_id, product_id);
```

## Index Types

```sql
-- B-tree (default): =, <, >, <=, >=, BETWEEN
CREATE INDEX idx_products_price ON products(price);

-- Hash: Only equality (=)
CREATE INDEX idx_users_id_hash ON users USING hash (id);

-- GIN: Arrays, JSONB, full-text search
CREATE INDEX idx_products_tags ON products USING gin (tags);

-- GiST: Geometric data, range queries
CREATE INDEX idx_locations ON places USING gist (location);
```

## Analyze Query Performance

```sql
-- EXPLAIN ANALYZE shows actual execution
EXPLAIN ANALYZE
SELECT * FROM users WHERE email = 'test@example.com';

-- Look for:
-- ✅ Index Scan / Index Only Scan (good)
-- ❌ Seq Scan on large tables (bad)
-- ❌ High "actual time" values (slow)
```

## Index Maintenance

```sql
-- Monitor index usage (PostgreSQL)
SELECT
  schemaname, tablename, indexname, idx_scan, idx_tup_read
FROM pg_stat_user_indexes
ORDER BY idx_scan ASC;

-- Remove unused indexes (0 scans)
DROP INDEX IF EXISTS unused_index_name;

-- Rebuild bloated indexes
REINDEX INDEX index_name;
```

## Anti-Patterns

```sql
-- ❌ Indexing every column
-- Slows down INSERT/UPDATE, wastes space

-- ❌ Indexes on low-cardinality columns
-- Boolean columns rarely benefit from indexes

-- ❌ Functions on indexed columns
-- SELECT * FROM users WHERE LOWER(email) = 'x'; -- Can't use index!

-- ✅ Use expression index instead
CREATE INDEX idx_users_email_lower ON users(LOWER(email));
```

## Connection Pooling

```typescript
// ❌ New connection per query
const getUser = async (id: string) => {
  const conn = await createConnection(); // Expensive!
  const user = await conn.query('SELECT * FROM users WHERE id = ?', [id]);
  await conn.close();
  return user;
};

// ✅ Use connection pool
const pool = new Pool({ max: 20, idleTimeoutMillis: 30000 });

const getUser = async (id: string) => {
  const client = await pool.connect();
  try {
    return await client.query('SELECT * FROM users WHERE id = $1', [id]);
  } finally {
    client.release(); // Return to pool
  }
};
```
