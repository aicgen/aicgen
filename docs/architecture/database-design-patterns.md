# Database Design Patterns & Best Practices

## Schema Design

### Normalization

```sql
-- ❌ Denormalized (data duplication)
CREATE TABLE orders (
  id UUID PRIMARY KEY,
  customer_name VARCHAR(100),
  customer_email VARCHAR(100),
  customer_address TEXT,
  order_date TIMESTAMP,
  total DECIMAL(10, 2)
);
-- Customer data duplicated in every order

-- ✅ Normalized (3NF)
CREATE TABLE customers (
  id UUID PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  email VARCHAR(100) UNIQUE NOT NULL,
  address TEXT
);

CREATE TABLE orders (
  id UUID PRIMARY KEY,
  customer_id UUID NOT NULL REFERENCES customers(id),
  order_date TIMESTAMP DEFAULT NOW(),
  total DECIMAL(10, 2) NOT NULL
);

CREATE TABLE order_items (
  id UUID PRIMARY KEY,
  order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES products(id),
  quantity INT NOT NULL,
  price DECIMAL(10, 2) NOT NULL
);
```

### Selective Denormalization for Performance

```sql
-- When reads vastly outnumber writes, denormalize selectively

CREATE TABLE orders (
  id UUID PRIMARY KEY,
  customer_id UUID NOT NULL REFERENCES customers(id),
  customer_name VARCHAR(100) NOT NULL,  -- Denormalized for query performance
  order_date TIMESTAMP DEFAULT NOW(),
  total DECIMAL(10, 2) NOT NULL,
  item_count INT NOT NULL DEFAULT 0     -- Denormalized count
);

-- Update denormalized fields with triggers
CREATE OR REPLACE FUNCTION update_order_item_count()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE orders
  SET item_count = (
    SELECT COUNT(*) FROM order_items WHERE order_id = NEW.order_id
  )
  WHERE id = NEW.order_id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER order_items_count_trigger
AFTER INSERT OR DELETE ON order_items
FOR EACH ROW EXECUTE FUNCTION update_order_item_count();
```

## Evolutionary Database Design

### Migration-Based Changes

```sql
-- migrations/001_create_users_table.sql
CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email VARCHAR(255) UNIQUE NOT NULL,
  created_at TIMESTAMP DEFAULT NOW()
);

-- migrations/002_add_name_to_users.sql
ALTER TABLE users
ADD COLUMN name VARCHAR(100);

-- migrations/003_make_name_required.sql
-- Step 1: Set default for existing rows
UPDATE users SET name = 'Unknown' WHERE name IS NULL;

-- Step 2: Add NOT NULL constraint
ALTER TABLE users
ALTER COLUMN name SET NOT NULL;
```

### Zero-Downtime Migrations

```sql
-- Adding a column with default value (instant in modern databases)
ALTER TABLE users
ADD COLUMN status VARCHAR(20) DEFAULT 'active';

-- Removing a column (multi-step for safety)

-- Step 1: Stop writing to column (deploy code change)
-- Deploy application code that ignores old_column

-- Step 2: Drop column (after deploy confirms success)
ALTER TABLE users DROP COLUMN old_column;

-- Renaming a column (parallel change pattern)

-- Step 1: Add new column
ALTER TABLE users ADD COLUMN full_name VARCHAR(200);

-- Step 2: Backfill data
UPDATE users SET full_name = name WHERE full_name IS NULL;

-- Step 3: Deploy code using both columns
-- Application writes to both, reads from full_name

-- Step 4: Make new column NOT NULL
ALTER TABLE users ALTER COLUMN full_name SET NOT NULL;

-- Step 5: Deploy code using only new column

-- Step 6: Drop old column
ALTER TABLE users DROP COLUMN name;
```

### Migration Tool Example

```typescript
// migrations/index.ts
import { Kysely, sql } from 'kysely';

export async function up(db: Kysely<any>): Promise<void> {
  await db.schema
    .createTable('users')
    .addColumn('id', 'uuid', (col) =>
      col.primaryKey().defaultTo(sql`gen_random_uuid()`)
    )
    .addColumn('email', 'varchar(255)', (col) =>
      col.notNull().unique()
    )
    .addColumn('created_at', 'timestamp', (col) =>
      col.defaultTo(sql`now()`)
    )
    .execute();

  await db.schema
    .createIndex('users_email_idx')
    .on('users')
    .column('email')
    .execute();
}

export async function down(db: Kysely<any>): Promise<void> {
  await db.schema.dropTable('users').execute();
}
```

## Indexing Strategies

### Single-Column Indexes

```sql
-- ❌ No index - full table scan
SELECT * FROM users WHERE email = 'user@example.com';

-- ✅ Add index
CREATE INDEX idx_users_email ON users(email);

-- Query now uses index seek
SELECT * FROM users WHERE email = 'user@example.com';
```

### Composite Indexes

```sql
-- Query filtering by multiple columns
SELECT * FROM orders
WHERE user_id = '123' AND status = 'pending';

-- ✅ Composite index (order matters!)
CREATE INDEX idx_orders_user_status ON orders(user_id, status);

-- This query uses the index
SELECT * FROM orders WHERE user_id = '123' AND status = 'pending';

-- This query also uses the index (leftmost prefix)
SELECT * FROM orders WHERE user_id = '123';

-- ❌ This query does NOT use the index
SELECT * FROM orders WHERE status = 'pending';  -- status is not leftmost

-- For both queries, create index with different order
CREATE INDEX idx_orders_status_user ON orders(status, user_id);
```

### Covering Indexes

```sql
-- ❌ Index seek + table lookup
CREATE INDEX idx_users_email ON users(email);

SELECT id, name FROM users WHERE email = 'user@example.com';
-- Finds row via index, then fetches name from table

-- ✅ Covering index (includes all needed columns)
CREATE INDEX idx_users_email_covering ON users(email) INCLUDE (name);

SELECT id, name FROM users WHERE email = 'user@example.com';
-- All data in index, no table lookup needed
```

### Partial Indexes

```sql
-- Index only active users
CREATE INDEX idx_active_users
ON users(email)
WHERE active = true;

-- Smaller index, faster lookups for common case
SELECT * FROM users WHERE email = 'user@example.com' AND active = true;
```

### Analyze Index Usage

```sql
-- PostgreSQL: Check index usage
SELECT
  schemaname,
  tablename,
  indexname,
  idx_scan as index_scans,
  idx_tup_read as tuples_read,
  idx_tup_fetch as tuples_fetched
FROM pg_stat_user_indexes
ORDER BY idx_scan ASC;

-- Find unused indexes
SELECT
  schemaname,
  tablename,
  indexname
FROM pg_stat_user_indexes
WHERE idx_scan = 0
  AND indexrelname NOT LIKE 'pg_toast%';
```

## Polyglot Persistence

### Choosing the Right Database

```typescript
// Relational (PostgreSQL) - Structured data, complex queries
class UserRepository {
  async findByEmail(email: string): Promise<User> {
    return db.query(
      'SELECT * FROM users WHERE email = $1',
      [email]
    );
  }

  async getUserOrders(userId: string): Promise<Order[]> {
    return db.query(`
      SELECT o.*, array_agg(oi.*) as items
      FROM orders o
      JOIN order_items oi ON o.id = oi.order_id
      WHERE o.user_id = $1
      GROUP BY o.id
    `, [userId]);
  }
}

// Key-Value (Redis) - Caching, session storage
class SessionStore {
  constructor(private redis: Redis) {}

  async set(sessionId: string, data: SessionData): Promise<void> {
    await this.redis.setex(
      `session:${sessionId}`,
      3600,
      JSON.stringify(data)
    );
  }

  async get(sessionId: string): Promise<SessionData | null> {
    const data = await this.redis.get(`session:${sessionId}`);
    return data ? JSON.parse(data) : null;
  }
}

// Document (MongoDB) - Flexible schema, nested data
class ProductCatalog {
  constructor(private mongo: MongoClient) {}

  async addProduct(product: Product): Promise<void> {
    await this.mongo.db().collection('products').insertOne({
      name: product.name,
      price: product.price,
      attributes: product.attributes,  // Flexible nested structure
      reviews: [],
      metadata: {
        createdAt: new Date(),
        updatedAt: new Date()
      }
    });
  }
}

// Search Engine (Elasticsearch) - Full-text search
class ProductSearch {
  constructor(private es: ElasticsearchClient) {}

  async search(query: string): Promise<Product[]> {
    const result = await this.es.search({
      index: 'products',
      body: {
        query: {
          multi_match: {
            query,
            fields: ['name^2', 'description', 'category']
          }
        }
      }
    });

    return result.hits.hits.map(hit => hit._source);
  }
}

// Graph Database (Neo4j) - Relationships, social networks
class SocialGraph {
  async getFriendRecommendations(userId: string): Promise<User[]> {
    return neo4j.run(`
      MATCH (user:User {id: $userId})-[:FRIENDS_WITH]->(friend)-[:FRIENDS_WITH]->(recommendation)
      WHERE NOT (user)-[:FRIENDS_WITH]->(recommendation)
        AND user <> recommendation
      RETURN recommendation, count(*) as mutual_friends
      ORDER BY mutual_friends DESC
      LIMIT 10
    `, { userId });
  }
}
```

## Connection Pooling

### PostgreSQL Pool Configuration

```typescript
import { Pool } from 'pg';

const pool = new Pool({
  host: process.env.DB_HOST,
  port: parseInt(process.env.DB_PORT || '5432'),
  database: process.env.DB_NAME,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,

  // Pool configuration
  max: 20,                      // Maximum connections
  min: 5,                       // Minimum idle connections
  idleTimeoutMillis: 30000,     // Close idle connections after 30s
  connectionTimeoutMillis: 2000, // Error if can't connect in 2s
  maxUses: 7500,                // Reconnect after N uses (prevents leaks)
});

// Proper connection handling
const getUser = async (id: string): Promise<User> => {
  const client = await pool.connect();

  try {
    const result = await client.query(
      'SELECT * FROM users WHERE id = $1',
      [id]
    );
    return result.rows[0];
  } finally {
    client.release(); // Always release back to pool
  }
};

// Graceful shutdown
process.on('SIGTERM', async () => {
  await pool.end();
  process.exit(0);
});
```

## Transaction Management

### ACID Transactions

```typescript
// Single transaction
const transferMoney = async (fromId: string, toId: string, amount: number) => {
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    // Debit from account
    await client.query(
      'UPDATE accounts SET balance = balance - $1 WHERE id = $2',
      [amount, fromId]
    );

    // Credit to account
    await client.query(
      'UPDATE accounts SET balance = balance + $1 WHERE id = $2',
      [amount, toId]
    );

    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
};
```

### Optimistic Locking

```sql
-- Add version column
ALTER TABLE products ADD COLUMN version INT DEFAULT 1;

-- Update with version check
UPDATE products
SET stock = stock - 1, version = version + 1
WHERE id = '123' AND version = 5;

-- Returns 0 rows if version doesn't match (concurrent update detected)
```

```typescript
const updateProduct = async (id: string, currentVersion: number, updates: Partial<Product>) => {
  const result = await db.query(`
    UPDATE products
    SET name = $1, price = $2, version = version + 1
    WHERE id = $3 AND version = $4
    RETURNING *
  `, [updates.name, updates.price, id, currentVersion]);

  if (result.rows.length === 0) {
    throw new Error('Concurrent modification detected');
  }

  return result.rows[0];
};
```

## Query Optimization

### Use EXPLAIN ANALYZE

```sql
EXPLAIN ANALYZE
SELECT u.name, COUNT(o.id) as order_count
FROM users u
LEFT JOIN orders o ON u.id = o.user_id
WHERE u.created_at > '2024-01-01'
GROUP BY u.id, u.name
HAVING COUNT(o.id) > 5;

-- Output shows:
-- - Seq Scan vs Index Scan
-- - Actual execution time
-- - Rows processed vs estimated
```

### Avoid N+1 Queries

```typescript
// ❌ N+1 queries
const getUsersWithOrders = async () => {
  const users = await db.query('SELECT * FROM users');

  for (const user of users) {
    user.orders = await db.query(
      'SELECT * FROM orders WHERE user_id = $1',
      [user.id]
    ); // N queries!
  }

  return users;
};

// ✅ Single query with JOIN
const getUsersWithOrders = async () => {
  return db.query(`
    SELECT
      u.*,
      json_agg(o.*) as orders
    FROM users u
    LEFT JOIN orders o ON u.id = o.user_id
    GROUP BY u.id
  `);
};

// ✅ Or use DataLoader (batching)
import DataLoader from 'dataloader';

const orderLoader = new DataLoader(async (userIds: string[]) => {
  const orders = await db.query(
    'SELECT * FROM orders WHERE user_id = ANY($1)',
    [userIds]
  );

  // Group by user_id
  const ordersByUser = new Map();
  orders.forEach(order => {
    if (!ordersByUser.has(order.user_id)) {
      ordersByUser.set(order.user_id, []);
    }
    ordersByUser.get(order.user_id).push(order);
  });

  return userIds.map(id => ordersByUser.get(id) || []);
});
```

### Pagination

```typescript
// ❌ OFFSET pagination (slow for large offsets)
const getUsers = async (page: number, pageSize: number) => {
  const offset = page * pageSize;
  return db.query(
    'SELECT * FROM users ORDER BY created_at DESC LIMIT $1 OFFSET $2',
    [pageSize, offset]
  );
  // Page 1000: scans and skips 1,000,000 rows!
};

// ✅ Cursor-based pagination (keyset pagination)
const getUsers = async (afterCursor?: string, pageSize: number = 20) => {
  const query = afterCursor
    ? 'SELECT * FROM users WHERE created_at < $1 ORDER BY created_at DESC LIMIT $2'
    : 'SELECT * FROM users ORDER BY created_at DESC LIMIT $1';

  const params = afterCursor
    ? [afterCursor, pageSize]
    : [pageSize];

  const users = await db.query(query, params);

  return {
    users,
    nextCursor: users[users.length - 1]?.created_at
  };
};
```

## Data Modeling Patterns

### Soft Delete

```sql
-- Add deleted_at column
ALTER TABLE users
ADD COLUMN deleted_at TIMESTAMP NULL;

CREATE INDEX idx_users_deleted_at ON users(deleted_at)
WHERE deleted_at IS NULL;

-- Soft delete
UPDATE users SET deleted_at = NOW() WHERE id = '123';

-- Query only active records
SELECT * FROM users WHERE deleted_at IS NULL;

-- Include deleted records
SELECT * FROM users;  -- Shows all
```

### Audit Trail

```sql
CREATE TABLE audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  table_name VARCHAR(50) NOT NULL,
  record_id UUID NOT NULL,
  action VARCHAR(10) NOT NULL,  -- INSERT, UPDATE, DELETE
  old_values JSONB,
  new_values JSONB,
  changed_by UUID REFERENCES users(id),
  changed_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_audit_log_table_record ON audit_log(table_name, record_id);

-- Trigger to log changes
CREATE OR REPLACE FUNCTION audit_trigger_func()
RETURNS TRIGGER AS $$
BEGIN
  IF (TG_OP = 'DELETE') THEN
    INSERT INTO audit_log (table_name, record_id, action, old_values, changed_by)
    VALUES (TG_TABLE_NAME, OLD.id, 'DELETE', row_to_json(OLD), current_setting('app.current_user_id')::UUID);
    RETURN OLD;
  ELSIF (TG_OP = 'UPDATE') THEN
    INSERT INTO audit_log (table_name, record_id, action, old_values, new_values, changed_by)
    VALUES (TG_TABLE_NAME, NEW.id, 'UPDATE', row_to_json(OLD), row_to_json(NEW), current_setting('app.current_user_id')::UUID);
    RETURN NEW;
  ELSIF (TG_OP = 'INSERT') THEN
    INSERT INTO audit_log (table_name, record_id, action, new_values, changed_by)
    VALUES (TG_TABLE_NAME, NEW.id, 'INSERT', row_to_json(NEW), current_setting('app.current_user_id')::UUID);
    RETURN NEW;
  END IF;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER users_audit_trigger
AFTER INSERT OR UPDATE OR DELETE ON users
FOR EACH ROW EXECUTE FUNCTION audit_trigger_func();
```

## Anti-Patterns

### ❌ God Table

```sql
-- Avoid tables with 100+ columns
CREATE TABLE users (
  id UUID,
  -- 100 more columns of mixed concerns
  billing_address TEXT,
  shipping_address TEXT,
  payment_method VARCHAR(50),
  subscription_tier VARCHAR(20),
  -- ...
);

-- ✅ Split into focused tables
CREATE TABLE users (id UUID, email VARCHAR, name VARCHAR);
CREATE TABLE user_addresses (user_id UUID, type VARCHAR, address TEXT);
CREATE TABLE user_subscriptions (user_id UUID, tier VARCHAR, status VARCHAR);
```

### ❌ Entity-Attribute-Value (EAV)

```sql
-- ❌ Flexible but unqueryable
CREATE TABLE entity_attributes (
  entity_id UUID,
  attribute_name VARCHAR(50),
  attribute_value TEXT
);

-- ✅ Use JSONB for flexible schema
CREATE TABLE products (
  id UUID PRIMARY KEY,
  name VARCHAR(200),
  price DECIMAL(10, 2),
  attributes JSONB
);

CREATE INDEX idx_products_attributes ON products USING GIN (attributes);

SELECT * FROM products WHERE attributes @> '{"color": "red"}';
```

### ❌ UUID as VARCHAR

```sql
-- ❌ Wastes space and performance
CREATE TABLE users (
  id VARCHAR(36) PRIMARY KEY  -- 36 bytes
);

-- ✅ Use native UUID type
CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid()  -- 16 bytes
);
```

## References

- [Evolutionary Database Design](https://martinfowler.com/articles/evodb.html)
- [Polyglot Persistence](https://martinfowler.com/bliki/PolyglotPersistence.html)
- [Use The Index, Luke](https://use-the-index-luke.com/)
- [PostgreSQL Performance](https://www.postgresql.org/docs/current/performance-tips.html)
