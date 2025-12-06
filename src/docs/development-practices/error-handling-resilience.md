# Error Handling & Resilience Patterns

## Error Handling Best Practices

### Use Custom Error Classes

```typescript
// ❌ Generic errors
throw new Error('User not found');
throw new Error('Invalid input');

// ✅ Custom error hierarchy
class AppError extends Error {
  constructor(
    message: string,
    public statusCode: number = 500,
    public code: string = 'INTERNAL_ERROR',
    public details?: unknown
  ) {
    super(message);
    this.name = this.constructor.name;
    Error.captureStackTrace(this, this.constructor);
  }
}

class NotFoundError extends AppError {
  constructor(resource: string, id: string) {
    super(`${resource} with id ${id} not found`, 404, 'NOT_FOUND', { resource, id });
  }
}

class ValidationError extends AppError {
  constructor(message: string, details: unknown) {
    super(message, 400, 'VALIDATION_ERROR', details);
  }
}

class UnauthorizedError extends AppError {
  constructor(message: string = 'Unauthorized') {
    super(message, 401, 'UNAUTHORIZED');
  }
}

// Usage
const getUser = async (id: string) => {
  const user = await db.findUser(id);
  if (!user) {
    throw new NotFoundError('User', id);
  }
  return user;
};
```

### Centralized Error Handling

```typescript
// Express error handler
app.use((err: Error, req: Request, res: Response, next: NextFunction) => {
  if (err instanceof AppError) {
    return res.status(err.statusCode).json({
      error: {
        message: err.message,
        code: err.code,
        details: err.details
      }
    });
  }

  // Unexpected errors
  console.error('Unexpected error:', err);

  res.status(500).json({
    error: {
      message: 'Internal server error',
      code: 'INTERNAL_ERROR'
    }
  });
});

// Async error wrapper
const asyncHandler = (fn: RequestHandler) => {
  return (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
};

// Usage
app.get('/users/:id', asyncHandler(async (req, res) => {
  const user = await getUser(req.params.id); // Errors automatically caught
  res.json(user);
}));
```

### Result Type Pattern

```typescript
// Instead of throwing, return Result type
type Result<T, E = Error> =
  | { success: true; value: T }
  | { success: false; error: E };

const parseJSON = <T>(json: string): Result<T, string> => {
  try {
    const value = JSON.parse(json);
    return { success: true, value };
  } catch (error) {
    return { success: false, error: 'Invalid JSON' };
  }
};

// Usage
const result = parseJSON<User>(userJson);

if (result.success) {
  console.log('User:', result.value);
} else {
  console.error('Error:', result.error);
}

// Chainable Result
class Result<T, E> {
  private constructor(
    private readonly _success: boolean,
    private readonly _value?: T,
    private readonly _error?: E
  ) {}

  static ok<T, E>(value: T): Result<T, E> {
    return new Result(true, value);
  }

  static err<T, E>(error: E): Result<T, E> {
    return new Result(false, undefined, error);
  }

  isOk(): boolean {
    return this._success;
  }

  isErr(): boolean {
    return !this._success;
  }

  map<U>(fn: (value: T) => U): Result<U, E> {
    if (this._success) {
      return Result.ok(fn(this._value!));
    }
    return Result.err(this._error!);
  }

  flatMap<U>(fn: (value: T) => Result<U, E>): Result<U, E> {
    if (this._success) {
      return fn(this._value!);
    }
    return Result.err(this._error!);
  }

  unwrap(): T {
    if (!this._success) {
      throw new Error('Called unwrap on error result');
    }
    return this._value!;
  }

  unwrapOr(defaultValue: T): T {
    return this._success ? this._value! : defaultValue;
  }
}
```

## Circuit Breaker Pattern

### Basic Implementation

```typescript
enum CircuitState {
  CLOSED = 'CLOSED',     // Normal operation
  OPEN = 'OPEN',         // Failing, reject calls immediately
  HALF_OPEN = 'HALF_OPEN' // Testing if service recovered
}

class CircuitBreaker {
  private state: CircuitState = CircuitState.CLOSED;
  private failureCount = 0;
  private successCount = 0;
  private nextAttempt: number = Date.now();

  constructor(
    private readonly threshold: number = 5,        // Failures to trip
    private readonly timeout: number = 60000,       // Time before retry (ms)
    private readonly monitoringPeriod: number = 10000 // Reset period (ms)
  ) {}

  async execute<T>(operation: () => Promise<T>): Promise<T> {
    if (this.state === CircuitState.OPEN) {
      if (Date.now() < this.nextAttempt) {
        throw new Error('Circuit breaker is OPEN');
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

  private onSuccess(): void {
    this.failureCount = 0;

    if (this.state === CircuitState.HALF_OPEN) {
      this.state = CircuitState.CLOSED;
      this.successCount = 0;
    }
  }

  private onFailure(): void {
    this.failureCount++;
    this.successCount = 0;

    if (this.failureCount >= this.threshold) {
      this.state = CircuitState.OPEN;
      this.nextAttempt = Date.now() + this.timeout;
    }
  }

  getState(): CircuitState {
    return this.state;
  }
}

// Usage
const paymentBreaker = new CircuitBreaker(5, 60000);

const processPayment = async (amount: number) => {
  try {
    return await paymentBreaker.execute(() =>
      paymentService.charge(amount)
    );
  } catch (error) {
    if (error.message === 'Circuit breaker is OPEN') {
      // Use fallback or queue for later
      return await queuePayment(amount);
    }
    throw error;
  }
};
```

### Advanced Circuit Breaker

```typescript
interface CircuitBreakerOptions {
  failureThreshold: number;
  successThreshold: number;
  timeout: number;
  onStateChange?: (state: CircuitState) => void;
}

class AdvancedCircuitBreaker {
  private state: CircuitState = CircuitState.CLOSED;
  private failures: number[] = [];
  private successes = 0;
  private nextAttempt = 0;

  constructor(private options: CircuitBreakerOptions) {}

  async call<T>(fn: () => Promise<T>): Promise<T> {
    if (this.state === CircuitState.OPEN) {
      if (Date.now() < this.nextAttempt) {
        throw new Error('Circuit breaker OPEN');
      }
      this.transitionTo(CircuitState.HALF_OPEN);
    }

    try {
      const result = await fn();
      this.onSuccess();
      return result;
    } catch (error) {
      this.onFailure(error);
      throw error;
    }
  }

  private onSuccess(): void {
    this.failures = [];

    if (this.state === CircuitState.HALF_OPEN) {
      this.successes++;
      if (this.successes >= this.options.successThreshold) {
        this.transitionTo(CircuitState.CLOSED);
        this.successes = 0;
      }
    }
  }

  private onFailure(error: Error): void {
    this.successes = 0;
    this.failures.push(Date.now());

    // Remove old failures outside window
    const windowStart = Date.now() - 10000;
    this.failures = this.failures.filter(t => t > windowStart);

    if (this.failures.length >= this.options.failureThreshold) {
      this.transitionTo(CircuitState.OPEN);
      this.nextAttempt = Date.now() + this.options.timeout;
    }
  }

  private transitionTo(newState: CircuitState): void {
    const oldState = this.state;
    this.state = newState;

    if (this.options.onStateChange) {
      this.options.onStateChange(newState);
    }

    console.log(`Circuit breaker: ${oldState} → ${newState}`);
  }
}
```

## Retry Pattern

### Exponential Backoff

```typescript
interface RetryOptions {
  maxAttempts: number;
  initialDelay: number;
  maxDelay: number;
  backoffMultiplier: number;
  retryableErrors?: (error: Error) => boolean;
}

const retry = async <T>(
  operation: () => Promise<T>,
  options: RetryOptions
): Promise<T> => {
  let lastError: Error;
  let delay = options.initialDelay;

  for (let attempt = 1; attempt <= options.maxAttempts; attempt++) {
    try {
      return await operation();
    } catch (error) {
      lastError = error as Error;

      // Check if error is retryable
      if (options.retryableErrors && !options.retryableErrors(lastError)) {
        throw lastError;
      }

      if (attempt === options.maxAttempts) {
        throw lastError;
      }

      console.log(`Attempt ${attempt} failed, retrying in ${delay}ms...`);

      await sleep(delay);

      // Exponential backoff
      delay = Math.min(delay * options.backoffMultiplier, options.maxDelay);
    }
  }

  throw lastError!;
};

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

// Usage
const fetchData = async (url: string) => {
  return retry(
    () => fetch(url).then(r => r.json()),
    {
      maxAttempts: 3,
      initialDelay: 1000,
      maxDelay: 10000,
      backoffMultiplier: 2,
      retryableErrors: (error) => {
        // Retry on network errors, not on 4xx client errors
        return error.message.includes('network') ||
               error.message.includes('timeout');
      }
    }
  );
};
```

### Retry with Jitter

```typescript
// Adds randomness to prevent thundering herd
const retryWithJitter = async <T>(
  operation: () => Promise<T>,
  maxAttempts: number = 3
): Promise<T> => {
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await operation();
    } catch (error) {
      if (attempt === maxAttempts) throw error;

      const baseDelay = Math.pow(2, attempt) * 1000;
      const jitter = Math.random() * 1000;
      const delay = baseDelay + jitter;

      console.log(`Retry ${attempt}/${maxAttempts} after ${delay}ms`);
      await sleep(delay);
    }
  }

  throw new Error('Max retries exceeded');
};
```

## Timeout Pattern

### Request Timeout

```typescript
const withTimeout = <T>(
  promise: Promise<T>,
  timeoutMs: number,
  errorMessage: string = 'Operation timed out'
): Promise<T> => {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) =>
      setTimeout(() => reject(new Error(errorMessage)), timeoutMs)
    )
  ]);
};

// Usage
const fetchUserWithTimeout = async (id: string) => {
  return withTimeout(
    fetchUser(id),
    5000,
    'User fetch timed out after 5 seconds'
  );
};

// With AbortController (modern approach)
const fetchWithTimeout = async (url: string, timeoutMs: number) => {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(url, { signal: controller.signal });
    return await response.json();
  } finally {
    clearTimeout(timeout);
  }
};
```

## Bulkhead Pattern

### Isolate Resources

```typescript
// Prevent one failing operation from exhausting all resources
class Bulkhead {
  private activeRequests = 0;

  constructor(private readonly maxConcurrent: number) {}

  async execute<T>(operation: () => Promise<T>): Promise<T> {
    if (this.activeRequests >= this.maxConcurrent) {
      throw new Error('Bulkhead limit reached');
    }

    this.activeRequests++;

    try {
      return await operation();
    } finally {
      this.activeRequests--;
    }
  }

  getActiveCount(): number {
    return this.activeRequests;
  }
}

// Usage: Separate bulkheads for different services
const paymentBulkhead = new Bulkhead(5);
const emailBulkhead = new Bulkhead(10);

const processPayment = async (amount: number) => {
  return paymentBulkhead.execute(() => paymentService.charge(amount));
};

const sendEmail = async (to: string, content: string) => {
  return emailBulkhead.execute(() => emailService.send(to, content));
};
```

### Queue-Based Bulkhead

```typescript
class QueuedBulkhead<T> {
  private queue: Array<{
    operation: () => Promise<T>;
    resolve: (value: T) => void;
    reject: (error: Error) => void;
  }> = [];
  private activeCount = 0;

  constructor(private readonly maxConcurrent: number) {}

  async execute(operation: () => Promise<T>): Promise<T> {
    return new Promise((resolve, reject) => {
      this.queue.push({ operation, resolve, reject });
      this.processQueue();
    });
  }

  private async processQueue(): Promise<void> {
    if (this.activeCount >= this.maxConcurrent || this.queue.length === 0) {
      return;
    }

    const { operation, resolve, reject } = this.queue.shift()!;
    this.activeCount++;

    try {
      const result = await operation();
      resolve(result);
    } catch (error) {
      reject(error as Error);
    } finally {
      this.activeCount--;
      this.processQueue();
    }
  }
}
```

## Graceful Degradation

### Fallback Strategies

```typescript
// Fallback to cache when service unavailable
const getUserProfile = async (userId: string): Promise<UserProfile> => {
  try {
    return await userService.getProfile(userId);
  } catch (error) {
    console.warn('User service unavailable, using cached data');

    const cached = await cache.get(`profile:${userId}`);
    if (cached) {
      return { ...cached, stale: true };
    }

    // Last resort: return minimal profile
    return {
      id: userId,
      name: 'User',
      stale: true,
      limited: true
    };
  }
};

// Feature degradation
const search = async (query: string): Promise<SearchResults> => {
  try {
    // Try advanced search with ML ranking
    return await advancedSearch(query);
  } catch (error) {
    console.warn('Advanced search failed, falling back to basic search');

    try {
      // Fallback to basic database search
      return await basicSearch(query);
    } catch (error) {
      // Last resort: cached popular results
      return await getCachedPopularResults();
    }
  }
};
```

### Partial Responses

```typescript
// Return partial data instead of complete failure
const getDashboardData = async (userId: string) => {
  const [userResult, ordersResult, statsResult] = await Promise.allSettled([
    getUserData(userId),
    getOrders(userId),
    getStatistics(userId)
  ]);

  return {
    user: userResult.status === 'fulfilled' ? userResult.value : null,
    orders: ordersResult.status === 'fulfilled' ? ordersResult.value : [],
    stats: statsResult.status === 'fulfilled' ? statsResult.value : null,
    errors: {
      user: userResult.status === 'rejected' ? userResult.reason.message : null,
      orders: ordersResult.status === 'rejected' ? ordersResult.reason.message : null,
      stats: statsResult.status === 'rejected' ? statsResult.reason.message : null
    }
  };
};
```

## Health Checks

### Service Health

```typescript
interface HealthCheck {
  status: 'healthy' | 'degraded' | 'unhealthy';
  checks: Record<string, {
    status: 'pass' | 'fail';
    latency?: number;
    error?: string;
  }>;
}

const checkHealth = async (): Promise<HealthCheck> => {
  const checks = await Promise.allSettled([
    checkDatabase(),
    checkRedis(),
    checkExternalAPI()
  ]);

  const results = {
    database: checks[0],
    redis: checks[1],
    externalAPI: checks[2]
  };

  const failedChecks = Object.values(results).filter(r => r.status === 'rejected').length;

  return {
    status: failedChecks === 0 ? 'healthy' :
            failedChecks < Object.keys(results).length ? 'degraded' :
            'unhealthy',
    checks: {
      database: results.database.status === 'fulfilled'
        ? { status: 'pass', latency: results.database.value }
        : { status: 'fail', error: results.database.reason.message },
      redis: results.redis.status === 'fulfilled'
        ? { status: 'pass', latency: results.redis.value }
        : { status: 'fail', error: results.redis.reason.message },
      externalAPI: results.externalAPI.status === 'fulfilled'
        ? { status: 'pass', latency: results.externalAPI.value }
        : { status: 'fail', error: results.externalAPI.reason.message }
    }
  };
};

const checkDatabase = async (): Promise<number> => {
  const start = Date.now();
  await db.query('SELECT 1');
  return Date.now() - start;
};
```

## Combining Resilience Patterns

```typescript
class ResilientService {
  private circuitBreaker: CircuitBreaker;
  private bulkhead: Bulkhead;

  constructor(
    private readonly serviceName: string,
    private readonly baseService: any
  ) {
    this.circuitBreaker = new CircuitBreaker(5, 60000);
    this.bulkhead = new Bulkhead(10);
  }

  async call<T>(operation: () => Promise<T>): Promise<T> {
    // Combine: Bulkhead → Circuit Breaker → Timeout → Retry
    return this.bulkhead.execute(() =>
      this.circuitBreaker.execute(() =>
        withTimeout(
          retry(operation, {
            maxAttempts: 3,
            initialDelay: 1000,
            maxDelay: 5000,
            backoffMultiplier: 2
          }),
          10000
        )
      )
    );
  }
}

// Usage
const paymentService = new ResilientService('payment', basePaymentService);

const processPayment = async (amount: number) => {
  try {
    return await paymentService.call(() =>
      basePaymentService.charge(amount)
    );
  } catch (error) {
    // All resilience patterns exhausted, use fallback
    return await queuePaymentForLater(amount);
  }
};
```

## Anti-Patterns

### ❌ Swallowing Errors

```typescript
// ❌ Silent failure
try {
  await criticalOperation();
} catch (error) {
  // Error ignored - dangerous!
}

// ✅ Log and handle appropriately
try {
  await criticalOperation();
} catch (error) {
  logger.error('Critical operation failed', { error });
  metrics.increment('critical_operation_failure');
  throw error; // Or handle gracefully
}
```

### ❌ Generic Error Messages

```typescript
// ❌ Not actionable
throw new Error('Something went wrong');

// ✅ Specific and actionable
throw new ValidationError('Email must be a valid email address', {
  field: 'email',
  value: userInput.email
});
```

### ❌ Infinite Retries

```typescript
// ❌ Never give up
while (true) {
  try {
    await operation();
    break;
  } catch (error) {
    // Retry forever - will exhaust resources
  }
}

// ✅ Maximum retry limit
const maxRetries = 3;
for (let i = 0; i < maxRetries; i++) {
  try {
    await operation();
    break;
  } catch (error) {
    if (i === maxRetries - 1) throw error;
  }
}
```

## References

- [Circuit Breaker](https://martinfowler.com/bliki/CircuitBreaker.html)
- [Release It! - Design Patterns for Resilience](https://pragprog.com/titles/mnee2/release-it-second-edition/)
- [Retry Pattern](https://docs.microsoft.com/en-us/azure/architecture/patterns/retry)
- [Bulkhead Pattern](https://docs.microsoft.com/en-us/azure/architecture/patterns/bulkhead)
