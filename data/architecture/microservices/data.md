# Microservices Data Management

## Database Per Service

```
Each service owns its database:

✅ Order Service → order_db (PostgreSQL)
✅ User Service → user_db (PostgreSQL)
✅ Catalog Service → catalog_db (MongoDB)
✅ Search Service → search_index (Elasticsearch)

❌ Never share databases between services
❌ Never query another service's tables directly
```

## Polyglot Persistence

```typescript
// Each service uses the best database for its needs

// User Service - relational data, ACID transactions
class UserRepository {
  constructor(private postgres: PostgresClient) {}

  async create(user: User): Promise<User> {
    return this.postgres.query('INSERT INTO users...');
  }
}

// Catalog Service - flexible document structure
class ProductRepository {
  constructor(private mongo: MongoClient) {}

  async create(product: Product): Promise<Product> {
    return this.mongo.collection('products').insertOne(product);
  }
}

// Analytics Service - time-series data
class MetricsRepository {
  constructor(private influx: InfluxDBClient) {}

  async record(metric: Metric): Promise<void> {
    await this.influx.writePoints([metric]);
  }
}
```

## Eventual Consistency

```typescript
// ✅ Embrace eventual consistency for cross-service data

// Order created - publish event
await orderRepository.save(order);
await eventBus.publish('order.created', order);

// Inventory service processes asynchronously
// Data may be temporarily inconsistent - that's OK

// ✅ Use compensating actions for failures
async function processOrder(order: Order): Promise<void> {
  try {
    await inventoryService.reserve(order.items);
    await paymentService.charge(order.total);
  } catch (error) {
    // Compensate: release reserved inventory
    await inventoryService.release(order.items);
    throw error;
  }
}
```

## Data Synchronization Patterns

```typescript
// Pattern: Event Sourcing for cross-service data
class OrderProjector {
  @EventHandler('product.updated')
  async handleProductUpdate(event: ProductUpdatedEvent) {
    // Update local cache of product data
    await this.productCache.set(event.productId, {
      name: event.name,
      price: event.price
    });
  }
}

// Pattern: Saga for distributed transactions
class OrderSaga {
  async execute(order: Order): Promise<void> {
    const saga = new Saga();

    saga.addStep({
      action: () => inventoryService.reserve(order.items),
      compensate: () => inventoryService.release(order.items)
    });

    saga.addStep({
      action: () => paymentService.charge(order.total),
      compensate: () => paymentService.refund(order.paymentId)
    });

    await saga.run();
  }
}
```

## Data Ownership

```typescript
// ✅ Each service is the source of truth for its data
class UserService {
  // Only User Service can create/update users
  async updateEmail(userId: string, email: string): Promise<User> {
    const user = await this.userRepository.update(userId, { email });

    // Notify other services of the change
    await this.eventBus.publish('user.email.changed', {
      userId,
      newEmail: email
    });

    return user;
  }
}

// Other services maintain their own copies (projections)
class OrderService {
  @EventHandler('user.email.changed')
  async syncUserEmail(event: UserEmailChangedEvent) {
    // Update local cache, not the source data
    await this.userCache.set(event.userId, { email: event.newEmail });
  }
}
```
