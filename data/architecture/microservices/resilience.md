# Microservices Resilience

## Circuit Breaker Pattern

```typescript
enum CircuitState {
  CLOSED = 'CLOSED',     // Normal operation
  OPEN = 'OPEN',         // Failing, reject calls
  HALF_OPEN = 'HALF_OPEN' // Testing recovery
}

class CircuitBreaker {
  private state = CircuitState.CLOSED;
  private failures = 0;
  private nextRetry = 0;

  async execute<T>(operation: () => Promise<T>): Promise<T> {
    if (this.state === CircuitState.OPEN) {
      if (Date.now() < this.nextRetry) {
        throw new Error('Circuit breaker OPEN');
      }
      this.state = CircuitState.HALF_OPEN;
    }

    try {
      const result = await operation();
      this.onSuccess();
      return result;
    } catch (error) {
      this.onFailure();
      throw error;
    }
  }

  private onSuccess() {
    this.failures = 0;
    this.state = CircuitState.CLOSED;
  }

  private onFailure() {
    this.failures++;
    if (this.failures >= 5) {
      this.state = CircuitState.OPEN;
      this.nextRetry = Date.now() + 60000;
    }
  }
}
```

## Retry with Exponential Backoff

```typescript
async function retry<T>(
  operation: () => Promise<T>,
  maxAttempts: number = 3,
  baseDelay: number = 1000
): Promise<T> {
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await operation();
    } catch (error) {
      if (attempt === maxAttempts) throw error;

      const delay = baseDelay * Math.pow(2, attempt - 1);
      const jitter = Math.random() * 1000;
      await sleep(delay + jitter);
    }
  }
  throw new Error('Max retries exceeded');
}
```

## Bulkhead Pattern

```typescript
// Isolate resources to prevent cascading failures
class Bulkhead {
  private active = 0;

  constructor(private maxConcurrent: number) {}

  async execute<T>(operation: () => Promise<T>): Promise<T> {
    if (this.active >= this.maxConcurrent) {
      throw new Error('Bulkhead limit reached');
    }

    this.active++;
    try {
      return await operation();
    } finally {
      this.active--;
    }
  }
}

// Separate bulkheads per dependency
const paymentBulkhead = new Bulkhead(5);
const emailBulkhead = new Bulkhead(10);
```

## Timeouts

```typescript
async function withTimeout<T>(
  promise: Promise<T>,
  timeoutMs: number
): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) =>
      setTimeout(() => reject(new Error('Timeout')), timeoutMs)
    )
  ]);
}

// Always set timeouts for external calls
const user = await withTimeout(userService.getUser(id), 5000);
```

## Graceful Degradation

```typescript
async function getProductRecommendations(userId: string) {
  try {
    return await recommendationService.getPersonalized(userId);
  } catch (error) {
    // Fallback to cached popular items
    console.warn('Recommendation service unavailable');
    return await getPopularProducts();
  }
}

// Partial responses instead of complete failure
async function getDashboard(userId: string) {
  const [user, orders, stats] = await Promise.allSettled([
    getUser(userId),
    getOrders(userId),
    getStats(userId)
  ]);

  return {
    user: user.status === 'fulfilled' ? user.value : null,
    orders: orders.status === 'fulfilled' ? orders.value : [],
    stats: stats.status === 'fulfilled' ? stats.value : null
  };
}
```

## Health Checks

```typescript
app.get('/health', async (req, res) => {
  const checks = await Promise.allSettled([
    checkDatabase(),
    checkRedis(),
    checkExternalAPI()
  ]);

  const healthy = checks.every(c => c.status === 'fulfilled');

  res.status(healthy ? 200 : 503).json({
    status: healthy ? 'healthy' : 'degraded',
    checks: {
      database: checks[0].status,
      redis: checks[1].status,
      externalAPI: checks[2].status
    }
  });
});
```
