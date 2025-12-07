# Microservices Communication

## Synchronous vs Asynchronous

```typescript
// ⚠️ Synchronous creates coupling and multiplicative downtime
// If Service A calls B calls C, any failure breaks the chain

// ✅ Prefer asynchronous messaging for most inter-service communication
// Limit synchronous calls to one per user request

// Async messaging example
await eventBus.publish('order.created', {
  orderId: order.id,
  userId: order.userId,
  items: order.items
});

// Other services subscribe and process independently
eventBus.subscribe('order.created', async (event) => {
  await inventoryService.reserveItems(event.items);
});
```

## API-Based Communication

```typescript
// ✅ Well-defined REST APIs between services
// Order Service calling User Service
class UserServiceClient {
  async getUser(userId: string): Promise<User> {
    const response = await this.http.get(`${this.baseUrl}/users/${userId}`);
    return response.data;
  }
}

// ✅ Use circuit breaker for resilience
const userBreaker = new CircuitBreaker({ threshold: 5, timeout: 60000 });

async function getUserSafe(userId: string): Promise<User | null> {
  try {
    return await userBreaker.execute(() => userClient.getUser(userId));
  } catch (error) {
    return getCachedUser(userId); // Fallback
  }
}
```

## Event-Driven Integration

```typescript
// ✅ Publish events for state changes
class OrderService {
  async createOrder(data: CreateOrderDTO): Promise<Order> {
    const order = await this.orderRepository.save(data);

    // Publish event - other services react asynchronously
    await this.eventBus.publish('order.created', {
      orderId: order.id,
      userId: order.userId,
      total: order.total,
      timestamp: new Date()
    });

    return order;
  }
}

// ✅ Consumers handle events independently
class NotificationService {
  @EventHandler('order.created')
  async handleOrderCreated(event: OrderCreatedEvent) {
    await this.sendOrderConfirmation(event.userId, event.orderId);
  }
}

class InventoryService {
  @EventHandler('order.created')
  async handleOrderCreated(event: OrderCreatedEvent) {
    await this.reserveInventory(event.orderId);
  }
}
```

## Tolerant Reader Pattern

```typescript
// ✅ Don't fail on unknown fields - enables independent evolution
interface UserResponse {
  id: string;
  name: string;
  // Ignore additional fields from newer API versions
  [key: string]: unknown;
}

// ✅ Use sensible defaults for missing optional fields
function parseUser(data: unknown): User {
  return {
    id: data.id,
    name: data.name,
    role: data.role ?? 'user', // Default if missing
    avatar: data.avatar ?? null
  };
}
```

## Anti-Patterns

```typescript
// ❌ Chatty communication (N+1 service calls)
for (const orderId of orderIds) {
  const order = await orderService.getOrder(orderId); // N calls
}

// ✅ Batch requests
const orders = await orderService.getOrders(orderIds); // 1 call

// ❌ Tight coupling via shared databases
// Service A directly queries Service B's tables

// ✅ API-based communication
const userData = await userServiceClient.getUser(userId);
```
