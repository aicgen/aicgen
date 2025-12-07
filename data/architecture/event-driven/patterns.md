# Event-Driven Architecture

## Event Sourcing

Store state as a sequence of events.

```typescript
interface Event {
  id: string;
  aggregateId: string;
  type: string;
  data: unknown;
  timestamp: Date;
  version: number;
}

class Account {
  private balance = 0;
  private version = 0;

  static fromEvents(events: Event[]): Account {
    const account = new Account();
    events.forEach(event => account.apply(event));
    return account;
  }

  private apply(event: Event): void {
    switch (event.type) {
      case 'MoneyDeposited':
        this.balance += (event.data as { amount: number }).amount;
        break;
      case 'MoneyWithdrawn':
        this.balance -= (event.data as { amount: number }).amount;
        break;
    }
    this.version = event.version;
  }
}
```

## CQRS (Command Query Responsibility Segregation)

Separate read and write models.

```typescript
// Write Model (Commands)
class OrderCommandHandler {
  async handle(cmd: PlaceOrderCommand): Promise<void> {
    const order = new Order(cmd.orderId, cmd.items);
    await this.eventStore.save(order.changes());
  }
}

// Read Model (Queries)
class OrderQueryService {
  async getOrderSummary(orderId: string): Promise<OrderSummaryDTO> {
    return this.readDb.query('SELECT * FROM order_summaries WHERE id = $1', [orderId]);
  }
}

// Projection updates read model from events
class OrderProjection {
  async handle(event: OrderPlaced): Promise<void> {
    await this.readDb.insert('order_summaries', {
      id: event.orderId,
      status: 'placed',
      total: event.total
    });
  }
}
```

## Saga Pattern

Manage long-running transactions across services.

```typescript
class OrderSaga {
  async execute(orderId: string): Promise<void> {
    try {
      await this.paymentService.charge(orderId);
      await this.inventoryService.reserve(orderId);
      await this.shippingService.schedule(orderId);
    } catch (error) {
      await this.compensate(orderId, error);
    }
  }

  private async compensate(orderId: string, error: Error): Promise<void> {
    await this.shippingService.cancel(orderId);
    await this.inventoryService.release(orderId);
    await this.paymentService.refund(orderId);
  }
}
```

## Event Versioning

Handle schema changes gracefully.

```typescript
interface EventUpgrader {
  upgrade(event: Event): Event;
}

class OrderPlacedV1ToV2 implements EventUpgrader {
  upgrade(event: Event): Event {
    const oldData = event.data as OrderPlacedV1Data;
    return {
      ...event,
      type: 'OrderPlaced',
      version: 2,
      data: {
        ...oldData,
        currency: 'USD' // New field with default
      }
    };
  }
}
```

## Best Practices

- Events are immutable facts
- Include enough context in events for consumers
- Version events from the start
- Use idempotent event handlers
- Design for eventual consistency
- Consider snapshots for aggregates with many events
