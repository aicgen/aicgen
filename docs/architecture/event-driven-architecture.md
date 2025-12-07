# Event-Driven Architecture Patterns

## Core Concepts

### Events vs Commands

```typescript
// Command: Imperative, request for action
interface CreateOrderCommand {
  userId: string;
  items: OrderItem[];
  shippingAddress: Address;
}

// Event: Past tense, something that happened
interface OrderCreatedEvent {
  orderId: string;
  userId: string;
  items: OrderItem[];
  timestamp: Date;
}

// Commands can be rejected
const handleCreateOrder = async (command: CreateOrderCommand) => {
  if (command.items.length === 0) {
    throw new Error('Cannot create empty order'); // Rejected
  }
  // Process command...
  return publishEvent(new OrderCreatedEvent(/* ... */));
};

// Events are facts, cannot be rejected
const handleOrderCreated = async (event: OrderCreatedEvent) => {
  // React to what happened
  await updateInventory(event.items);
  await sendConfirmationEmail(event.userId);
};
```

### Event Structure

```typescript
interface DomainEvent {
  eventId: string;
  eventType: string;
  aggregateId: string;
  aggregateType: string;
  version: number;
  timestamp: Date;
  data: unknown;
  metadata?: {
    userId?: string;
    correlationId?: string;
    causationId?: string;
  };
}

// Example event
const orderCreatedEvent: DomainEvent = {
  eventId: 'evt_123',
  eventType: 'OrderCreated',
  aggregateId: 'order_456',
  aggregateType: 'Order',
  version: 1,
  timestamp: new Date(),
  data: {
    userId: 'user_789',
    total: 150.00,
    items: [/* ... */]
  },
  metadata: {
    userId: 'user_789',
    correlationId: 'corr_123', // Groups related events
    causationId: 'cmd_456'      // What caused this event
  }
};
```

## Event Sourcing

### Aggregate with Event Sourcing

```typescript
abstract class AggregateRoot {
  private uncommittedEvents: DomainEvent[] = [];
  protected version = 0;

  protected applyEvent(event: DomainEvent): void {
    this.apply(event);
    this.uncommittedEvents.push(event);
    this.version++;
  }

  protected abstract apply(event: DomainEvent): void;

  getUncommittedEvents(): DomainEvent[] {
    return [...this.uncommittedEvents];
  }

  markEventsAsCommitted(): void {
    this.uncommittedEvents = [];
  }

  loadFromHistory(events: DomainEvent[]): void {
    events.forEach(event => {
      this.apply(event);
      this.version++;
    });
  }
}

// Order aggregate
class Order extends AggregateRoot {
  private id: string;
  private userId: string;
  private items: OrderItem[] = [];
  private status: OrderStatus = OrderStatus.PENDING;
  private total = 0;

  static create(userId: string, items: OrderItem[]): Order {
    const order = new Order();
    order.applyEvent({
      eventId: generateId(),
      eventType: 'OrderCreated',
      aggregateId: generateId(),
      aggregateType: 'Order',
      version: 1,
      timestamp: new Date(),
      data: { userId, items }
    });
    return order;
  }

  ship(trackingNumber: string): void {
    if (this.status !== OrderStatus.PAID) {
      throw new Error('Can only ship paid orders');
    }

    this.applyEvent({
      eventId: generateId(),
      eventType: 'OrderShipped',
      aggregateId: this.id,
      aggregateType: 'Order',
      version: this.version + 1,
      timestamp: new Date(),
      data: { trackingNumber }
    });
  }

  protected apply(event: DomainEvent): void {
    switch (event.eventType) {
      case 'OrderCreated':
        this.id = event.aggregateId;
        this.userId = event.data.userId;
        this.items = event.data.items;
        this.total = this.items.reduce((sum, item) => sum + item.price, 0);
        break;

      case 'OrderPaid':
        this.status = OrderStatus.PAID;
        break;

      case 'OrderShipped':
        this.status = OrderStatus.SHIPPED;
        break;

      case 'OrderCancelled':
        this.status = OrderStatus.CANCELLED;
        break;
    }
  }
}
```

### Event Store

```typescript
interface EventStore {
  save(aggregateId: string, events: DomainEvent[], expectedVersion: number): Promise<void>;
  getEvents(aggregateId: string): Promise<DomainEvent[]>;
  getAllEvents(afterVersion?: number): Promise<DomainEvent[]>;
}

class InMemoryEventStore implements EventStore {
  private events = new Map<string, DomainEvent[]>();

  async save(aggregateId: string, events: DomainEvent[], expectedVersion: number): Promise<void> {
    const existing = this.events.get(aggregateId) || [];

    if (existing.length !== expectedVersion) {
      throw new Error('Concurrency conflict');
    }

    this.events.set(aggregateId, [...existing, ...events]);
  }

  async getEvents(aggregateId: string): Promise<DomainEvent[]> {
    return this.events.get(aggregateId) || [];
  }

  async getAllEvents(afterVersion: number = 0): Promise<DomainEvent[]> {
    return Array.from(this.events.values())
      .flat()
      .filter(e => e.version > afterVersion)
      .sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());
  }
}

// Repository using event store
class OrderRepository {
  constructor(private eventStore: EventStore) {}

  async save(order: Order): Promise<void> {
    const events = order.getUncommittedEvents();

    await this.eventStore.save(
      order.getId(),
      events,
      order.getVersion() - events.length
    );

    order.markEventsAsCommitted();
  }

  async findById(orderId: string): Promise<Order | null> {
    const events = await this.eventStore.getEvents(orderId);

    if (events.length === 0) {
      return null;
    }

    const order = new Order();
    order.loadFromHistory(events);

    return order;
  }
}
```

## CQRS (Command Query Responsibility Segregation)

### Separate Read and Write Models

```typescript
// Write Model (Commands)
class OrderCommandHandler {
  constructor(
    private orderRepo: OrderRepository,
    private eventBus: EventBus
  ) {}

  async handleCreateOrder(command: CreateOrderCommand): Promise<string> {
    const order = Order.create(command.userId, command.items);

    await this.orderRepo.save(order);

    // Publish events for read model updates
    order.getUncommittedEvents().forEach(event => {
      this.eventBus.publish(event);
    });

    return order.getId();
  }

  async handleShipOrder(command: ShipOrderCommand): Promise<void> {
    const order = await this.orderRepo.findById(command.orderId);

    if (!order) {
      throw new Error('Order not found');
    }

    order.ship(command.trackingNumber);

    await this.orderRepo.save(order);

    order.getUncommittedEvents().forEach(event => {
      this.eventBus.publish(event);
    });
  }
}

// Read Model (Queries)
interface OrderReadModel {
  id: string;
  userId: string;
  status: string;
  total: number;
  itemCount: number;
  createdAt: Date;
  shippedAt?: Date;
}

class OrderQueryHandler {
  constructor(private db: Database) {}

  async getOrder(orderId: string): Promise<OrderReadModel | null> {
    return this.db.query(
      'SELECT * FROM order_read_model WHERE id = ?',
      [orderId]
    );
  }

  async getUserOrders(userId: string): Promise<OrderReadModel[]> {
    return this.db.query(
      'SELECT * FROM order_read_model WHERE user_id = ? ORDER BY created_at DESC',
      [userId]
    );
  }
}

// Projection (Event → Read Model)
class OrderProjection {
  constructor(private db: Database) {}

  async handleOrderCreated(event: OrderCreatedEvent): Promise<void> {
    await this.db.query(`
      INSERT INTO order_read_model (id, user_id, status, total, item_count, created_at)
      VALUES (?, ?, ?, ?, ?, ?)
    `, [
      event.aggregateId,
      event.data.userId,
      'PENDING',
      event.data.total,
      event.data.items.length,
      event.timestamp
    ]);
  }

  async handleOrderShipped(event: OrderShippedEvent): Promise<void> {
    await this.db.query(`
      UPDATE order_read_model
      SET status = 'SHIPPED', shipped_at = ?
      WHERE id = ?
    `, [event.timestamp, event.aggregateId]);
  }
}
```

## Message Queue Integration

### RabbitMQ Example

```typescript
import amqp from 'amqplib';

class MessageQueue {
  private connection: amqp.Connection;
  private channel: amqp.Channel;

  async connect(): Promise<void> {
    this.connection = await amqp.connect('amqp://localhost');
    this.channel = await this.connection.createChannel();
  }

  async publish(exchange: string, routingKey: string, event: DomainEvent): Promise<void> {
    await this.channel.assertExchange(exchange, 'topic', { durable: true });

    this.channel.publish(
      exchange,
      routingKey,
      Buffer.from(JSON.stringify(event)),
      { persistent: true }
    );
  }

  async subscribe(
    exchange: string,
    routingKey: string,
    handler: (event: DomainEvent) => Promise<void>
  ): Promise<void> {
    await this.channel.assertExchange(exchange, 'topic', { durable: true });

    const queue = await this.channel.assertQueue('', { exclusive: true });
    await this.channel.bindQueue(queue.queue, exchange, routingKey);

    this.channel.consume(queue.queue, async (msg) => {
      if (msg) {
        const event = JSON.parse(msg.content.toString());

        try {
          await handler(event);
          this.channel.ack(msg);
        } catch (error) {
          console.error('Error handling event:', error);
          this.channel.nack(msg, false, true); // Requeue
        }
      }
    });
  }
}

// Usage
const queue = new MessageQueue();
await queue.connect();

// Publish events
await queue.publish('orders', 'order.created', orderCreatedEvent);

// Subscribe to events
await queue.subscribe('orders', 'order.*', async (event) => {
  console.log('Received event:', event);
  await handleEvent(event);
});
```

### AWS EventBridge Example

```typescript
import { EventBridge } from '@aws-sdk/client-eventbridge';

class EventBridgePublisher {
  private client: EventBridge;

  constructor() {
    this.client = new EventBridge({ region: 'us-east-1' });
  }

  async publish(event: DomainEvent): Promise<void> {
    await this.client.putEvents({
      Entries: [{
        Source: 'order-service',
        DetailType: event.eventType,
        Detail: JSON.stringify(event.data),
        EventBusName: 'default',
        Time: event.timestamp
      }]
    });
  }
}

// Lambda handler for consuming events
export const handler = async (event: any) => {
  console.log('Received event:', event.detail);

  const domainEvent: DomainEvent = {
    eventType: event['detail-type'],
    data: event.detail,
    timestamp: new Date(event.time)
  };

  await processEvent(domainEvent);
};
```

## Pub/Sub Pattern

### In-Memory Event Bus

```typescript
type EventHandler = (event: DomainEvent) => Promise<void>;

class EventBus {
  private handlers = new Map<string, EventHandler[]>();

  subscribe(eventType: string, handler: EventHandler): void {
    if (!this.handlers.has(eventType)) {
      this.handlers.set(eventType, []);
    }

    this.handlers.get(eventType)!.push(handler);
  }

  async publish(event: DomainEvent): Promise<void> {
    const handlers = this.handlers.get(event.eventType) || [];

    await Promise.all(
      handlers.map(handler =>
        handler(event).catch(error => {
          console.error(`Error in event handler for ${event.eventType}:`, error);
        })
      )
    );
  }
}

// Usage
const eventBus = new EventBus();

// Subscribe to events
eventBus.subscribe('OrderCreated', async (event) => {
  await sendConfirmationEmail(event.data.userId);
});

eventBus.subscribe('OrderCreated', async (event) => {
  await updateInventory(event.data.items);
});

eventBus.subscribe('OrderCreated', async (event) => {
  await updateAnalytics(event);
});

// Publish event
await eventBus.publish(orderCreatedEvent);
```

## Saga Pattern

### Orchestration Saga

```typescript
class OrderSaga {
  constructor(
    private paymentService: PaymentService,
    private inventoryService: InventoryService,
    private shippingService: ShippingService,
    private eventBus: EventBus
  ) {}

  async execute(order: Order): Promise<void> {
    try {
      // Step 1: Reserve inventory
      await this.inventoryService.reserve(order.items);

      // Step 2: Process payment
      const payment = await this.paymentService.charge(order.total);

      // Step 3: Schedule shipping
      await this.shippingService.schedule(order.id);

      // Success: Publish completion event
      await this.eventBus.publish({
        eventType: 'OrderCompleted',
        aggregateId: order.id,
        data: { paymentId: payment.id }
      });

    } catch (error) {
      // Compensating transactions (rollback)
      await this.compensate(order);
      throw error;
    }
  }

  private async compensate(order: Order): Promise<void> {
    try {
      await this.inventoryService.releaseReservation(order.items);
      await this.paymentService.refund(order.id);
    } catch (error) {
      console.error('Compensation failed:', error);
      // Log for manual intervention
    }
  }
}
```

### Choreography Saga

```typescript
// Each service reacts to events independently

// Inventory Service
class InventoryService {
  constructor(private eventBus: EventBus) {
    this.eventBus.subscribe('OrderCreated', this.handleOrderCreated.bind(this));
    this.eventBus.subscribe('PaymentFailed', this.handlePaymentFailed.bind(this));
  }

  private async handleOrderCreated(event: OrderCreatedEvent): Promise<void> {
    try {
      await this.reserve(event.data.items);

      await this.eventBus.publish({
        eventType: 'InventoryReserved',
        aggregateId: event.aggregateId,
        data: { items: event.data.items }
      });
    } catch (error) {
      await this.eventBus.publish({
        eventType: 'InventoryReservationFailed',
        aggregateId: event.aggregateId,
        data: { error: error.message }
      });
    }
  }

  private async handlePaymentFailed(event: PaymentFailedEvent): Promise<void> {
    await this.releaseReservation(event.aggregateId);
  }
}

// Payment Service
class PaymentService {
  constructor(private eventBus: EventBus) {
    this.eventBus.subscribe('InventoryReserved', this.handleInventoryReserved.bind(this));
  }

  private async handleInventoryReserved(event: InventoryReservedEvent): Promise<void> {
    try {
      const payment = await this.charge(event.data.total);

      await this.eventBus.publish({
        eventType: 'PaymentProcessed',
        aggregateId: event.aggregateId,
        data: { paymentId: payment.id }
      });
    } catch (error) {
      await this.eventBus.publish({
        eventType: 'PaymentFailed',
        aggregateId: event.aggregateId,
        data: { error: error.message }
      });
    }
  }
}
```

## Event Versioning

### Handling Event Schema Evolution

```typescript
// V1 Event
interface OrderCreatedV1 {
  eventType: 'OrderCreated';
  version: 1;
  data: {
    userId: string;
    items: OrderItem[];
  };
}

// V2 Event (added shipping address)
interface OrderCreatedV2 {
  eventType: 'OrderCreated';
  version: 2;
  data: {
    userId: string;
    items: OrderItem[];
    shippingAddress: Address;
  };
}

// Upcasting: Convert old events to new format
class EventUpcaster {
  upcast(event: DomainEvent): DomainEvent {
    if (event.eventType === 'OrderCreated' && event.version === 1) {
      return {
        ...event,
        version: 2,
        data: {
          ...event.data,
          shippingAddress: getDefaultAddress(event.data.userId)
        }
      };
    }

    return event;
  }
}

// Handle multiple versions
class OrderProjection {
  async handleOrderCreated(event: DomainEvent): Promise<void> {
    const upcastedEvent = this.upcaster.upcast(event);

    switch (upcastedEvent.version) {
      case 1:
        return this.handleOrderCreatedV1(upcastedEvent as OrderCreatedV1);
      case 2:
        return this.handleOrderCreatedV2(upcastedEvent as OrderCreatedV2);
      default:
        throw new Error(`Unsupported event version: ${upcastedEvent.version}`);
    }
  }
}
```

## Benefits and Drawbacks

### ✅ Benefits

- **Scalability**: Read and write models can scale independently
- **Audit Trail**: Complete history of all changes
- **Temporal Queries**: Reconstruct state at any point in time
- **Loose Coupling**: Services communicate via events
- **Flexibility**: Add new event handlers without changing existing code

### ❌ Drawbacks

- **Eventual Consistency**: Read model may lag behind write model
- **Complexity**: More moving parts than traditional CRUD
- **Learning Curve**: Requires mindset shift
- **Debugging**: Distributed system issues
- **Event Schema Evolution**: Handling versioning

### When to Use

**Use CQRS/Event Sourcing when:**
- Complex business logic with many state changes
- Need complete audit trail
- Different optimization requirements for reads vs writes
- Working in specific bounded contexts (not entire system)

**Avoid when:**
- Simple CRUD applications
- Team lacks experience with pattern
- Eventual consistency is unacceptable

## References

- [CQRS](https://martinfowler.com/bliki/CQRS.html)
- [Event Sourcing](https://martinfowler.com/eaaDev/EventSourcing.html)
- [Domain Events](https://martinfowler.com/eaaDev/DomainEvent.html)
- [Saga Pattern](https://microservices.io/patterns/data/saga.html)
