# Caching Strategies & Patterns

## Cache Layers

### Multi-Tier Caching

```
Client (Browser)
    ↓ Cache-Control headers
CDN (CloudFlare/CloudFront)
    ↓ Geographic distribution
Reverse Proxy (Nginx/Varnish)
    ↓ HTTP caching
Application Cache (Redis/Memcached)
    ↓ In-memory data
Database Query Cache
    ↓ Query results
```

### Browser Caching

```typescript
// Static assets
app.use('/static', express.static('public', {
  maxAge: '1y',           // Cache for 1 year
  immutable: true          // Never revalidate
}));

// Dynamic content with validation
app.get('/api/user/:id', async (req, res) => {
  const user = await getUser(req.params.id);

  // Cache for 5 minutes, revalidate when stale
  res.set('Cache-Control', 'public, max-age=300, must-revalidate');

  // ETag for conditional requests
  const etag = generateETag(user);
  res.set('ETag', etag);

  if (req.headers['if-none-match'] === etag) {
    return res.status(304).end();
  }

  res.json(user);
});
```

### CDN Caching

```typescript
// Cloudflare Page Rules or AWS CloudFront
app.get('/api/public-data', (req, res) => {
  // Cache at CDN edge for 1 hour
  res.set('Cache-Control', 'public, max-age=3600, s-maxage=3600');
  res.set('Surrogate-Control', 'max-age=86400');  // CDN-specific

  res.json(getPublicData());
});

// Purge CDN cache when data changes
const updatePublicData = async (data) => {
  await db.update(data);

  // Purge Cloudflare cache
  await cloudflare.zones.purgeCache({
    files: ['https://example.com/api/public-data']
  });
};
```

## Cache Patterns

### Cache-Aside (Lazy Loading)

```typescript
const getUser = async (userId: string): Promise<User> => {
  // 1. Check cache
  const cached = await redis.get(`user:${userId}`);
  if (cached) {
    return JSON.parse(cached);
  }

  // 2. Cache miss: fetch from database
  const user = await db.findUser(userId);

  if (!user) {
    throw new NotFoundError('User', userId);
  }

  // 3. Store in cache
  await redis.setex(`user:${userId}`, 3600, JSON.stringify(user));

  return user;
};
```

### Read-Through Cache

```typescript
class CachedUserRepository {
  constructor(
    private cache: Redis,
    private db: Database
  ) {}

  async findById(userId: string): Promise<User> {
    const cacheKey = `user:${userId}`;

    // Cache handles fetching
    return this.cache.getOrSet(cacheKey, async () => {
      const user = await this.db.findUser(userId);
      return user;
    }, 3600);
  }
}

// Redis getOrSet implementation
Redis.prototype.getOrSet = async function(
  key: string,
  fetchFn: () => Promise<any>,
  ttl: number
): Promise<any> {
  const cached = await this.get(key);

  if (cached) {
    return JSON.parse(cached);
  }

  const value = await fetchFn();
  await this.setex(key, ttl, JSON.stringify(value));

  return value;
};
```

### Write-Through Cache

```typescript
const updateUser = async (userId: string, data: Partial<User>): Promise<User> => {
  // 1. Update database
  const user = await db.updateUser(userId, data);

  // 2. Update cache
  await redis.setex(`user:${userId}`, 3600, JSON.stringify(user));

  return user;
};
```

### Write-Behind (Write-Back) Cache

```typescript
class WriteBehindCache {
  private writeQueue: Map<string, any> = new Map();
  private flushInterval: NodeJS.Timeout;

  constructor(
    private cache: Redis,
    private db: Database,
    private flushIntervalMs: number = 5000
  ) {
    this.startFlushTimer();
  }

  async set(key: string, value: any): Promise<void> {
    // 1. Write to cache immediately
    await this.cache.set(key, JSON.stringify(value));

    // 2. Queue for database write
    this.writeQueue.set(key, value);
  }

  private startFlushTimer(): void {
    this.flushInterval = setInterval(async () => {
      await this.flush();
    }, this.flushIntervalMs);
  }

  private async flush(): Promise<void> {
    if (this.writeQueue.size === 0) return;

    const entries = Array.from(this.writeQueue.entries());
    this.writeQueue.clear();

    // Batch write to database
    await Promise.all(
      entries.map(([key, value]) =>
        this.db.upsert(key, value)
      )
    );
  }

  async shutdown(): Promise<void> {
    clearInterval(this.flushInterval);
    await this.flush();
  }
}
```

### Refresh-Ahead

```typescript
class RefreshAheadCache {
  constructor(
    private cache: Redis,
    private fetchFn: (key: string) => Promise<any>,
    private ttl: number = 3600
  ) {}

  async get(key: string): Promise<any> {
    const data = await this.cache.get(key);

    if (!data) {
      return this.fetchAndCache(key);
    }

    const ttlRemaining = await this.cache.ttl(key);

    // Refresh if less than 10% of TTL remains
    if (ttlRemaining < this.ttl * 0.1) {
      // Async refresh, return stale data immediately
      this.fetchAndCache(key).catch(err =>
        console.error('Background refresh failed:', err)
      );
    }

    return JSON.parse(data);
  }

  private async fetchAndCache(key: string): Promise<any> {
    const value = await this.fetchFn(key);
    await this.cache.setex(key, this.ttl, JSON.stringify(value));
    return value;
  }
}
```

## Cache Invalidation

### Time-Based Expiration (TTL)

```typescript
// Fixed TTL
await redis.setex('user:123', 3600, JSON.stringify(user)); // 1 hour

// Variable TTL based on data type
const getTTL = (dataType: string): number => {
  switch (dataType) {
    case 'user': return 3600;           // 1 hour
    case 'product': return 600;         // 10 minutes
    case 'config': return 86400;        // 24 hours
    case 'popular-posts': return 300;   // 5 minutes
    default: return 1800;
  }
};
```

### Event-Based Invalidation

```typescript
// Invalidate on update
const updateUser = async (userId: string, data: Partial<User>): Promise<User> => {
  const user = await db.updateUser(userId, data);

  // Invalidate user cache
  await redis.del(`user:${userId}`);

  // Invalidate related caches
  await redis.del(`user:${userId}:orders`);
  await redis.del(`user:${userId}:preferences`);

  return user;
};

// Event-driven invalidation
eventBus.on('user.updated', async (event) => {
  await redis.del(`user:${event.userId}`);
});

eventBus.on('order.created', async (event) => {
  await redis.del(`user:${event.userId}:orders`);
});
```

### Cache Tags

```typescript
class TaggedCache {
  constructor(private cache: Redis) {}

  async set(key: string, value: any, ttl: number, tags: string[]): Promise<void> {
    // Store value
    await this.cache.setex(key, ttl, JSON.stringify(value));

    // Associate tags
    for (const tag of tags) {
      await this.cache.sadd(`tag:${tag}`, key);
    }
  }

  async invalidateTag(tag: string): Promise<void> {
    // Get all keys with this tag
    const keys = await this.cache.smembers(`tag:${tag}`);

    if (keys.length > 0) {
      // Delete all tagged keys
      await this.cache.del(...keys);
    }

    // Remove tag set
    await this.cache.del(`tag:${tag}`);
  }
}

// Usage
const cache = new TaggedCache(redis);

// Cache with tags
await cache.set('product:123', product, 3600, ['products', 'category:electronics', 'brand:acme']);

// Invalidate all products in category
await cache.invalidateTag('category:electronics');
```

### Surrogate Keys

```typescript
// Group related cache entries
const cacheUser = async (userId: string, user: User): Promise<void> => {
  await redis.setex(`user:${userId}`, 3600, JSON.stringify(user));

  // Track in user's surrogate key set
  await redis.sadd(`surrogate:user:${userId}`, `user:${userId}`);
  await redis.sadd(`surrogate:user:${userId}`, `user:${userId}:orders`);
  await redis.sadd(`surrogate:user:${userId}`, `user:${userId}:preferences`);
};

const invalidateUserCache = async (userId: string): Promise<void> => {
  // Get all keys in surrogate set
  const keys = await redis.smembers(`surrogate:user:${userId}`);

  // Delete all
  if (keys.length > 0) {
    await redis.del(...keys);
  }

  // Delete surrogate set
  await redis.del(`surrogate:user:${userId}`);
};
```

## Cache Warming

### Proactive Caching

```typescript
// Warm cache on application startup
const warmCache = async (): Promise<void> => {
  console.log('Warming cache...');

  // Popular products
  const popularProducts = await db.getPopularProducts(100);
  for (const product of popularProducts) {
    await redis.setex(
      `product:${product.id}`,
      3600,
      JSON.stringify(product)
    );
  }

  // Global configuration
  const config = await db.getConfiguration();
  await redis.setex('app:config', 86400, JSON.stringify(config));

  console.log('Cache warmed');
};

// Run on startup
app.on('ready', warmCache);
```

### Scheduled Cache Warming

```typescript
import cron from 'node-cron';

// Warm cache every hour
cron.schedule('0 * * * *', async () => {
  console.log('Scheduled cache warming');

  const trendingPosts = await db.getTrendingPosts();
  for (const post of trendingPosts) {
    await redis.setex(`post:${post.id}`, 3600, JSON.stringify(post));
  }
});
```

## Distributed Caching

### Redis Cluster

```typescript
import Redis from 'ioredis';

const cluster = new Redis.Cluster([
  { host: 'redis-1', port: 6379 },
  { host: 'redis-2', port: 6379 },
  { host: 'redis-3', port: 6379 }
], {
  redisOptions: {
    password: process.env.REDIS_PASSWORD
  },
  scaleReads: 'slave'  // Read from replicas
});

// Automatic sharding across cluster
await cluster.set('user:123', JSON.stringify(user));
```

### Cache Replication

```typescript
// Primary-Replica setup
const primary = new Redis({
  host: 'redis-primary',
  port: 6379
});

const replica = new Redis({
  host: 'redis-replica',
  port: 6379
});

// Write to primary
await primary.set('user:123', JSON.stringify(user));

// Read from replica (eventually consistent)
const user = await replica.get('user:123');
```

## Cache Stampede Prevention

### Mutex/Lock Pattern

```typescript
const getUserWithLock = async (userId: string): Promise<User> => {
  const cacheKey = `user:${userId}`;
  const lockKey = `lock:${cacheKey}`;

  // Check cache
  const cached = await redis.get(cacheKey);
  if (cached) {
    return JSON.parse(cached);
  }

  // Try to acquire lock
  const lockAcquired = await redis.set(
    lockKey,
    '1',
    'EX', 10,  // 10 second expiry
    'NX'       // Only set if not exists
  );

  if (lockAcquired) {
    try {
      // Only this request fetches from database
      const user = await db.findUser(userId);

      await redis.setex(cacheKey, 3600, JSON.stringify(user));

      return user;
    } finally {
      await redis.del(lockKey);
    }
  }

  // Lock not acquired, wait and retry
  await new Promise(resolve => setTimeout(resolve, 100));
  return getUserWithLock(userId);  // Retry
};
```

### Probabilistic Early Expiration

```typescript
const getWithProbabilisticRefresh = async (key: string): Promise<any> => {
  const data = await redis.get(key);

  if (!data) {
    return fetchAndCache(key);
  }

  const ttl = await redis.ttl(key);
  const delta = Math.random() * 60;  // Random 0-60 seconds

  // Probabilistically refresh before expiry
  if (ttl - delta <= 0) {
    // Async refresh
    fetchAndCache(key).catch(console.error);
  }

  return JSON.parse(data);
};
```

## Cache Eviction Policies

### LRU (Least Recently Used)

```typescript
class LRUCache<T> {
  private cache = new Map<string, T>();
  private accessOrder: string[] = [];

  constructor(private maxSize: number) {}

  get(key: string): T | undefined {
    const value = this.cache.get(key);

    if (value !== undefined) {
      // Move to end (most recently used)
      this.accessOrder = this.accessOrder.filter(k => k !== key);
      this.accessOrder.push(key);
    }

    return value;
  }

  set(key: string, value: T): void {
    // Remove if exists
    if (this.cache.has(key)) {
      this.accessOrder = this.accessOrder.filter(k => k !== key);
    }

    // Evict oldest if at capacity
    if (this.cache.size >= this.maxSize && !this.cache.has(key)) {
      const oldest = this.accessOrder.shift();
      if (oldest) {
        this.cache.delete(oldest);
      }
    }

    this.cache.set(key, value);
    this.accessOrder.push(key);
  }
}
```

### Redis Eviction Policies

```bash
# redis.conf

# allkeys-lru: Evict any key using LRU
maxmemory-policy allkeys-lru

# volatile-lru: Evict keys with TTL using LRU
maxmemory-policy volatile-lru

# allkeys-lfu: Evict using Least Frequently Used
maxmemory-policy allkeys-lfu

# volatile-ttl: Evict keys with shortest TTL
maxmemory-policy volatile-ttl
```

## Cache Metrics

### Monitoring

```typescript
class CacheMonitor {
  private hits = 0;
  private misses = 0;
  private errors = 0;

  recordHit(): void {
    this.hits++;
  }

  recordMiss(): void {
    this.misses++;
  }

  recordError(): void {
    this.errors++;
  }

  getStats() {
    const total = this.hits + this.misses;
    const hitRate = total > 0 ? (this.hits / total) * 100 : 0;

    return {
      hits: this.hits,
      misses: this.misses,
      errors: this.errors,
      total,
      hitRate: hitRate.toFixed(2) + '%'
    };
  }

  reset(): void {
    this.hits = 0;
    this.misses = 0;
    this.errors = 0;
  }
}

// Usage
const monitor = new CacheMonitor();

const getCached = async (key: string): Promise<any> => {
  try {
    const value = await redis.get(key);

    if (value) {
      monitor.recordHit();
      return JSON.parse(value);
    }

    monitor.recordMiss();
    return null;
  } catch (error) {
    monitor.recordError();
    throw error;
  }
};

// Expose metrics
app.get('/metrics/cache', (req, res) => {
  res.json(monitor.getStats());
});
```

## Anti-Patterns

### ❌ Caching Everything

```typescript
// Don't cache data that changes frequently
await redis.set('user-online-status', status);  // Changes every second

// Don't cache tiny computations
await redis.set('2+2', '4');  // Caching overhead > computation
```

### ❌ No Cache Invalidation Strategy

```typescript
// ❌ Cache never expires, stale forever
await redis.set('user:123', JSON.stringify(user));  // No TTL

// ✅ Always set appropriate TTL
await redis.setex('user:123', 3600, JSON.stringify(user));
```

### ❌ Ignoring Cache Failures

```typescript
// ❌ Application crashes when cache is down
const user = await redis.get(`user:${id}`);  // Throws if Redis down

// ✅ Graceful degradation
const getUserResilient = async (id: string): Promise<User> => {
  try {
    const cached = await redis.get(`user:${id}`);
    if (cached) return JSON.parse(cached);
  } catch (error) {
    console.warn('Cache unavailable, fetching from database');
  }

  return db.findUser(id);
};
```

### ❌ Cache Key Collisions

```typescript
// ❌ Ambiguous keys
await redis.set('123', user);  // user? product? order?

// ✅ Namespaced keys
await redis.set('user:123', JSON.stringify(user));
await redis.set('product:123', JSON.stringify(product));
```

## Best Practices

### Cache Key Naming

```typescript
// Hierarchical namespace
const generateKey = {
  user: (id: string) => `user:${id}`,
  userOrders: (userId: string) => `user:${userId}:orders`,
  product: (id: string) => `product:${id}`,
  categoryProducts: (categoryId: string) => `category:${categoryId}:products`,
  sessionData: (sessionId: string) => `session:${sessionId}`
};

// Usage
await redis.setex(generateKey.user('123'), 3600, JSON.stringify(user));
```

### Compress Large Values

```typescript
import zlib from 'zlib';
import { promisify } from 'util';

const gzip = promisify(zlib.gzip);
const gunzip = promisify(zlib.gunzip);

const setCompressed = async (key: string, value: any, ttl: number): Promise<void> => {
  const json = JSON.stringify(value);
  const compressed = await gzip(json);

  await redis.setex(key, ttl, compressed);
};

const getCompressed = async (key: string): Promise<any> => {
  const compressed = await redis.getBuffer(key);

  if (!compressed) return null;

  const decompressed = await gunzip(compressed);
  return JSON.parse(decompressed.toString());
};
```

### Cache Versioning

```typescript
// Include version in key
const CACHE_VERSION = 'v2';

const getCacheKey = (entity: string, id: string): string => {
  return `${CACHE_VERSION}:${entity}:${id}`;
};

// When schema changes, increment version
// Old cache keys automatically become invalid
await redis.setex(getCacheKey('user', '123'), 3600, JSON.stringify(user));
```

## References

- [Caching Strategies](https://aws.amazon.com/caching/best-practices/)
- [Redis Best Practices](https://redis.io/docs/manual/patterns/)
- [HTTP Caching](https://developer.mozilla.org/en-US/docs/Web/HTTP/Caching)
- [Cache Stampede](https://en.wikipedia.org/wiki/Cache_stampede)
