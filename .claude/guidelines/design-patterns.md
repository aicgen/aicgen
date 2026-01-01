# Design Patterns

# Base Patterns

## Value Object

Immutable object defined by its value, not identity.

```typescript
class Email {
  private readonly value: string;

  constructor(email: string) {
    if (!this.isValid(email)) throw new Error('Invalid email');
    this.value = email.toLowerCase();
  }

  equals(other: Email): boolean {
    return this.value === other.value;
  }
}

class Money {
  constructor(
    public readonly amount: number,
    public readonly currency: Currency
  ) {
    Object.freeze(this);
  }

  add(other: Money): Money {
    this.assertSameCurrency(other);
    return new Money(this.amount + other.amount, this.currency);
  }
}
```

## Special Case (Null Object)

Replace null checks with polymorphism.

```typescript
abstract class Customer {
  abstract getDiscount(): number;
}

class RealCustomer extends Customer {
  getDiscount(): number { return 0.1; }
}

class GuestCustomer extends Customer {
  getDiscount(): number { return 0; } // No discount
}

// No null checks needed
const customer = repo.findById(id) || new GuestCustomer();
const discount = customer.getDiscount();
```

## Registry

Global access point for services.

```typescript
class ServiceRegistry {
  private static services = new Map<string, any>();

  static register<T>(key: string, service: T): void {
    this.services.set(key, service);
  }

  static get<T>(key: string): T {
    return this.services.get(key);
  }
}

// Prefer dependency injection over registry
```

## Plugin

Extend behavior without modifying core code.

```typescript
interface ValidationPlugin {
  validate(user: User): ValidationResult;
}

class UserValidator {
  private plugins: ValidationPlugin[] = [];

  registerPlugin(plugin: ValidationPlugin): void {
    this.plugins.push(plugin);
  }

  validate(user: User): ValidationResult[] {
    return this.plugins.map(p => p.validate(user));
  }
}
```

## Best Practices

- Use Value Objects to avoid primitive obsession
- Make Value Objects immutable
- Use Special Case instead of null checks
- Prefer dependency injection over Registry


---

# Data Access Patterns

## Repository

Collection-like interface for domain objects.

```typescript
interface UserRepository {
  findById(id: string): Promise<User | null>;
  findByEmail(email: string): Promise<User | null>;
  save(user: User): Promise<void>;
  delete(user: User): Promise<void>;
}

class PostgreSQLUserRepository implements UserRepository {
  async findById(id: string): Promise<User | null> {
    const row = await this.db.queryOne('SELECT * FROM users WHERE id = $1', [id]);
    return row ? this.mapToUser(row) : null;
  }
}
```

## Data Mapper

Complete separation between domain and persistence.

```typescript
class UserMapper {
  toDomain(row: DbRow): User {
    return new User(row.id, row.name, new Email(row.email));
  }

  toDatabase(user: User): DbRow {
    return { id: user.id, name: user.name, email: user.email.toString() };
  }
}
```

## Unit of Work

Track changes and commit together.

```typescript
class UnitOfWork {
  private newObjects = new Set<any>();
  private dirtyObjects = new Set<any>();

  registerNew(obj: any): void { this.newObjects.add(obj); }
  registerDirty(obj: any): void { this.dirtyObjects.add(obj); }

  async commit(): Promise<void> {
    await this.db.beginTransaction();
    try {
      for (const obj of this.newObjects) await this.insert(obj);
      for (const obj of this.dirtyObjects) await this.update(obj);
      await this.db.commit();
    } catch (e) {
      await this.db.rollback();
      throw e;
    }
  }
}
```

## Identity Map

Ensure each object loaded only once per session.

```typescript
class IdentityMap {
  private map = new Map<string, any>();

  get(id: string): any | null { return this.map.get(id) || null; }
  put(id: string, obj: any): void { this.map.set(id, obj); }
}
```

## Best Practices

- Return domain objects from repositories
- Use one repository per aggregate root
- Keep repositories focused on persistence
- Don't leak database details into domain


---

# Domain Logic Patterns

## Transaction Script

Procedural approach - one procedure per operation.

```typescript
async function transferMoney(fromId: string, toId: string, amount: number) {
  const db = await Database.connect();
  await db.beginTransaction();

  try {
    const from = await db.query('SELECT * FROM accounts WHERE id = $1', [fromId]);
    if (from.balance < amount) throw new Error('Insufficient funds');

    await db.execute('UPDATE accounts SET balance = balance - $1 WHERE id = $2', [amount, fromId]);
    await db.execute('UPDATE accounts SET balance = balance + $1 WHERE id = $2', [amount, toId]);
    await db.commit();
  } catch (e) {
    await db.rollback();
    throw e;
  }
}
```

**Use for:** Simple apps, CRUD, reports.

## Domain Model

Rich objects with behavior.

```typescript
class Account {
  constructor(private balance: Money, private overdraftLimit: Money) {}

  withdraw(amount: Money): void {
    if (!this.canWithdraw(amount)) throw new InsufficientFundsError();
    this.balance = this.balance.subtract(amount);
  }

  transfer(amount: Money, recipient: Account): void {
    this.withdraw(amount);
    recipient.deposit(amount);
  }
}
```

**Use for:** Complex business rules, rich domains.

## Service Layer

Application boundary coordinating domain objects.

```typescript
class AccountService {
  constructor(
    private accountRepo: AccountRepository,
    private unitOfWork: UnitOfWork
  ) {}

  async transfer(fromId: string, toId: string, amount: Money): Promise<void> {
    const from = await this.accountRepo.findById(fromId);
    const to = await this.accountRepo.findById(toId);

    from.transfer(amount, to); // Domain logic

    await this.accountRepo.save(from);
    await this.accountRepo.save(to);
    await this.unitOfWork.commit();
  }
}
```

**Use for:** API boundaries, multiple clients, transaction coordination.

## Best Practices

- Choose pattern based on complexity
- Service layer orchestrates, domain model contains logic
- Keep services thin, domain objects rich
- Combine Domain Model + Service Layer for complex apps


---

# Gang of Four Patterns

## Creational

### Factory Method
```typescript
interface Logger { log(msg: string): void; }

abstract class Application {
  abstract createLogger(): Logger;
  run(): void { this.createLogger().log('Started'); }
}

class DevApp extends Application {
  createLogger(): Logger { return new ConsoleLogger(); }
}
```

### Builder
```typescript
const query = new QueryBuilder()
  .from('users')
  .select('id', 'name')
  .where('active = true')
  .limit(10)
  .build();
```

## Structural

### Adapter
```typescript
class PaymentAdapter implements PaymentProcessor {
  constructor(private legacy: OldPaymentSystem) {}

  async process(amount: number): Promise<boolean> {
    return this.legacy.makePayment(amount);
  }
}
```

### Decorator
```typescript
interface Coffee { cost(): number; }

class MilkDecorator implements Coffee {
  constructor(private coffee: Coffee) {}
  cost(): number { return this.coffee.cost() + 2; }
}

let coffee: Coffee = new SimpleCoffee();
coffee = new MilkDecorator(coffee);
```

### Facade
```typescript
class ComputerFacade {
  start(): void {
    this.cpu.freeze();
    this.memory.load(0, this.hdd.read(0, 1024));
    this.cpu.execute();
  }
}
```

## Behavioral

### Strategy
```typescript
interface SortStrategy { sort(data: number[]): number[]; }

class Sorter {
  constructor(private strategy: SortStrategy) {}
  sort(data: number[]): number[] { return this.strategy.sort(data); }
}
```

### Observer
```typescript
class Stock {
  private observers: Observer[] = [];

  attach(o: Observer): void { this.observers.push(o); }
  notify(): void { this.observers.forEach(o => o.update(this)); }

  setPrice(price: number): void {
    this.price = price;
    this.notify();
  }
}
```

### Command
```typescript
interface Command { execute(): void; undo(): void; }

class AppendCommand implements Command {
  constructor(private editor: Editor, private text: string) {}
  execute(): void { this.editor.append(this.text); }
  undo(): void { this.editor.delete(this.text.length); }
}
```

## Best Practices

- Use patterns to solve specific problems, not everywhere
- Combine patterns when appropriate
- Favor composition over inheritance
- Keep implementations simple
