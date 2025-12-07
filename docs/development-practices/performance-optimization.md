# Performance Optimization Best Practices

## Profiling First

### Never Optimize Without Measuring

```typescript
// ❌ Premature optimization
const processUsers = (users: User[]) => {
  // Assuming this is slow without measuring
  const cache = new Map();
  users.forEach(user => {
    if (!cache.has(user.id)) {
      cache.set(user.id, expensiveCalculation(user));
    }
  });
};

// ✅ Profile first, then optimize
// 1. Use profiling tools
console.time('processUsers');
const result = processUsers(users);
console.timeEnd('processUsers'); // processUsers: 2354ms

// 2. Identify bottlenecks with profiler
// Chrome DevTools → Performance tab
// Node.js → node --prof app.js

// 3. Optimize the actual bottleneck
const processUsers = (users: User[]) => {
  // Found that database queries were the issue
  return processUsersBatch(users); // Batch processing
};
```

### Profiling Tools

```typescript
// Console timing
console.time('operation');
await heavyOperation();
console.timeEnd('operation');

// Performance API (Browser)
const t0 = performance.now();
await operation();
const t1 = performance.now();
console.log(`Operation took ${t1 - t0}ms`);

// process.hrtime (Node.js)
const start = process.hrtime.bigint();
await operation();
const end = process.hrtime.bigint();
console.log(`Duration: ${(end - start) / 1000000n}ms`);

// Profiling decorator
const profile = (target: any, propertyKey: string, descriptor: PropertyDescriptor) => {
  const originalMethod = descriptor.value;

  descriptor.value = async function (...args: any[]) {
    const start = Date.now();
    const result = await originalMethod.apply(this, args);
    const duration = Date.now() - start;

    console.log(`${propertyKey} took ${duration}ms`);
    return result;
  };

  return descriptor;
};

class Service {
  @profile
  async processData(data: any[]) {
    // Implementation
  }
}
```

## Database Optimization

### N+1 Query Problem

```typescript
// ❌ N+1 queries (1 + N database calls)
const getOrdersWithCustomers = async () => {
  const orders = await db.query('SELECT * FROM orders');

  for (const order of orders) {
    // N additional queries!
    order.customer = await db.query('SELECT * FROM customers WHERE id = ?', [order.customerId]);
  }

  return orders;
};

// ✅ Use JOIN or eager loading
const getOrdersWithCustomers = async () => {
  return db.query(`
    SELECT
      orders.*,
      customers.name as customer_name,
      customers.email as customer_email
    FROM orders
    JOIN customers ON orders.customer_id = customers.id
  `);
};

// ✅ Using ORM with eager loading
const getOrdersWithCustomers = async () => {
  return orderRepository.find({
    relations: ['customer']
  });
};
```

### Query Optimization

```typescript
// ❌ Fetching unnecessary data
const getUserEmail = async (userId: string) => {
  const user = await db.query('SELECT * FROM users WHERE id = ?', [userId]);
  return user.email;
};

// ✅ Select only needed columns
const getUserEmail = async (userId: string) => {
  const result = await db.query('SELECT email FROM users WHERE id = ?', [userId]);
  return result.email;
};

// ❌ Multiple queries
const getOrderSummary = async (orderId: string) => {
  const order = await db.query('SELECT * FROM orders WHERE id = ?', [orderId]);
  const itemCount = await db.query('SELECT COUNT(*) FROM order_items WHERE order_id = ?', [orderId]);
  const total = await db.query('SELECT SUM(price * quantity) FROM order_items WHERE order_id = ?', [orderId]);

  return { order, itemCount, total };
};

// ✅ Single optimized query
const getOrderSummary = async (orderId: string) => {
  return db.query(`
    SELECT
      o.*,
      COUNT(oi.id) as item_count,
      SUM(oi.price * oi.quantity) as total
    FROM orders o
    LEFT JOIN order_items oi ON o.id = oi.order_id
    WHERE o.id = ?
    GROUP BY o.id
  `, [orderId]);
};
```

### Indexing

```sql
-- ❌ No index on frequently queried column
SELECT * FROM users WHERE email = 'user@example.com'; -- Full table scan

-- ✅ Add index
CREATE INDEX idx_users_email ON users(email);

-- ✅ Composite index for multiple columns
CREATE INDEX idx_orders_user_status ON orders(user_id, status);

-- Query using composite index
SELECT * FROM orders WHERE user_id = 123 AND status = 'pending';

-- ✅ Partial index for specific conditions
CREATE INDEX idx_active_users ON users(email) WHERE active = true;
```

### Database Connection Pooling

```typescript
// ❌ Creating new connection for each query
const getUser = async (id: string) => {
  const connection = await createConnection(); // Expensive!
  const user = await connection.query('SELECT * FROM users WHERE id = ?', [id]);
  await connection.close();
  return user;
};

// ✅ Use connection pool
import { Pool } from 'pg';

const pool = new Pool({
  host: 'localhost',
  database: 'mydb',
  max: 20,        // Maximum connections
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
});

const getUser = async (id: string) => {
  const client = await pool.connect();
  try {
    const result = await client.query('SELECT * FROM users WHERE id = $1', [id]);
    return result.rows[0];
  } finally {
    client.release(); // Return to pool
  }
};
```

## Caching Strategies

### In-Memory Caching

```typescript
// Simple in-memory cache
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

  clear(): void {
    this.cache.clear();
  }
}

// Usage
const userCache = new Cache<User>();

const getUser = async (id: string): Promise<User> => {
  const cached = userCache.get(id);
  if (cached) return cached;

  const user = await db.findUser(id);
  userCache.set(id, user, 300000); // 5 minutes

  return user;
};
```

### HTTP Caching

```typescript
import express from 'express';

// Cache-Control headers
app.get('/api/products', (req, res) => {
  res.set('Cache-Control', 'public, max-age=300'); // Cache for 5 minutes

  const products = getProducts();
  res.json(products);
});

// ETag caching
app.get('/api/user/:id', async (req, res) => {
  const user = await getUser(req.params.id);

  const etag = generateETag(user); // Hash of user data
  res.set('ETag', etag);

  // Check if client has current version
  if (req.headers['if-none-match'] === etag) {
    return res.status(304).end(); // Not Modified
  }

  res.json(user);
});

// Last-Modified caching
app.get('/api/posts/:id', async (req, res) => {
  const post = await getPost(req.params.id);

  res.set('Last-Modified', post.updatedAt.toUTCString());

  const ifModifiedSince = req.headers['if-modified-since'];
  if (ifModifiedSince && new Date(ifModifiedSince) >= post.updatedAt) {
    return res.status(304).end();
  }

  res.json(post);
});
```

### Redis Caching

```typescript
import Redis from 'ioredis';

const redis = new Redis();

const getCachedUser = async (id: string): Promise<User | null> => {
  const cached = await redis.get(`user:${id}`);
  if (cached) {
    return JSON.parse(cached);
  }

  const user = await db.findUser(id);

  // Cache for 5 minutes
  await redis.setex(`user:${id}`, 300, JSON.stringify(user));

  return user;
};

// Cache invalidation
const updateUser = async (id: string, data: Partial<User>) => {
  const user = await db.updateUser(id, data);

  // Invalidate cache
  await redis.del(`user:${id}`);

  return user;
};

// Cache-aside pattern
const getProduct = async (id: string): Promise<Product> => {
  // Try cache first
  const cached = await redis.get(`product:${id}`);
  if (cached) return JSON.parse(cached);

  // Cache miss: fetch from database
  const product = await db.findProduct(id);

  // Store in cache
  await redis.setex(`product:${id}`, 600, JSON.stringify(product));

  return product;
};
```

### Memoization

```typescript
// Function result caching
const memoize = <T extends (...args: any[]) => any>(fn: T): T => {
  const cache = new Map<string, ReturnType<T>>();

  return ((...args: any[]) => {
    const key = JSON.stringify(args);

    if (cache.has(key)) {
      return cache.get(key);
    }

    const result = fn(...args);
    cache.set(key, result);

    return result;
  }) as T;
};

// Usage
const expensiveCalculation = memoize((n: number): number => {
  console.log('Computing...');
  let result = 0;
  for (let i = 0; i < n * 1000000; i++) {
    result += i;
  }
  return result;
});

expensiveCalculation(100); // Computing... (takes time)
expensiveCalculation(100); // Instant (from cache)
```

## Algorithmic Optimization

### Choose Right Data Structure

```typescript
// ❌ Using array for lookups (O(n))
const users: User[] = [];
const findUser = (id: string) => users.find(u => u.id === id); // Slow for large arrays

// ✅ Use Map for O(1) lookups
const users = new Map<string, User>();
const findUser = (id: string) => users.get(id); // Fast

// ❌ Checking existence in array
const hasPermission = (userId: string, permission: string) => {
  const permissions = getUserPermissions(userId); // Returns string[]
  return permissions.includes(permission); // O(n)
};

// ✅ Use Set for O(1) membership checks
const hasPermission = (userId: string, permission: string) => {
  const permissions = getUserPermissions(userId); // Returns Set<string>
  return permissions.has(permission); // O(1)
};
```

### Reduce Complexity

```typescript
// ❌ Nested loops (O(n²))
const findDuplicates = (arr: number[]) => {
  const duplicates = [];
  for (let i = 0; i < arr.length; i++) {
    for (let j = i + 1; j < arr.length; j++) {
      if (arr[i] === arr[j] && !duplicates.includes(arr[i])) {
        duplicates.push(arr[i]);
      }
    }
  }
  return duplicates;
};

// ✅ Use Set (O(n))
const findDuplicates = (arr: number[]) => {
  const seen = new Set<number>();
  const duplicates = new Set<number>();

  for (const num of arr) {
    if (seen.has(num)) {
      duplicates.add(num);
    } else {
      seen.add(num);
    }
  }

  return Array.from(duplicates);
};
```

## Frontend Performance

### Lazy Loading

```typescript
// React lazy loading
import { lazy, Suspense } from 'react';

const HeavyComponent = lazy(() => import('./HeavyComponent'));

const App = () => (
  <Suspense fallback={<div>Loading...</div>}>
    <HeavyComponent />
  </Suspense>
);

// Image lazy loading
<img src="image.jpg" loading="lazy" alt="Description" />

// Route-based code splitting
const routes = [
  {
    path: '/dashboard',
    component: lazy(() => import('./pages/Dashboard'))
  },
  {
    path: '/profile',
    component: lazy(() => import('./pages/Profile'))
  }
];
```

### Debouncing and Throttling

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

// Usage: Search as user types
const searchUsers = debounce(async (query: string) => {
  const results = await api.searchUsers(query);
  updateUI(results);
}, 300);

input.addEventListener('input', (e) => {
  searchUsers(e.target.value);
});

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

// Usage: Scroll event
const handleScroll = throttle(() => {
  console.log('Scroll position:', window.scrollY);
}, 100);

window.addEventListener('scroll', handleScroll);
```

### Virtual Scrolling

```typescript
// Render only visible items
const VirtualList = ({ items, itemHeight }: Props) => {
  const [scrollTop, setScrollTop] = useState(0);
  const containerHeight = 600;

  const visibleStart = Math.floor(scrollTop / itemHeight);
  const visibleEnd = Math.ceil((scrollTop + containerHeight) / itemHeight);

  const visibleItems = items.slice(visibleStart, visibleEnd);

  return (
    <div
      style={{ height: containerHeight, overflow: 'auto' }}
      onScroll={(e) => setScrollTop(e.currentTarget.scrollTop)}
    >
      <div style={{ height: items.length * itemHeight, position: 'relative' }}>
        {visibleItems.map((item, index) => (
          <div
            key={visibleStart + index}
            style={{
              position: 'absolute',
              top: (visibleStart + index) * itemHeight,
              height: itemHeight
            }}
          >
            {item.content}
          </div>
        ))}
      </div>
    </div>
  );
};
```

## Asynchronous Optimization

### Parallel Execution

```typescript
// ❌ Sequential (slow)
const getUserData = async (userId: string) => {
  const user = await fetchUser(userId);           // 100ms
  const posts = await fetchPosts(userId);         // 150ms
  const comments = await fetchComments(userId);   // 120ms

  return { user, posts, comments }; // Total: 370ms
};

// ✅ Parallel (fast)
const getUserData = async (userId: string) => {
  const [user, posts, comments] = await Promise.all([
    fetchUser(userId),
    fetchPosts(userId),
    fetchComments(userId)
  ]);

  return { user, posts, comments }; // Total: 150ms (longest operation)
};

// ✅ Partial parallel with dependencies
const getOrderDetails = async (orderId: string) => {
  const order = await fetchOrder(orderId); // Must fetch first

  const [customer, items, shipping] = await Promise.all([
    fetchCustomer(order.customerId),
    fetchOrderItems(orderId),
    fetchShippingInfo(orderId)
  ]);

  return { order, customer, items, shipping };
};
```

### Batch Processing

```typescript
// ❌ Processing one at a time
const processUsers = async (userIds: string[]) => {
  for (const id of userIds) {
    await updateUser(id); // Slow for large lists
  }
};

// ✅ Batch processing
const processUsers = async (userIds: string[]) => {
  const BATCH_SIZE = 50;

  for (let i = 0; i < userIds.length; i += BATCH_SIZE) {
    const batch = userIds.slice(i, i + BATCH_SIZE);

    await Promise.all(
      batch.map(id => updateUser(id))
    );
  }
};

// ✅ Bulk database operations
const createUsers = async (users: User[]) => {
  // Instead of individual INSERTs
  await db.query(`
    INSERT INTO users (name, email)
    VALUES ${users.map(() => '(?, ?)').join(', ')}
  `, users.flatMap(u => [u.name, u.email]));
};
```

## Resource Optimization

### Memory Management

```typescript
// ❌ Memory leak: Event listeners not removed
class Component {
  constructor() {
    window.addEventListener('resize', this.handleResize);
  }

  handleResize = () => {
    // ...
  };

  // Component destroyed but listener remains!
}

// ✅ Clean up resources
class Component {
  constructor() {
    window.addEventListener('resize', this.handleResize);
  }

  handleResize = () => {
    // ...
  };

  destroy() {
    window.removeEventListener('resize', this.handleResize);
  }
}

// ✅ Process large files in streams
import { createReadStream } from 'fs';
import { createInterface } from 'readline';

const processLargeFile = async (filePath: string) => {
  const fileStream = createReadStream(filePath);
  const rl = createInterface({
    input: fileStream,
    crlfDelay: Infinity
  });

  for await (const line of rl) {
    processLine(line); // Process one line at a time
  }
};
```

### Compression

```typescript
import compression from 'compression';
import express from 'express';

const app = express();

// Enable gzip compression
app.use(compression({
  filter: (req, res) => {
    if (req.headers['x-no-compression']) {
      return false;
    }
    return compression.filter(req, res);
  },
  level: 6 // Compression level (0-9)
}));

// Compress specific responses
app.get('/api/large-data', (req, res) => {
  const data = getLargeDataset();

  res.set('Content-Type', 'application/json');
  res.set('Content-Encoding', 'gzip');

  res.json(data); // Automatically compressed
});
```

## Monitoring and Metrics

### Performance Metrics

```typescript
// Track key metrics
class PerformanceMonitor {
  private metrics = new Map<string, number[]>();

  recordLatency(operation: string, durationMs: number): void {
    if (!this.metrics.has(operation)) {
      this.metrics.set(operation, []);
    }
    this.metrics.get(operation)!.push(durationMs);
  }

  getStats(operation: string) {
    const values = this.metrics.get(operation) || [];
    const sorted = values.sort((a, b) => a - b);

    return {
      count: values.length,
      mean: values.reduce((a, b) => a + b, 0) / values.length,
      p50: sorted[Math.floor(sorted.length * 0.5)],
      p95: sorted[Math.floor(sorted.length * 0.95)],
      p99: sorted[Math.floor(sorted.length * 0.99)],
      max: sorted[sorted.length - 1]
    };
  }
}

// Usage
const monitor = new PerformanceMonitor();

const withMonitoring = async <T>(operation: string, fn: () => Promise<T>): Promise<T> => {
  const start = Date.now();
  try {
    return await fn();
  } finally {
    monitor.recordLatency(operation, Date.now() - start);
  }
};

// Track performance
await withMonitoring('getUserData', () => getUserData('123'));

// View stats
console.log(monitor.getStats('getUserData'));
// { count: 1000, mean: 45, p50: 42, p95: 78, p99: 120, max: 250 }
```

## Anti-Patterns

### ❌ Premature Optimization

```typescript
// Don't optimize before measuring
// "Premature optimization is the root of all evil" - Donald Knuth

// Write clear code first
const sum = (numbers: number[]) => numbers.reduce((a, b) => a + b, 0);

// Only optimize if proven to be a bottleneck
```

### ❌ Over-Caching

```typescript
// Caching everything wastes memory
cache.set('trivial-calculation', 2 + 2); // Don't cache simple operations
```

### ❌ Ignoring Cache Invalidation

```typescript
// Stale data from never-expiring cache
cache.set('user-data', user); // No TTL, no invalidation strategy
```

## References

- [Web Performance](https://web.dev/performance/)
- [Node.js Performance Best Practices](https://nodejs.org/en/docs/guides/simple-profiling/)
- [Database Indexing](https://use-the-index-luke.com/)
- [Chrome DevTools Performance](https://developer.chrome.com/docs/devtools/performance/)
