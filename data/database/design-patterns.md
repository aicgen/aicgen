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
