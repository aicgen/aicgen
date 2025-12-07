# TypeScript Performance

## Choose Right Data Structures

```typescript
// ❌ Array for lookups (O(n))
const users: User[] = [];
const findUser = (id: string) => users.find(u => u.id === id);

// ✅ Map for O(1) lookups
const users = new Map<string, User>();
const findUser = (id: string) => users.get(id);

// ❌ Array for membership checks
const hasPermission = (perms: string[], perm: string) => perms.includes(perm);

// ✅ Set for O(1) membership
const hasPermission = (perms: Set<string>, perm: string) => perms.has(perm);
```

## Avoid N+1 Queries

```typescript
// ❌ N+1 queries
const getOrdersWithCustomers = async () => {
  const orders = await db.query('SELECT * FROM orders');
  for (const order of orders) {
    order.customer = await db.query('SELECT * FROM customers WHERE id = ?', [order.customerId]);
  }
  return orders;
};

// ✅ Single JOIN query
const getOrdersWithCustomers = async () => {
  return db.query(`
    SELECT orders.*, customers.name as customer_name
    FROM orders
    JOIN customers ON orders.customer_id = customers.id
  `);
};

// ✅ Using ORM with eager loading
const getOrdersWithCustomers = async () => {
  return orderRepository.find({ relations: ['customer'] });
};
```

## Parallel Execution

```typescript
// ❌ Sequential (slow)
const getUserData = async (userId: string) => {
  const user = await fetchUser(userId);       // 100ms
  const posts = await fetchPosts(userId);     // 150ms
  const comments = await fetchComments(userId); // 120ms
  return { user, posts, comments }; // Total: 370ms
};

// ✅ Parallel (fast)
const getUserData = async (userId: string) => {
  const [user, posts, comments] = await Promise.all([
    fetchUser(userId),
    fetchPosts(userId),
    fetchComments(userId)
  ]);
  return { user, posts, comments }; // Total: 150ms
};
```

## Memoization

```typescript
const memoize = <T extends (...args: any[]) => any>(fn: T): T => {
  const cache = new Map<string, ReturnType<T>>();

  return ((...args: any[]) => {
    const key = JSON.stringify(args);
    if (cache.has(key)) return cache.get(key);
    const result = fn(...args);
    cache.set(key, result);
    return result;
  }) as T;
};

const expensiveCalc = memoize((n: number) => {
  // Expensive computation
  return result;
});
```

## Batch Processing

```typescript
// ✅ Process in batches
const processUsers = async (userIds: string[]) => {
  const BATCH_SIZE = 50;

  for (let i = 0; i < userIds.length; i += BATCH_SIZE) {
    const batch = userIds.slice(i, i + BATCH_SIZE);
    await Promise.all(batch.map(id => updateUser(id)));
  }
};
```
