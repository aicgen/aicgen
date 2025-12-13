# Performance

# Caching Strategies

## In-Memory Caching

```typescript
class Cache<T> {
  private cache = new Map<string, { value: T; expiry: number }>();

  set(key: string, value: T, ttlMs: number = 60000): void {
    this.cache.set(key, {
      value,
      expiry: Date.now() + ttlMs
    });
  }

  get(key: string): T | null {
    const item = this.cache.get(key);
    if (!item) return null;

    if (Date.now() > item.expiry) {
      this.cache.delete(key);
      return null;
    }

    return item.value;
  }
}

// Usage
const userCache = new Cache<User>();

async function getUser(id: string): Promise<User> {
  const cached = userCache.get(id);
  if (cached) return cached;

  const user = await db.findUser(id);
  userCache.set(id, user, 300000); // 5 minutes
  return user;
}
```

## Redis Caching

```typescript
import Redis from 'ioredis';

const redis = new Redis();

async function getCachedUser(id: string): Promise<User | null> {
  const cached = await redis.get(`user:${id}`);
  if (cached) return JSON.parse(cached);

  const user = await db.findUser(id);
  await redis.setex(`user:${id}`, 300, JSON.stringify(user)); // 5 min TTL
  return user;
}

// Cache invalidation on update
async function updateUser(id: string, data: Partial<User>) {
  const user = await db.updateUser(id, data);
  await redis.del(`user:${id}`); // Invalidate cache
  return user;
}
```

## HTTP Caching

```typescript
// Cache-Control headers
app.get('/api/products', (req, res) => {
  res.set('Cache-Control', 'public, max-age=300'); // 5 minutes
  res.json(products);
});

// ETag for conditional requests
app.get('/api/user/:id', async (req, res) => {
  const user = await getUser(req.params.id);
  const etag = generateETag(user);

  res.set('ETag', etag);

  if (req.headers['if-none-match'] === etag) {
    return res.status(304).end(); // Not Modified
  }

  res.json(user);
});
```

## Cache-Aside Pattern

```typescript
// Also called "lazy loading"
async function getProduct(id: string): Promise<Product> {
  // 1. Check cache
  const cached = await redis.get(`product:${id}`);
  if (cached) return JSON.parse(cached);

  // 2. Cache miss - load from database
  const product = await db.findProduct(id);

  // 3. Store in cache
  await redis.setex(`product:${id}`, 600, JSON.stringify(product));

  return product;
}
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

// Cache expensive computations
const calculateDiscount = memoize((price: number, tier: string) => {
  // Complex calculation
  return result;
});
```

## Cache Invalidation Strategies

```typescript
// Time-based expiry
await redis.setex(key, 300, value); // Expires after 5 minutes

// Event-based invalidation
async function updateProduct(id: string, data: ProductUpdate) {
  await db.updateProduct(id, data);
  await redis.del(`product:${id}`);
  await redis.del('products:list'); // Invalidate list cache too
}

// Cache warming
async function warmCache() {
  const popularProducts = await db.getMostViewed(100);
  for (const product of popularProducts) {
    await redis.setex(`product:${product.id}`, 3600, JSON.stringify(product));
  }
}
```


---

# Async Performance Patterns

## Parallel Execution

```typescript
// ❌ Sequential - slow
async function getUserData(userId: string) {
  const user = await fetchUser(userId);       // 100ms
  const posts = await fetchPosts(userId);     // 150ms
  const comments = await fetchComments(userId); // 120ms
  return { user, posts, comments }; // Total: 370ms
}

// ✅ Parallel - fast
async function getUserData(userId: string) {
  const [user, posts, comments] = await Promise.all([
    fetchUser(userId),
    fetchPosts(userId),
    fetchComments(userId)
  ]);
  return { user, posts, comments }; // Total: 150ms
}

// ✅ Partial parallel with dependencies
async function getOrderDetails(orderId: string) {
  const order = await fetchOrder(orderId); // Must fetch first

  const [customer, items, shipping] = await Promise.all([
    fetchCustomer(order.customerId),
    fetchOrderItems(orderId),
    fetchShippingInfo(orderId)
  ]);

  return { order, customer, items, shipping };
}
```

## Promise.allSettled for Partial Failures

```typescript
// Return partial data instead of complete failure
async function getDashboard(userId: string) {
  const [user, orders, stats] = await Promise.allSettled([
    getUser(userId),
    getOrders(userId),
    getStats(userId)
  ]);

  return {
    user: user.status === 'fulfilled' ? user.value : null,
    orders: orders.status === 'fulfilled' ? orders.value : [],
    stats: stats.status === 'fulfilled' ? stats.value : null,
    errors: {
      user: user.status === 'rejected' ? user.reason.message : null,
      orders: orders.status === 'rejected' ? orders.reason.message : null,
      stats: stats.status === 'rejected' ? stats.reason.message : null
    }
  };
}
```

## Batch Processing

```typescript
// ❌ One at a time - slow
async function processUsers(userIds: string[]) {
  for (const id of userIds) {
    await updateUser(id);
  }
}

// ✅ Batch processing
async function processUsers(userIds: string[]) {
  const BATCH_SIZE = 50;

  for (let i = 0; i < userIds.length; i += BATCH_SIZE) {
    const batch = userIds.slice(i, i + BATCH_SIZE);
    await Promise.all(batch.map(id => updateUser(id)));
  }
}

// ✅ Bulk database operations
async function createUsers(users: User[]) {
  await db.query(`
    INSERT INTO users (name, email)
    VALUES ${users.map(() => '(?, ?)').join(', ')}
  `, users.flatMap(u => [u.name, u.email]));
}
```

## Debouncing and Throttling

```typescript
// Debounce: Wait until user stops typing
const debounce = <T extends (...args: any[]) => any>(
  fn: T,
  delay: number
): ((...args: Parameters<T>) => void) => {
  let timeoutId: NodeJS.Timeout;

  return (...args: Parameters<T>) => {
    clearTimeout(timeoutId);
    timeoutId = setTimeout(() => fn(...args), delay);
  };
};

// Throttle: Execute at most once per interval
const throttle = <T extends (...args: any[]) => any>(
  fn: T,
  limit: number
): ((...args: Parameters<T>) => void) => {
  let inThrottle: boolean;

  return (...args: Parameters<T>) => {
    if (!inThrottle) {
      fn(...args);
      inThrottle = true;
      setTimeout(() => (inThrottle = false), limit);
    }
  };
};

// Usage
const searchUsers = debounce(query => api.search(query), 300);
const handleScroll = throttle(() => console.log('scroll'), 100);
```

## Rate Limiting Concurrent Operations

```typescript
async function processWithLimit<T>(
  items: T[],
  fn: (item: T) => Promise<void>,
  concurrency: number
): Promise<void> {
  const chunks = [];
  for (let i = 0; i < items.length; i += concurrency) {
    chunks.push(items.slice(i, i + concurrency));
  }

  for (const chunk of chunks) {
    await Promise.all(chunk.map(fn));
  }
}

// Usage: Process 100 items, max 10 at a time
await processWithLimit(users, updateUser, 10);
```


---

# Caching Strategies

## Cache Patterns

### Cache-Aside (Lazy Loading)
```typescript
async function getUser(id: string): Promise<User> {
  const cached = await cache.get(`user:${id}`);
  if (cached) return cached;

  const user = await db.findUser(id);
  await cache.set(`user:${id}`, user, { ttl: 3600 });
  return user;
}
```

### Write-Through
```typescript
async function updateUser(user: User): Promise<void> {
  await db.saveUser(user);
  await cache.set(`user:${user.id}`, user);
}
```

### Write-Behind (Write-Back)
```typescript
async function updateUser(user: User): Promise<void> {
  await cache.set(`user:${user.id}`, user);
  await queue.add('sync-to-db', { user }); // Async persistence
}
```

## Cache Invalidation

```typescript
// Time-based expiration
await cache.set('key', value, { ttl: 3600 });

// Event-based invalidation
eventBus.on('user.updated', async (userId) => {
  await cache.delete(`user:${userId}`);
});

// Pattern-based invalidation
await cache.deleteByPattern('user:*');
```

## HTTP Caching

```typescript
// Cache-Control headers
res.setHeader('Cache-Control', 'public, max-age=3600');
res.setHeader('ETag', etag(content));

// Conditional requests
if (req.headers['if-none-match'] === currentEtag) {
  return res.status(304).end();
}
```

## Best Practices

- Cache at appropriate layers (CDN, app, DB)
- Use consistent cache keys
- Set appropriate TTLs
- Monitor cache hit rates
- Plan for cache failures (fallback to source)
- Avoid caching sensitive data
