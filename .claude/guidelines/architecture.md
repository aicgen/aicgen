# Architecture

# SOLID Principles

## Single Responsibility Principle (SRP)

A class should have only one reason to change.

**Bad:**
```typescript
class UserService {
  createUser(data: UserData): User { /* ... */ }
  sendWelcomeEmail(user: User): void { /* ... */ }
  generateReport(users: User[]): Report { /* ... */ }
}
```

**Good:**
```typescript
class UserService {
  createUser(data: UserData): User { /* ... */ }
}

class EmailService {
  sendWelcomeEmail(user: User): void { /* ... */ }
}

class ReportService {
  generateUserReport(users: User[]): Report { /* ... */ }
}
```

## Open/Closed Principle (OCP)

Open for extension, closed for modification.

**Bad:**
```typescript
class PaymentProcessor {
  process(payment: Payment): void {
    if (payment.type === 'credit') { /* credit logic */ }
    else if (payment.type === 'paypal') { /* paypal logic */ }
    // Must modify class to add new payment types
  }
}
```

**Good:**
```typescript
interface PaymentHandler {
  process(payment: Payment): void;
}

class CreditCardHandler implements PaymentHandler {
  process(payment: Payment): void { /* credit logic */ }
}

class PayPalHandler implements PaymentHandler {
  process(payment: Payment): void { /* paypal logic */ }
}

class PaymentProcessor {
  constructor(private handlers: Map<string, PaymentHandler>) {}

  process(payment: Payment): void {
    this.handlers.get(payment.type)?.process(payment);
  }
}
```

## Liskov Substitution Principle (LSP)

Subtypes must be substitutable for their base types.

**Bad:**
```typescript
class Bird {
  fly(): void { /* flying logic */ }
}

class Penguin extends Bird {
  fly(): void {
    throw new Error("Penguins can't fly!"); // Violates LSP
  }
}
```

**Good:**
```typescript
interface Bird {
  move(): void;
}

class FlyingBird implements Bird {
  move(): void { this.fly(); }
  private fly(): void { /* flying logic */ }
}

class Penguin implements Bird {
  move(): void { this.swim(); }
  private swim(): void { /* swimming logic */ }
}
```

## Interface Segregation Principle (ISP)

Clients shouldn't depend on interfaces they don't use.

**Bad:**
```typescript
interface Worker {
  work(): void;
  eat(): void;
  sleep(): void;
}

class Robot implements Worker {
  work(): void { /* ... */ }
  eat(): void { throw new Error("Robots don't eat"); }
  sleep(): void { throw new Error("Robots don't sleep"); }
}
```

**Good:**
```typescript
interface Workable {
  work(): void;
}

interface Eatable {
  eat(): void;
}

interface Sleepable {
  sleep(): void;
}

class Human implements Workable, Eatable, Sleepable {
  work(): void { /* ... */ }
  eat(): void { /* ... */ }
  sleep(): void { /* ... */ }
}

class Robot implements Workable {
  work(): void { /* ... */ }
}
```

## Dependency Inversion Principle (DIP)

Depend on abstractions, not concretions.

**Bad:**
```typescript
class UserService {
  private database = new MySQLDatabase();

  getUser(id: string): User {
    return this.database.query(`SELECT * FROM users WHERE id = '${id}'`);
  }
}
```

**Good:**
```typescript
interface Database {
  query(sql: string): any;
}

class UserService {
  constructor(private database: Database) {}

  getUser(id: string): User {
    return this.database.query(`SELECT * FROM users WHERE id = '${id}'`);
  }
}

// Can inject any database implementation
const userService = new UserService(new MySQLDatabase());
const testService = new UserService(new InMemoryDatabase());
```

## Best Practices

- Apply SRP at class, method, and module levels
- Use interfaces and dependency injection for flexibility
- Prefer composition over inheritance
- Design small, focused interfaces
- Inject dependencies rather than creating them internally


---

# Event-Driven Messaging

## Message Types

### Commands
Request to perform an action. Directed to a single handler.

```typescript
interface CreateOrderCommand {
  type: 'CreateOrder';
  orderId: string;
  customerId: string;
  items: OrderItem[];
  timestamp: Date;
}

// Single handler processes the command
class CreateOrderHandler {
  async handle(command: CreateOrderCommand): Promise<void> {
    const order = Order.create(command);
    await this.repository.save(order);
    await this.eventBus.publish(new OrderCreatedEvent(order));
  }
}
```

### Events
Notification that something happened. Published to multiple subscribers.

```typescript
interface OrderCreatedEvent {
  type: 'OrderCreated';
  orderId: string;
  customerId: string;
  totalAmount: number;
  occurredAt: Date;
}

// Multiple handlers can subscribe
class InventoryService {
  @Subscribe('OrderCreated')
  async onOrderCreated(event: OrderCreatedEvent): Promise<void> {
    await this.reserveInventory(event.orderId);
  }
}

class NotificationService {
  @Subscribe('OrderCreated')
  async onOrderCreated(event: OrderCreatedEvent): Promise<void> {
    await this.sendConfirmation(event.customerId);
  }
}
```

### Queries
Request for data. Returns a response.

```typescript
interface GetOrderQuery {
  type: 'GetOrder';
  orderId: string;
}

class GetOrderHandler {
  async handle(query: GetOrderQuery): Promise<Order> {
    return this.repository.findById(query.orderId);
  }
}
```

## Message Bus Patterns

### In-Memory Bus

```typescript
class EventBus {
  private handlers = new Map<string, Function[]>();

  subscribe(eventType: string, handler: Function): void {
    const handlers = this.handlers.get(eventType) || [];
    handlers.push(handler);
    this.handlers.set(eventType, handlers);
  }

  async publish(event: Event): Promise<void> {
    const handlers = this.handlers.get(event.type) || [];
    await Promise.all(handlers.map(h => h(event)));
  }
}
```

### Message Queue Integration

```typescript
// RabbitMQ example
class RabbitMQPublisher {
  async publish(event: Event): Promise<void> {
    const message = JSON.stringify({
      type: event.type,
      data: event,
      metadata: {
        correlationId: uuid(),
        timestamp: new Date().toISOString()
      }
    });

    await this.channel.publish(
      'events',
      event.type,
      Buffer.from(message),
      { persistent: true }
    );
  }
}

class RabbitMQConsumer {
  async consume(queue: string, handler: EventHandler): Promise<void> {
    await this.channel.consume(queue, async (msg) => {
      if (!msg) return;

      try {
        const event = JSON.parse(msg.content.toString());
        await handler.handle(event);
        this.channel.ack(msg);
      } catch (error) {
        this.channel.nack(msg, false, true); // Requeue
      }
    });
  }
}
```

## Delivery Guarantees

### At-Least-Once Delivery

```typescript
// Producer: persist before publish
async function publishWithRetry(event: Event): Promise<void> {
  // 1. Save to outbox
  await db.insert('outbox', {
    id: event.id,
    type: event.type,
    payload: JSON.stringify(event),
    status: 'pending'
  });

  // 2. Publish (may fail)
  try {
    await messageBus.publish(event);
    await db.update('outbox', event.id, { status: 'sent' });
  } catch {
    // Retry worker will pick it up
  }
}

// Consumer: idempotent handling
async function handleIdempotent(event: Event): Promise<void> {
  const processed = await db.findOne('processed_events', event.id);
  if (processed) return; // Already handled

  await handleEvent(event);
  await db.insert('processed_events', { id: event.id });
}
```

### Outbox Pattern

```typescript
// Transaction includes outbox write
async function createOrder(data: OrderData): Promise<Order> {
  return await db.transaction(async (tx) => {
    // 1. Business logic
    const order = Order.create(data);
    await tx.insert('orders', order);

    // 2. Outbox entry (same transaction)
    await tx.insert('outbox', {
      id: uuid(),
      aggregateId: order.id,
      type: 'OrderCreated',
      payload: JSON.stringify(order)
    });

    return order;
  });
}

// Separate process polls and publishes
async function processOutbox(): Promise<void> {
  const pending = await db.query(
    'SELECT * FROM outbox WHERE status = $1 ORDER BY created_at LIMIT 100',
    ['pending']
  );

  for (const entry of pending) {
    await messageBus.publish(JSON.parse(entry.payload));
    await db.update('outbox', entry.id, { status: 'sent' });
  }
}
```

## Dead Letter Queues

```typescript
class DeadLetterHandler {
  maxRetries = 3;

  async handleFailure(message: Message, error: Error): Promise<void> {
    const retryCount = message.metadata.retryCount || 0;

    if (retryCount < this.maxRetries) {
      // Retry with backoff
      await this.scheduleRetry(message, retryCount + 1);
    } else {
      // Move to DLQ
      await this.moveToDLQ(message, error);
    }
  }

  async moveToDLQ(message: Message, error: Error): Promise<void> {
    await this.dlqChannel.publish('dead-letter', {
      originalMessage: message,
      error: error.message,
      failedAt: new Date()
    });

    // Alert operations
    await this.alerting.notify('Message moved to DLQ', { message, error });
  }
}
```

## Best Practices

- Use correlation IDs to trace message flows
- Make consumers idempotent
- Use dead letter queues for failed messages
- Monitor queue depths and consumer lag
- Design for eventual consistency
- Version your message schemas
- Include metadata (timestamp, correlationId, causationId)


---

# GUI Architecture Patterns

## MVC (Model-View-Controller)

```typescript
// Model - data and business logic
class UserModel {
  private users: User[] = [];

  getUsers(): User[] { return this.users; }
  addUser(user: User): void { this.users.push(user); }
}

// View - presentation
class UserView {
  render(users: User[]): void {
    console.log('Users:', users);
  }
}

// Controller - handles input, coordinates
class UserController {
  constructor(
    private model: UserModel,
    private view: UserView
  ) {}

  handleAddUser(userData: UserData): void {
    const user = new User(userData);
    this.model.addUser(user);
    this.view.render(this.model.getUsers());
  }
}
```

## MVP (Model-View-Presenter)

```typescript
// View interface - defines what presenter can call
interface UserView {
  showUsers(users: User[]): void;
  showError(message: string): void;
}

// Presenter - all presentation logic
class UserPresenter {
  constructor(
    private view: UserView,
    private model: UserModel
  ) {}

  loadUsers(): void {
    try {
      const users = this.model.getUsers();
      this.view.showUsers(users);
    } catch (error) {
      this.view.showError('Failed to load users');
    }
  }
}

// View implementation - passive, no logic
class UserListView implements UserView {
  showUsers(users: User[]): void { /* render list */ }
  showError(message: string): void { /* show error */ }
}
```

## MVVM (Model-View-ViewModel)

```typescript
// ViewModel - exposes observable state
class UserViewModel {
  users = observable<User[]>([]);
  isLoading = observable(false);

  async loadUsers(): Promise<void> {
    this.isLoading.set(true);
    const users = await this.userService.getUsers();
    this.users.set(users);
    this.isLoading.set(false);
  }
}

// View binds to ViewModel
const UserList = observer(({ viewModel }: { viewModel: UserViewModel }) => (
  <div>
    {viewModel.isLoading.get() ? (
      <Spinner />
    ) : (
      viewModel.users.get().map(user => <UserItem key={user.id} user={user} />)
    )}
  </div>
));
```

## Component Architecture (React/Vue)

```typescript
// Presentational component - no state, just props
const UserCard = ({ user, onDelete }: UserCardProps) => (
  <div className="user-card">
    <h3>{user.name}</h3>
    <button onClick={() => onDelete(user.id)}>Delete</button>
  </div>
);

// Container component - manages state
const UserListContainer = () => {
  const [users, setUsers] = useState<User[]>([]);

  useEffect(() => {
    userService.getUsers().then(setUsers);
  }, []);

  const handleDelete = (id: string) => {
    userService.deleteUser(id).then(() => {
      setUsers(users.filter(u => u.id !== id));
    });
  };

  return <UserList users={users} onDelete={handleDelete} />;
};
```

## Best Practices

- Separate UI logic from business logic
- Keep views as simple as possible
- Use unidirectional data flow when possible
- Make components reusable and testable
- Choose pattern based on framework and team familiarity


---

# Feature Toggles

## Toggle Types

### Release Toggles
Hide incomplete features in production.

```typescript
if (featureFlags.isEnabled('new-checkout')) {
  return <NewCheckout />;
}
return <LegacyCheckout />;
```

### Experiment Toggles
A/B testing and gradual rollouts.

```typescript
const variant = featureFlags.getVariant('pricing-experiment', userId);
if (variant === 'new-pricing') {
  return calculateNewPricing(cart);
}
return calculateLegacyPricing(cart);
```

### Ops Toggles
Runtime operational control.

```typescript
if (featureFlags.isEnabled('enable-caching')) {
  return cache.get(key) || fetchFromDatabase(key);
}
return fetchFromDatabase(key);
```

## Implementation

```typescript
interface FeatureFlags {
  isEnabled(flag: string, context?: Context): boolean;
  getVariant(flag: string, userId: string): string;
}

class FeatureFlagService implements FeatureFlags {
  constructor(private config: Map<string, FlagConfig>) {}

  isEnabled(flag: string, context?: Context): boolean {
    const config = this.config.get(flag);
    if (!config) return false;

    if (config.percentage) {
      return this.isInPercentage(context?.userId, config.percentage);
    }

    return config.enabled;
  }

  private isInPercentage(userId: string | undefined, percentage: number): boolean {
    if (!userId) return false;
    const hash = this.hashUserId(userId);
    return (hash % 100) < percentage;
  }
}
```

## Best Practices

- Remove toggles after feature is stable
- Use clear naming conventions
- Log toggle decisions for debugging
- Test both toggle states
- Limit number of active toggles
- Document toggle purpose and expiration
