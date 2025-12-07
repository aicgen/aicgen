# Serverless Architecture

## Overview

Serverless architecture is a cloud computing execution model where cloud providers dynamically manage server infrastructure allocation and scaling. Despite the name, servers still exist—the distinction is that organizations don't manage them.

**Core Philosophy:** Focus on business logic while delegating infrastructure management to cloud providers.

## Definitions

### Backend as a Service (BaaS)

Third-party cloud-hosted applications and services that manage server-side logic and state, eliminating the need to build and maintain backend infrastructure.

**Common Service Categories:**
- **Authentication & Authorization**: User management, OAuth, SSO
- **Databases**: Managed NoSQL/SQL with client SDKs
- **Storage**: Object storage, CDN, media processing
- **Analytics & Monitoring**: Application insights, user behavior tracking
- **Messaging**: Push notifications, email, SMS

**Architecture Pattern:**
- Rich clients (SPAs, mobile apps) communicate directly with cloud services
- Client-side logic handles routing and UI state
- Server-side business rules enforced through service configuration

### Functions as a Service (FaaS)

Developer-written code that runs in stateless, event-triggered, ephemeral containers fully managed by cloud vendors.

**Key Characteristics:**
- **Event-Driven**: Triggered by HTTP requests, database changes, file uploads, scheduled events, message queues
- **Automatic Scaling**: Platform handles scaling from zero to thousands of concurrent executions
- **Stateless Compute**: Each invocation is independent; no guaranteed state persistence
- **Pay-Per-Execution**: Billing based on actual compute time and memory used

---

## Core Principles

### 1. Statelessness

**Constraint:** Functions cannot reliably persist local state between invocations. Container lifecycles are managed by the platform.

❌ **Anti-pattern (In-Memory State):**
```typescript
// Don't rely on in-memory cache persisting
let cache: Map<string, any> = new Map();

export const handler = async (event) => {
  // Cache may be empty due to cold start or container recycling
  if (!cache.has(event.key)) {
    cache.set(event.key, await fetchData(event.key));
  }
  return cache.get(event.key);
};
```

✅ **Correct (Externalized State):**
```typescript
// Use external state store (Redis, DynamoDB, etc.)
export const handler = async (event) => {
  const cached = await stateStore.get(event.key);

  if (!cached) {
    const data = await fetchData(event.key);
    await stateStore.set(event.key, data, { ttl: 3600 });
    return data;
  }

  return cached;
};
```

**State Storage Options:**
- **Caching**: Redis, Memcached
- **Databases**: DynamoDB, Firestore, PostgreSQL
- **Object Storage**: S3, Cloud Storage
- **Session Management**: Managed session services

### 2. Execution Time Limits

All FaaS platforms impose maximum execution time limits (typically ranging from seconds to minutes).

**Implications:**
- Long-running batch jobs require chunking or alternative approaches
- Video/media processing may need orchestration across multiple functions
- Background jobs should be split into smaller units

**Strategies for Long Operations:**
```typescript
// Use orchestration (Step Functions, Workflows)
// 1. Break into smaller steps
// 2. Chain functions via messages
// 3. Store intermediate state externally
// 4. Use dedicated batch processing services for truly long tasks

// Example: Processing large dataset
export const processChunk = async (event) => {
  const { batchId, offset, limit } = event;

  const records = await fetchRecords(offset, limit);
  await processRecords(records);

  // Trigger next chunk if more data exists
  if (records.length === limit) {
    await queue.send({ batchId, offset: offset + limit, limit });
  }
};
```

### 3. Cold Starts

**Definition:** Initialization delay when creating a new function container.

**Factors Affecting Cold Start Performance:**
- Language runtime characteristics
- Package size and dependency count
- Network configuration (VPC adds latency)
- Memory allocation settings
- Platform optimizations

**Mitigation Strategies:**

```typescript
// 1. Minimize dependencies
// Instead of importing entire SDK
import AWS from 'aws-sdk'; // ❌ Large bundle

// Import only what's needed
import { DynamoDB } from '@aws-sdk/client-dynamodb'; // ✅ Smaller

// 2. Initialize outside handler (reused across warm invocations)
const db = new Database(config); // Initialize once

export const handler = async (event) => {
  // Use initialized client
  return db.query(event.query);
};

// 3. Lazy load heavy dependencies
let heavyLib: any;
export const handler = async (event) => {
  if (event.requiresHeavyLib && !heavyLib) {
    heavyLib = await import('heavy-library');
  }
  // ...
};

// 4. Provisioned capacity (platform feature, costs extra)
// Pre-warmed containers always ready
```

**When Cold Starts Matter:**
- Synchronous user-facing APIs (latency-sensitive)
- Real-time data processing
- Infrequently called functions

**When Cold Starts Don't Matter:**
- Asynchronous background processing
- High-throughput services (containers stay warm)
- Scheduled batch jobs

### 4. API Gateway Pattern

HTTP requests typically route through an API gateway layer before reaching functions.

**API Gateway Responsibilities:**
- Route mapping and request routing
- Authentication and authorization
- Request validation
- Response transformation
- Rate limiting and throttling
- CORS configuration

❌ **Anti-pattern (Business Logic in Gateway):**
```yaml
# Complex transformation logic in configuration
requestTemplate: |
  {
    "action": #if($input.params('type') == 'premium')"priority"#else"standard"#end,
    "discount": #if($input.params('coupon')=="SAVE20")0.2#else0#end
  }
```

✅ **Correct (Simple Passthrough):**
```yaml
requestTemplate: |
  {
    "type": "$input.params('type')",
    "coupon": "$input.params('coupon')"
  }
```

```typescript
// Business logic in testable function code
export const handler = async (event) => {
  const action = event.type === 'premium' ? 'priority' : 'standard';
  const discount = event.coupon === 'SAVE20' ? 0.2 : 0;

  return processRequest(action, discount);
};
```

---

## Benefits

### Operational Benefits

**1. No Infrastructure Management**
- No server provisioning or capacity planning
- No OS patching or security updates
- No infrastructure monitoring or alerting
- Platform handles availability and fault tolerance

**2. Automatic Scaling**
```
Traditional: Manual scaling rules, pre-provisioned capacity
Serverless: Instant scaling from 0 to N concurrent executions

Example: API receives 10 req/sec → platform runs 10 function instances
          Spike to 1,000 req/sec → platform runs 1,000 instances (automatic)
          Back to 10 req/sec → platform scales down (automatic)
```

**3. Built-in High Availability**
- Functions deployed across multiple availability zones
- Platform handles failover and redundancy
- No manual disaster recovery configuration

### Economic Benefits

**1. Pay-Per-Use Pricing**
```
Traditional server: Pay for capacity regardless of utilization
Serverless: Pay only for actual execution time

Example scenarios:
- Occasional webhook: 100 calls/month → minimal cost
- Spiky traffic: Pay for peaks only, not constant high capacity
- Development/staging: Zero cost when not in use
```

**2. Fine-Grained Optimization**
```
Performance improvement = Cost reduction

Example: Optimize function from 500ms to 250ms execution
Result: 50% cost savings (direct correlation)
```

**3. No Over-Provisioning**
- Eliminates paying for idle capacity
- No "planning for peak" waste
- Cost scales linearly with usage

### Development Benefits

**1. Simplified Deployment**
- Package code as zip/container
- Deploy via CLI or CI/CD
- No complex orchestration required
- Built-in versioning and rollback

**2. Faster Experimentation**
```typescript
// Deploy new feature in minutes
export const handler = async (event) => {
  if (event.experimentGroup === 'beta') {
    return experimentalFeature(event);
  }
  return existingFeature(event);
};
```

**3. Microservices Without Orchestration**
- Each function is independently deployable
- No service discovery complexity
- Platform-managed routing

---

## Drawbacks & Limitations

### Vendor Lock-In

**Problem:** Each cloud provider has different APIs, deployment models, and service integrations.

```typescript
// AWS Lambda signature
export const handler = async (
  event: APIGatewayProxyEvent,
  context: Context
): Promise<APIGatewayProxyResult> => { /* ... */ };

// Azure Functions signature (different)
export default async function (
  context: Context,
  req: HttpRequest
): Promise<void> { /* ... */ };

// Google Cloud Functions signature (different)
export const handler = (req: Request, res: Response) => { /* ... */ };
```

**Migration Complexity:**
- Rewrite function signatures and event handling
- Update deployment configurations and tooling
- Migrate dependent services (databases, queues, auth)
- Retrain team on new platform

**Mitigation Strategy:**
```typescript
// Abstraction layer (adds complexity vs benefit trade-off)
interface UniversalEvent {
  body: any;
  headers: Record<string, string>;
  queryParams: Record<string, string>;
}

// Business logic (platform-agnostic)
async function processRequest(event: UniversalEvent) {
  // Core logic independent of platform
}

// Platform adapters
export const awsHandler = (event: AWSEvent) => {
  return processRequest(normalizeAWSEvent(event));
};

export const azureHandler = (context, req) => {
  return processRequest(normalizeAzureEvent(req));
};
```

### Security Concerns

**1. Expanded Attack Surface**
- Multiple third-party service integrations
- Client-to-service direct access (BaaS)
- IAM policy complexity
- Function proliferation

**2. IAM Misconfiguration Risk**
```typescript
// ❌ Overly permissive (common mistake)
{
  "Effect": "Allow",
  "Action": "*",
  "Resource": "*"
}

// ✅ Principle of least privilege
{
  "Effect": "Allow",
  "Action": ["s3:GetObject", "s3:PutObject"],
  "Resource": "arn:aws:s3:::my-bucket/uploads/*"
}
```

**3. Client-Side Security Challenges (BaaS)**
```typescript
// All validation must be in database rules, not client code
// Client code can be bypassed/modified

// ✅ Enforce security server-side (Firebase example)
// firestore.rules
rules_version = '2';
service cloud.firestore {
  match /users/{userId} {
    allow read: if request.auth != null;
    allow write: if request.auth.uid == userId
      && !request.resource.data.diff(resource.data).affectedKeys().hasAny(['role', 'permissions']);
  }
}
```

### Testing Complexity

**Challenge:** Integration testing with real cloud services.

**Unit Testing:** Works normally
```typescript
describe('calculateTotal', () => {
  it('should sum item prices', () => {
    const total = calculateTotal([{ price: 10 }, { price: 20 }]);
    expect(total).toBe(30);
  });
});
```

**Integration Testing:** Requires cloud environment
```typescript
// Option 1: Local emulators (limited fidelity)
// Option 2: Separate cloud account for testing (recommended)
// Option 3: Shared test environment (collision risks)

describe('orderFunction (integration)', () => {
  it('should persist order to database', async () => {
    // Requires real database or high-fidelity emulator
    const result = await handler(createOrderEvent);
    const order = await db.get(result.orderId);
    expect(order.status).toBe('created');

    // Cleanup required
    await db.delete(result.orderId);
  });
});
```

### Debugging Challenges

**Limited Debugging Capabilities:**
- No interactive debuggers in production
- Ephemeral containers make state inspection difficult
- Rely primarily on logging and distributed tracing
- Vendor tools vary in maturity

**Best Practice: Comprehensive Logging**
```typescript
// Structured logging with context
export const handler = async (event, context) => {
  logger.addContext({
    requestId: context.requestId,
    userId: event.userId
  });

  logger.info('Processing order', { itemCount: event.items.length });

  try {
    const result = await processOrder(event);
    logger.info('Order created', { orderId: result.id });
    return result;
  } catch (error) {
    logger.error('Order failed', { error, event });
    throw error;
  }
};
```

### Monitoring Complexity

**Challenges:**
- Distributed system observability
- Multiple services and function interactions
- Platform-provided metrics may be basic
- Requires distributed tracing infrastructure

**Essential Monitoring:**
- Execution duration and errors
- Cold start frequency
- Throttling and concurrency limits
- Cost per function
- Distributed request tracing

### Resource Limits

**Common Constraints:**
- Maximum execution time (function-level timeout)
- Memory allocation limits
- Concurrent execution limits (account-level)
- Package size limits
- Payload size limits (request/response)

**Self-Inflicted Issues:**
```
Example: Account concurrency limit = 1,000

Scenario:
- Production functions using 500 concurrent executions
- Load test generates 800 concurrent executions
- Result: Production throttled (500 + 800 > 1,000 limit)

Solution: Reserved capacity for critical functions
```

---

## Use Cases

### Ideal Scenarios

**1. Event-Driven Processing**
```typescript
// File upload triggers processing
export const handler = async (event: S3Event) => {
  const bucket = event.Records[0].s3.bucket.name;
  const key = event.Records[0].s3.object.key;

  const file = await s3.getObject({ Bucket: bucket, Key: key });
  const processed = await processFile(file.Body);

  await s3.putObject({
    Bucket: bucket,
    Key: `processed/${key}`,
    Body: processed
  });
};
```

**2. API Backends**
```typescript
// RESTful API with automatic scaling
export const getUsers = async (event) => {
  const users = await db.query('SELECT * FROM users');
  return {
    statusCode: 200,
    body: JSON.stringify({ data: users })
  };
};

export const createUser = async (event) => {
  const userData = JSON.parse(event.body);
  const user = await db.insert('users', userData);
  return {
    statusCode: 201,
    body: JSON.stringify({ data: user })
  };
};
```

**3. Scheduled Tasks**
```typescript
// Cron-triggered function
// Schedule: Every day at 2 AM
export const handler = async () => {
  // Cleanup expired sessions
  await db.delete('sessions', { expiresAt: { lt: new Date() } });

  // Send daily reports
  await emailService.sendDailyReport();
};
```

**4. Stream Processing**
```typescript
// Message queue triggers function
export const handler = async (event: SQSEvent) => {
  for (const record of event.Records) {
    const message = JSON.parse(record.body);
    await processMessage(message);
  }
};
```

**5. Webhooks**
```typescript
// Receive third-party webhooks
export const handler = async (event) => {
  const signature = event.headers['x-webhook-signature'];

  // Verify signature
  if (!verifySignature(event.body, signature)) {
    return { statusCode: 401, body: 'Invalid signature' };
  }

  const payload = JSON.parse(event.body);
  await handleWebhookEvent(payload);

  return { statusCode: 200, body: 'OK' };
};
```

### Anti-Patterns

**❌ Latency-Critical Real-Time Systems**
- Sub-100ms response requirements
- High-frequency trading
- Real-time gaming servers

**❌ Long-Running Batch Operations**
- Multi-hour video encoding
- Large-scale data migrations
- Complex scientific simulations

**❌ Stateful Applications**
- Applications requiring extensive in-memory caching
- Session-heavy applications
- WebSocket servers with persistent connections

**❌ Constant High-Volume Traffic**
- When traffic is consistently high, traditional servers may be more cost-effective
- Calculate cost comparison before committing

---

## Architectural Patterns

### 1. BaaS + FaaS Hybrid

```typescript
// Client: Direct database access (simple operations)
const products = await db.collection('products')
  .where('category', '==', 'electronics')
  .get();

// Client: Call function (complex business logic)
const searchResults = await functions.call('complexSearch', {
  query: 'wireless headphones',
  filters: { priceMax: 100, brand: ['Sony', 'Bose'] }
});

// Function: Complex server-side logic
export const complexSearch = async (data) => {
  // Use advanced search service
  // Apply business rules
  // Return processed results
};
```

### 2. Fan-Out Pattern

```typescript
// Single event triggers multiple functions

// Publisher
await eventBus.publish('order.created', { orderId, userId, items });

// Subscriber 1: Email notification
export const emailHandler = async (event) => {
  await emailService.sendConfirmation(event.userId);
};

// Subscriber 2: Analytics tracking
export const analyticsHandler = async (event) => {
  await analytics.trackPurchase(event);
};

// Subscriber 3: Inventory update
export const inventoryHandler = async (event) => {
  await inventory.decrementStock(event.items);
};
```

### 3. Orchestration Pattern

```typescript
// Workflow coordination across multiple functions
// Each step is a separate function

// Step 1: Validate
export const validateOrder = async (order) => {
  // Validation logic
  return { valid: true, order };
};

// Step 2: Process payment
export const processPayment = async (validatedOrder) => {
  const payment = await stripe.charge(validatedOrder.total);
  return { ...validatedOrder, paymentId: payment.id };
};

// Step 3: Create shipment
export const createShipment = async (paidOrder) => {
  const shipment = await shipping.create(paidOrder);
  return { ...paidOrder, trackingNumber: shipment.tracking };
};

// Workflow engine coordinates: validate → payment → shipment
```

### 4. Backend for Frontend (BFF)

```typescript
// Separate functions optimized for each client type

// Mobile API (minimal payload)
export const getMobileUserProfile = async (event) => {
  const user = await userService.get(event.userId);
  return {
    id: user.id,
    name: user.name,
    avatar: user.avatar.thumbnailUrl // Mobile-optimized
  };
};

// Web API (rich data)
export const getWebUserProfile = async (event) => {
  const [user, orders, preferences] = await Promise.all([
    userService.get(event.userId),
    orderService.getUserOrders(event.userId),
    preferenceService.get(event.userId)
  ]);

  return { user, orders, preferences }; // Comprehensive
};
```

---

## Best Practices

### Design Principles

**1. Single Responsibility**
```typescript
// ❌ God function doing everything
export const handler = async (event) => {
  // Validate, process payment, send email, update inventory...
};

// ✅ Focused functions
export const processPayment = async (event) => {
  // Only payment processing
};

export const sendConfirmation = async (event) => {
  // Only email sending
};
```

**2. Idempotency**
```typescript
// Functions should be safely retriable
export const handler = async (event) => {
  const requestId = event.requestId;

  // Check if already processed
  const existing = await db.get('processed_requests', requestId);
  if (existing) {
    return existing.result; // Return cached result
  }

  const result = await processRequest(event);

  // Store result with request ID
  await db.put('processed_requests', requestId, result);

  return result;
};
```

**3. Graceful Degradation**
```typescript
export const handler = async (event) => {
  try {
    const enhanced = await thirdPartyService.enrich(event.data);
    return processWithEnhancement(enhanced);
  } catch (error) {
    logger.warn('Enhancement failed, using basic processing', { error });
    return processBasic(event.data); // Fallback
  }
};
```

### Security

**1. Input Validation**
```typescript
import { z } from 'zod';

const orderSchema = z.object({
  userId: z.string().uuid(),
  items: z.array(z.object({
    productId: z.string(),
    quantity: z.number().min(1).max(100)
  }))
});

export const handler = async (event) => {
  const validated = orderSchema.parse(JSON.parse(event.body));
  return createOrder(validated);
};
```

**2. Secrets Management**
```typescript
// ❌ Hardcoded secrets
const apiKey = 'sk_live_1234567890';

// ✅ Environment variables from secure store
const apiKey = process.env.API_KEY; // From AWS Secrets Manager, etc.
```

**3. Principle of Least Privilege**
```typescript
// Only grant permissions function actually needs
// Function permissions:
// - Read from specific S3 bucket
// - Write to specific DynamoDB table
// - No administrative access
```

### Performance

**1. Connection Reuse**
```typescript
// Initialize outside handler (reused across warm invocations)
const dbClient = new DatabaseClient({
  connection: {
    keepAlive: true,
    keepAliveInitialDelay: 60000
  }
});

export const handler = async (event) => {
  // Reuse connection
  return dbClient.query(event.query);
};
```

**2. Parallel Operations**
```typescript
// ❌ Sequential (slow)
const user = await userService.get(userId);
const orders = await orderService.getByUser(userId);
const preferences = await preferenceService.get(userId);

// ✅ Parallel (fast)
const [user, orders, preferences] = await Promise.all([
  userService.get(userId),
  orderService.getByUser(userId),
  preferenceService.get(userId)
]);
```

**3. Optimize Package Size**
```typescript
// ❌ Import entire library
import _ from 'lodash';

// ✅ Import specific functions
import { sortBy, groupBy } from 'lodash';

// Or use tree-shakeable alternative
import sortBy from 'lodash-es/sortBy';
```

### Monitoring

**1. Structured Logging**
```typescript
export const handler = async (event, context) => {
  logger.info('Function invoked', {
    requestId: context.requestId,
    userId: event.userId,
    action: event.action
  });

  // Log with context throughout execution
};
```

**2. Custom Metrics**
```typescript
export const handler = async (event) => {
  const startTime = Date.now();

  try {
    const result = await processOrder(event);

    metrics.record('OrderProcessed', 1);
    metrics.record('ProcessingTime', Date.now() - startTime);

    return result;
  } catch (error) {
    metrics.record('OrderFailed', 1);
    throw error;
  }
};
```

**3. Distributed Tracing**
```typescript
// Enable tracing to track requests across functions
// Correlate logs and metrics by request ID
```

---

## When to Use Serverless

### Ideal Candidates

✅ **Variable Traffic Patterns**
- Unpredictable spikes
- Seasonal variations
- Low baseline with occasional bursts

✅ **Event-Driven Workloads**
- File processing pipelines
- Real-time data transformations
- Webhook handlers
- Message queue consumers

✅ **Rapid Experimentation**
- Prototypes and MVPs
- A/B testing new features
- Short-lived marketing campaigns

✅ **API Backends**
- RESTful APIs
- GraphQL resolvers
- Mobile app backends

✅ **Scheduled Jobs**
- Periodic data synchronization
- Report generation
- Cleanup tasks

### Poor Fit

❌ **Latency-Sensitive Applications**
- Sub-100ms response requirements
- Real-time gaming
- High-frequency trading

❌ **Long-Running Tasks**
- Video encoding (multi-hour)
- Large ETL jobs
- Complex simulations

❌ **Stateful Applications**
- Applications requiring significant in-memory state
- Traditional WebSocket servers
- Session-heavy applications

❌ **Constant High Load**
- When traffic is consistently high, traditional infrastructure may be more cost-effective

❌ **Vendor Independence Requirements**
- On-premise-only policies
- Multi-cloud portability needs
- Regulatory constraints on cloud usage

---

## Migration Strategies

### 1. Greenfield (New Projects)

Start serverless by default for event-driven and API workloads.

### 2. Strangler Fig Pattern

Gradually migrate existing applications:
```
1. Route subset of traffic to serverless functions
2. Migrate feature by feature
3. Keep monolith for complex stateful operations
4. Eventually retire monolith when appropriate
```

### 3. Hybrid Approach

Use serverless alongside traditional infrastructure:
```
- Serverless: Event processing, webhooks, APIs
- Traditional: Core application, long-running jobs, stateful services
```

### 4. Edge Cases Only

Use serverless for specific workloads while keeping main application traditional:
```
- Main app: Kubernetes cluster
- Serverless: Image resizing, PDF generation, scheduled cleanup
```

---

## Common Pitfalls

❌ **Ignoring Cold Starts**: Not optimizing for cold start performance
❌ **Over-Engineering Abstractions**: Complex vendor-agnostic layers that add little value
❌ **Configuration Over Code**: Business logic in API gateway config
❌ **No Reserved Capacity**: Production throttled by test workloads
❌ **Insufficient Logging**: Can't debug production issues
❌ **Stateful Assumptions**: Relying on in-memory state
❌ **Missing Timeouts**: Functions running longer than necessary
❌ **No Cost Monitoring**: Surprise bills from inefficient functions
❌ **Security Neglect**: Overly permissive IAM policies

---

## Key Takeaways

1. **Serverless ≠ No Servers**: Infrastructure still exists, you just don't manage it
2. **Two Paradigms**: BaaS (managed services) and FaaS (event-driven functions)
3. **Stateless by Nature**: External state storage required
4. **Automatic Scaling**: From zero to thousands of instances
5. **Pay-Per-Use**: Cost directly correlates with usage
6. **Vendor Lock-In**: Real consideration, plan mitigation strategy
7. **Cold Starts**: Optimize package size and consider provisioned capacity
8. **Cloud-Native Testing**: Integration tests in actual cloud environment
9. **Security Complexity**: Multiple services = expanded attack surface
10. **Not Universal**: Evaluate fit before adoption

**Decision Framework:**

```
Use Serverless When:
├─ Traffic is variable or unpredictable
├─ Event-driven architecture fits the use case
├─ Development speed is priority
├─ Operational overhead must be minimized
└─ Cost optimization for low/variable usage is important

Avoid Serverless When:
├─ Sub-100ms latency requirements
├─ Long-running operations (hours)
├─ Heavy stateful requirements
├─ Vendor independence is critical
└─ Consistent high load (traditional may be cheaper)
```

**Remember:** Serverless is an architectural choice with specific trade-offs, not a universal solution. Success requires understanding constraints, accepting vendor dependencies, and matching workloads to platform strengths.

## Further Reading

**Official Documentation:**
- AWS Lambda Developer Guide
- Google Cloud Functions Documentation
- Azure Functions Documentation
- Cloudflare Workers Docs

**Platform-Specific Limits:** Consult official documentation for current:
- Execution time limits
- Memory limits
- Concurrency limits
- Package size restrictions
- Payload size limits
- Pricing models

**Community Resources:**
- Serverless Framework Documentation
- AWS SAM Documentation
- Serverless Patterns Collection
- Cloud provider architecture blogs
