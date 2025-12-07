# Concurrency Patterns

## Optimistic Locking

Detect conflicts on commit using version numbers.

```typescript
class Product {
  constructor(
    public id: string,
    public name: string,
    public version: number = 1
  ) {}
}

class ProductRepository {
  async save(product: Product): Promise<void> {
    const result = await this.db.execute(
      `UPDATE products SET name = $1, version = version + 1
       WHERE id = $2 AND version = $3`,
      [product.name, product.id, product.version]
    );

    if (result.rowCount === 0) {
      throw new OptimisticLockException('Product was modified');
    }
    product.version++;
  }
}
```

## Pessimistic Locking

Lock resources before editing.

```typescript
class LockManager {
  async acquireLock(resourceId: string, ownerId: string): Promise<boolean> {
    const existing = await this.db.queryOne(
      'SELECT * FROM locks WHERE resource_id = $1 AND expires_at > NOW()',
      [resourceId]
    );

    if (existing) return false;

    await this.db.execute(
      'INSERT INTO locks (resource_id, owner_id, expires_at) VALUES ($1, $2, $3)',
      [resourceId, ownerId, new Date(Date.now() + 30000)]
    );
    return true;
  }

  async releaseLock(resourceId: string, ownerId: string): Promise<void> {
    await this.db.execute(
      'DELETE FROM locks WHERE resource_id = $1 AND owner_id = $2',
      [resourceId, ownerId]
    );
  }
}
```

## Coarse-Grained Lock

Lock entire aggregate rather than individual entities.

```typescript
class OrderRepository {
  async save(order: Order): Promise<void> {
    // Lock aggregate root, all children implicitly locked
    await this.db.execute(
      'SELECT * FROM orders WHERE id = $1 FOR UPDATE',
      [order.id]
    );

    // Update order and all items in single transaction
    await this.updateOrder(order);
    await this.updateOrderItems(order.items);
  }
}
```

## Best Practices

- Use optimistic locking for low-contention scenarios
- Use pessimistic locking for high-contention or critical data
- Always set lock timeouts
- Implement retry logic with exponential backoff
