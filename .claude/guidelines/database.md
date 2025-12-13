# Database

# Database Schema Design

## Naming Conventions

```sql
-- Tables: plural, snake_case
CREATE TABLE users (...);
CREATE TABLE order_items (...);

-- Columns: singular, snake_case
user_id, created_at, is_active

-- Primary keys: id
id SERIAL PRIMARY KEY

-- Foreign keys: singular_table_id
user_id REFERENCES users(id)
```

## Primary Keys

```sql
-- ✅ Auto-incrementing integer (simple cases)
id SERIAL PRIMARY KEY

-- ✅ UUID for distributed systems
id UUID PRIMARY KEY DEFAULT gen_random_uuid()

-- ❌ Avoid composite primary keys when possible
-- They complicate joins and foreign keys
```

## Essential Columns

```sql
-- ✅ Standard audit columns
CREATE TABLE products (
  id SERIAL PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  price DECIMAL(10,2) NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  deleted_at TIMESTAMP NULL  -- Soft delete
);

-- ✅ Version column for optimistic locking
version INTEGER DEFAULT 1
```

## Relationships

```sql
-- One-to-Many: Foreign key on "many" side
CREATE TABLE orders (
  id SERIAL PRIMARY KEY,
  user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
  total DECIMAL(10,2)
);

-- Many-to-Many: Junction table
CREATE TABLE order_items (
  order_id INTEGER REFERENCES orders(id) ON DELETE CASCADE,
  product_id INTEGER REFERENCES products(id),
  quantity INTEGER NOT NULL,
  PRIMARY KEY (order_id, product_id)
);
```

## Constraints

```sql
-- ✅ NOT NULL for required fields
email VARCHAR(255) NOT NULL

-- ✅ UNIQUE constraints
email VARCHAR(255) UNIQUE NOT NULL

-- ✅ CHECK constraints for validation
age INTEGER CHECK (age >= 0 AND age <= 150)
status VARCHAR(20) CHECK (status IN ('pending', 'active', 'cancelled'))

-- ✅ DEFAULT values
is_active BOOLEAN DEFAULT true
role VARCHAR(20) DEFAULT 'user'
```

## Data Types

```sql
-- Strings
VARCHAR(255) -- Variable length, max 255
TEXT         -- Unlimited length

-- Numbers
INTEGER      -- Whole numbers
BIGINT       -- Large whole numbers
DECIMAL(10,2) -- Exact decimals (money)
REAL/DOUBLE  -- Approximate decimals (scientific)

-- Dates/Times
TIMESTAMP    -- Date and time
DATE         -- Date only
INTERVAL     -- Duration

-- Other
BOOLEAN      -- true/false
UUID         -- Unique identifier
JSONB        -- JSON with indexing (PostgreSQL)
```

## Normalization Guidelines

```sql
-- ✅ 1NF: Atomic values, no repeating groups
-- ❌ Bad: tags VARCHAR = 'tag1,tag2,tag3'
-- ✅ Good: Separate tags table

-- ✅ 2NF: No partial dependencies
-- All non-key columns depend on entire primary key

-- ✅ 3NF: No transitive dependencies
-- Non-key columns don't depend on other non-key columns
```

## Denormalization (When Appropriate)

```sql
-- Cache computed values for read performance
CREATE TABLE orders (
  id SERIAL PRIMARY KEY,
  user_id INTEGER REFERENCES users(id),
  items_count INTEGER DEFAULT 0,  -- Denormalized
  total DECIMAL(10,2) DEFAULT 0   -- Denormalized
);

-- Update via triggers or application logic
```


---

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


---

# Database Design Patterns

## Schema Design

### Normalization
Reduce redundancy, maintain integrity.

```sql
-- Normalized
CREATE TABLE users (id, name, email);
CREATE TABLE orders (id, user_id REFERENCES users(id), total);
CREATE TABLE order_items (id, order_id REFERENCES orders(id), product_id, qty);
```

### Denormalization
Trade redundancy for read performance.

```sql
-- Denormalized for read performance
CREATE TABLE order_summary (
  id, user_id, user_name, user_email,
  total, item_count, created_at
);
```

## Common Patterns

### Soft Deletes
```sql
ALTER TABLE users ADD COLUMN deleted_at TIMESTAMP NULL;

-- Query active users
SELECT * FROM users WHERE deleted_at IS NULL;
```

### Audit Trail
```sql
CREATE TABLE audit_log (
  id SERIAL PRIMARY KEY,
  table_name VARCHAR(100),
  record_id VARCHAR(100),
  action VARCHAR(20),
  old_values JSONB,
  new_values JSONB,
  changed_by VARCHAR(100),
  changed_at TIMESTAMP DEFAULT NOW()
);
```

### Polymorphic Associations
```sql
CREATE TABLE comments (
  id SERIAL PRIMARY KEY,
  body TEXT,
  commentable_type VARCHAR(50), -- 'post', 'image', 'video'
  commentable_id INTEGER,
  created_at TIMESTAMP
);
```

## Best Practices

- Use appropriate data types
- Add indexes for frequently queried columns
- Use foreign keys for referential integrity
- Consider partitioning for large tables
- Plan for schema migrations
- Document schema decisions
