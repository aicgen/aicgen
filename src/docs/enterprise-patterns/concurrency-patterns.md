# Concurrency Patterns

## Overview

Concurrency patterns handle the challenges of managing data consistency when multiple users or processes access the same data simultaneously. These patterns address conflicts, locking strategies, and transaction isolation.

## Pattern Selection Guide

| Pattern | Lock Scope | Conflict Detection | Performance | Best For |
|---------|-----------|-------------------|-------------|----------|
| Optimistic Offline Lock | Record-level | On commit | High read, low write | Low contention scenarios |
| Pessimistic Offline Lock | Record-level | On acquisition | Lower throughput | High contention scenarios |
| Coarse-Grained Lock | Multiple records | On acquisition | Reduced overhead | Related entities |
| Implicit Lock | Automatic | Transparent | Varies | Simple applications |

---

## Optimistic Offline Lock

### Definition

**Prevents conflicts between concurrent business transactions by detecting a conflict and rolling back the transaction.**

### Purpose

Allow multiple users to read and modify data, detecting conflicts only when trying to commit changes.

### When to Use

✅ **Good For:**
- Low contention scenarios
- Read-heavy workloads
- Distributed systems where locks are expensive
- Long-running business transactions
- Better user experience (no blocking)

❌ **Not Ideal For:**
- High contention scenarios (many conflicts)
- When rollback cost is high
- Critical updates that must succeed

### Example

```typescript
interface Versioned {
  id: string;
  version: number;
}

class Product implements Versioned {
  constructor(
    public id: string,
    public name: string,
    public price: number,
    public version: number = 1
  ) {}
}

class ProductRepository {
  async save(product: Product): Promise<void> {
    const current = await this.db.queryOne(
      'SELECT version FROM products WHERE id = $1',
      [product.id]
    );

    if (!current) {
      await this.db.execute(
        'INSERT INTO products (id, name, price, version) VALUES ($1, $2, $3, $4)',
        [product.id, product.name, product.price, product.version]
      );
      return;
    }

    if (current.version !== product.version) {
      throw new OptimisticLockException(
        `Product ${product.id} was modified by another user. Expected version ${product.version}, found ${current.version}`
      );
    }

    await this.db.execute(
      'UPDATE products SET name = $1, price = $2, version = version + 1 WHERE id = $3 AND version = $4',
      [product.name, product.price, product.id, product.version]
    );

    product.version += 1;
  }
}

class OptimisticLockException extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'OptimisticLockException';
  }
}

// Usage
async function updateProductPrice(productId: string, newPrice: number) {
  const maxRetries = 3;
  let attempt = 0;

  while (attempt < maxRetries) {
    try {
      const product = await productRepo.findById(productId);
      product.price = newPrice;
      await productRepo.save(product);
      return;
    } catch (error) {
      if (error instanceof OptimisticLockException) {
        attempt++;
        if (attempt >= maxRetries) {
          throw new Error('Failed to update product after multiple retries');
        }
        await delay(100 * attempt);
      } else {
        throw error;
      }
    }
  }
}
```

### Implementation Strategies

**1. Version Number**
```typescript
class VersionedEntity {
  version: number = 1;
}

// Increment on each update
UPDATE entities SET data = $1, version = version + 1
WHERE id = $2 AND version = $3
```

**2. Timestamp**
```typescript
class TimestampedEntity {
  lastModified: Date = new Date();
}

// Check timestamp hasn't changed
UPDATE entities SET data = $1, last_modified = NOW()
WHERE id = $2 AND last_modified = $3
```

**3. Hash/Checksum**
```typescript
class HashedEntity {
  checksum: string;

  calculateChecksum(): string {
    return hash(JSON.stringify(this.data));
  }
}
```

### Best Practices

✅ **DO:**
- Implement retry logic with exponential backoff
- Provide clear error messages to users
- Consider merging changes when possible
- Use version numbers for simplicity
- Handle conflicts gracefully

❌ **DON'T:**
- Retry indefinitely
- Hide conflicts from users
- Use optimistic locking for critical updates with high contention
- Forget to increment version on successful update

---

## Pessimistic Offline Lock

### Definition

**Prevents conflicts by locking data when a user begins to edit it, releasing the lock only when the edit is complete.**

### Purpose

Ensure exclusive access to data during long-running business transactions.

### When to Use

✅ **Good For:**
- High contention scenarios
- Critical data that must be updated successfully
- When cost of conflict is high
- Financial transactions
- Inventory management

❌ **Not Ideal For:**
- Low contention scenarios (unnecessary overhead)
- Distributed systems (lock coordination complex)
- Read-heavy workloads

### Example

```typescript
interface Lock {
  resourceId: string;
  ownerId: string;
  acquiredAt: Date;
  expiresAt: Date;
}

class LockManager {
  private locks = new Map<string, Lock>();

  async acquireLock(
    resourceId: string,
    ownerId: string,
    durationMs: number = 30000
  ): Promise<boolean> {
    const existing = this.locks.get(resourceId);
    const now = new Date();

    if (existing) {
      if (existing.expiresAt > now) {
        if (existing.ownerId === ownerId) {
          this.extendLock(resourceId, durationMs);
          return true;
        }
        return false;
      }
      this.locks.delete(resourceId);
    }

    const lock: Lock = {
      resourceId,
      ownerId,
      acquiredAt: now,
      expiresAt: new Date(now.getTime() + durationMs)
    };

    await this.db.execute(
      'INSERT INTO locks (resource_id, owner_id, acquired_at, expires_at) VALUES ($1, $2, $3, $4)',
      [resourceId, ownerId, lock.acquiredAt, lock.expiresAt]
    );

    this.locks.set(resourceId, lock);
    return true;
  }

  async releaseLock(resourceId: string, ownerId: string): Promise<boolean> {
    const lock = this.locks.get(resourceId);

    if (!lock || lock.ownerId !== ownerId) {
      return false;
    }

    await this.db.execute(
      'DELETE FROM locks WHERE resource_id = $1 AND owner_id = $2',
      [resourceId, ownerId]
    );

    this.locks.delete(resourceId);
    return true;
  }

  private extendLock(resourceId: string, durationMs: number): void {
    const lock = this.locks.get(resourceId);
    if (lock) {
      lock.expiresAt = new Date(Date.now() + durationMs);
    }
  }

  async cleanupExpiredLocks(): Promise<void> {
    const now = new Date();
    for (const [resourceId, lock] of this.locks.entries()) {
      if (lock.expiresAt <= now) {
        this.locks.delete(resourceId);
      }
    }

    await this.db.execute(
      'DELETE FROM locks WHERE expires_at <= $1',
      [now]
    );
  }
}

class ProductService {
  constructor(
    private lockManager: LockManager,
    private productRepo: ProductRepository
  ) {}

  async editProduct(productId: string, userId: string): Promise<Product | null> {
    const acquired = await this.lockManager.acquireLock(productId, userId);

    if (!acquired) {
      throw new Error('Product is currently being edited by another user');
    }

    return this.productRepo.findById(productId);
  }

  async saveProduct(product: Product, userId: string): Promise<void> {
    const lock = this.lockManager.getLock(product.id);

    if (!lock || lock.ownerId !== userId) {
      throw new Error('You do not own the lock for this product');
    }

    await this.productRepo.save(product);
    await this.lockManager.releaseLock(product.id, userId);
  }

  async cancelEdit(productId: string, userId: string): Promise<void> {
    await this.lockManager.releaseLock(productId, userId);
  }
}
```

### Lock Timeout Strategies

**1. Fixed Timeout**
```typescript
const LOCK_DURATION = 30000; // 30 seconds
await lockManager.acquireLock(resourceId, userId, LOCK_DURATION);
```

**2. Heartbeat Extension**
```typescript
class LockHeartbeat {
  private intervalId?: NodeJS.Timeout;

  start(resourceId: string, userId: string, intervalMs: number = 10000) {
    this.intervalId = setInterval(async () => {
      await lockManager.extendLock(resourceId, userId, 30000);
    }, intervalMs);
  }

  stop() {
    if (this.intervalId) {
      clearInterval(this.intervalId);
    }
  }
}
```

**3. User Activity Detection**
```typescript
class ActivityBasedLock {
  private lastActivity = new Date();

  onUserActivity() {
    this.lastActivity = new Date();
    this.extendLockIfNeeded();
  }

  private async extendLockIfNeeded() {
    const timeSinceActivity = Date.now() - this.lastActivity.getTime();
    if (timeSinceActivity < 5000) {
      await lockManager.extendLock(this.resourceId, this.userId, 30000);
    }
  }
}
```

### Best Practices

✅ **DO:**
- Always set lock timeouts to prevent deadlocks
- Implement lock cleanup for expired locks
- Provide clear UI feedback when resource is locked
- Allow lock stealing for administrators
- Log lock acquisitions and releases

❌ **DON'T:**
- Lock indefinitely
- Forget to release locks on errors
- Lock too many resources at once
- Use pessimistic locks for read-only operations

---

## Coarse-Grained Lock

### Definition

**Locks a set of related objects with a single lock, simplifying lock management for aggregates.**

### Purpose

Reduce locking overhead by locking an entire aggregate rather than individual entities.

### When to Use

✅ **Good For:**
- Aggregate roots with children
- Related entities that are always modified together
- Reducing lock management complexity
- Domain-driven design aggregates

❌ **Not Ideal For:**
- Unrelated entities
- When fine-grained access is needed
- High-contention on aggregate root

### Example

```typescript
class Order {
  constructor(
    public id: string,
    public customerId: string,
    public items: OrderItem[] = [],
    public version: number = 1
  ) {}

  addItem(product: Product, quantity: number) {
    const item = new OrderItem(product.id, product.price, quantity);
    this.items.push(item);
  }

  removeItem(itemId: string) {
    this.items = this.items.filter(item => item.id !== itemId);
  }

  get total(): number {
    return this.items.reduce((sum, item) => sum + item.subtotal, 0);
  }
}

class OrderItem {
  constructor(
    public id: string = generateId(),
    public productId: string,
    public price: number,
    public quantity: number
  ) {}

  get subtotal(): number {
    return this.price * this.quantity;
  }
}

class OrderRepository {
  async save(order: Order): Promise<void> {
    const db = await Database.connect();
    await db.beginTransaction();

    try {
      // Lock the aggregate root (coarse-grained lock)
      const current = await db.queryOne(
        'SELECT version FROM orders WHERE id = $1 FOR UPDATE',
        [order.id]
      );

      if (current && current.version !== order.version) {
        throw new OptimisticLockException('Order was modified');
      }

      // Update entire aggregate
      await db.execute(
        'UPDATE orders SET customer_id = $1, version = version + 1 WHERE id = $2',
        [order.customerId, order.id]
      );

      // Delete and recreate all items (simple approach)
      await db.execute('DELETE FROM order_items WHERE order_id = $1', [order.id]);

      for (const item of order.items) {
        await db.execute(
          'INSERT INTO order_items (id, order_id, product_id, price, quantity) VALUES ($1, $2, $3, $4, $5)',
          [item.id, order.id, item.productId, item.price, item.quantity]
        );
      }

      await db.commit();
      order.version += 1;
    } catch (error) {
      await db.rollback();
      throw error;
    }
  }
}

// Pessimistic coarse-grained lock
class OrderLockManager {
  async lockOrderAggregate(orderId: string, userId: string): Promise<boolean> {
    const db = await Database.connect();

    try {
      // Lock both order and all items in one transaction
      await db.beginTransaction();

      await db.execute(
        'SELECT * FROM orders WHERE id = $1 FOR UPDATE',
        [orderId]
      );

      await db.execute(
        'SELECT * FROM order_items WHERE order_id = $1 FOR UPDATE',
        [orderId]
      );

      await this.lockManager.acquireLock(`order:${orderId}`, userId);

      await db.commit();
      return true;
    } catch (error) {
      await db.rollback();
      return false;
    }
  }
}
```

### Best Practices

✅ **DO:**
- Use for DDD aggregates
- Lock at aggregate root level
- Keep aggregates small
- Document locking boundaries

❌ **DON'T:**
- Create overly large aggregates
- Lock unrelated entities together
- Mix fine-grained and coarse-grained locks

---

## Implicit Lock

### Definition

**Automatically manages locks without explicit lock/unlock calls, typically through framework or ORM support.**

### Purpose

Simplify concurrency control by having the framework handle locking automatically.

### When to Use

✅ **Good For:**
- Simple applications
- Framework-managed transactions
- Rapid development
- When framework provides good defaults

❌ **Not Ideal For:**
- Complex locking requirements
- Fine-grained control needed
- Performance-critical applications

### Example

```typescript
// Using TypeORM with version-based optimistic locking
import { Entity, PrimaryGeneratedColumn, Column, VersionColumn } from 'typeorm';

@Entity()
class Product {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  name: string;

  @Column('decimal')
  price: number;

  @VersionColumn()
  version: number; // Automatically managed by TypeORM
}

// Repository usage - locking is implicit
class ProductService {
  constructor(private productRepo: Repository<Product>) {}

  async updatePrice(productId: string, newPrice: number): Promise<void> {
    const product = await this.productRepo.findOneBy({ id: productId });

    if (!product) {
      throw new Error('Product not found');
    }

    product.price = newPrice;

    try {
      await this.productRepo.save(product); // Implicit optimistic lock check
    } catch (error) {
      if (error.name === 'OptimisticLockVersionMismatch') {
        throw new Error('Product was modified by another user');
      }
      throw error;
    }
  }
}

// Pessimistic locking with TypeORM
class OrderService {
  async processOrder(orderId: string): Promise<void> {
    await this.dataSource.transaction(async (manager) => {
      // Implicit pessimistic lock via FOR UPDATE
      const order = await manager.findOne(Order, {
        where: { id: orderId },
        lock: { mode: 'pessimistic_write' }
      });

      if (!order) {
        throw new Error('Order not found');
      }

      order.status = 'processing';
      await manager.save(order); // Lock released on transaction commit
    });
  }
}
```

### Best Practices

✅ **DO:**
- Understand framework locking behavior
- Use for standard scenarios
- Configure lock timeouts
- Handle lock exceptions

❌ **DON'T:**
- Rely on implicit locking for complex scenarios
- Ignore framework documentation
- Mix implicit and explicit locking strategies

---

## Combining Patterns

### Optimistic + Coarse-Grained

```typescript
class OrderAggregate {
  constructor(
    public order: Order,
    public items: OrderItem[],
    public version: number
  ) {}
}

class OrderRepository {
  async saveAggregate(aggregate: OrderAggregate): Promise<void> {
    // Optimistic lock on entire aggregate
    const result = await this.db.execute(
      'UPDATE orders SET version = version + 1 WHERE id = $1 AND version = $2',
      [aggregate.order.id, aggregate.version]
    );

    if (result.rowCount === 0) {
      throw new OptimisticLockException('Order aggregate was modified');
    }

    // Update all items
    for (const item of aggregate.items) {
      await this.saveItem(item);
    }

    aggregate.version += 1;
  }
}
```

## Common Pitfalls

❌ **Deadlocks:** Two transactions waiting for each other's locks
❌ **Lock Escalation:** Too many fine-grained locks becoming table locks
❌ **Forgotten Locks:** Not releasing locks on error paths
❌ **Phantom Reads:** Reading data that gets modified before transaction completes
❌ **Timeout Hell:** Locks timing out due to long operations

## Key Takeaways

1. **Optimistic Locking:** Best for low contention, detect conflicts on commit
2. **Pessimistic Locking:** Best for high contention, prevent conflicts upfront
3. **Coarse-Grained Lock:** Lock aggregates, not individual entities
4. **Implicit Lock:** Let framework manage, good for simple cases
5. **Always use timeouts** to prevent deadlocks
6. **Choose based on contention** level and conflict cost
