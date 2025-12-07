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
