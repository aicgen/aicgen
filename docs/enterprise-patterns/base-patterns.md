# Base Patterns

## Overview

Base patterns are foundational building blocks used throughout enterprise applications. They provide reusable solutions to common structural and organizational problems.

## Pattern Categories

| Category | Patterns | Purpose |
|----------|---------|---------|
| Value Objects | Value Object, Money, Special Case | Represent immutable concepts |
| Service Access | Registry, Service Locator, Separated Interface | Manage service dependencies |
| Data Handling | Record Set, Mapper | Work with data structures |
| Code Organization | Layer Supertype, Plugin | Organize and extend code |

---

## Value Object

### Definition

**A small object that represents a simple entity whose equality is not based on identity but on value.**

### Purpose

Model concepts that are defined by their value, not their identity. Value objects are immutable and can be freely shared.

### When to Use

✅ **Good For:**
- Modeling domain concepts (Email, Address, DateRange)
- Money and currency
- Coordinates, colors, measurements
- Replacing primitive obsession
- Ensuring immutability

❌ **Not Ideal For:**
- Entities with identity (User, Order)
- Mutable state
- Large objects with many fields

### Example

```typescript
class Email {
  private readonly value: string;

  constructor(email: string) {
    if (!this.isValid(email)) {
      throw new Error(`Invalid email: ${email}`);
    }
    this.value = email.toLowerCase();
  }

  private isValid(email: string): boolean {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  }

  equals(other: Email): boolean {
    return this.value === other.value;
  }

  toString(): string {
    return this.value;
  }

  getDomain(): string {
    return this.value.split('@')[1];
  }
}

class Address {
  constructor(
    public readonly street: string,
    public readonly city: string,
    public readonly state: string,
    public readonly zipCode: string,
    public readonly country: string
  ) {
    Object.freeze(this);
  }

  equals(other: Address): boolean {
    return (
      this.street === other.street &&
      this.city === other.city &&
      this.state === other.state &&
      this.zipCode === other.zipCode &&
      this.country === other.country
    );
  }

  toString(): string {
    return `${this.street}, ${this.city}, ${this.state} ${this.zipCode}`;
  }
}

class DateRange {
  constructor(
    public readonly start: Date,
    public readonly end: Date
  ) {
    if (start > end) {
      throw new Error('Start date must be before end date');
    }
    Object.freeze(this);
  }

  contains(date: Date): boolean {
    return date >= this.start && date <= this.end;
  }

  overlaps(other: DateRange): boolean {
    return this.start <= other.end && this.end >= other.start;
  }

  lengthInDays(): number {
    return Math.ceil((this.end.getTime() - this.start.getTime()) / (1000 * 60 * 60 * 24));
  }
}

// Usage
const email = new Email('user@example.com');
const address = new Address('123 Main St', 'Springfield', 'IL', '62701', 'USA');
const range = new DateRange(new Date('2024-01-01'), new Date('2024-01-31'));

console.log(email.getDomain()); // 'example.com'
console.log(range.lengthInDays()); // 31
```

### Best Practices

✅ **DO:**
- Make value objects immutable
- Implement equality based on value
- Validate in constructor
- Use `Object.freeze()` for immutability
- Override `toString()` for debugging

❌ **DON'T:**
- Use setters (make fields readonly)
- Compare by reference
- Allow invalid state
- Make value objects entities

---

## Money

### Definition

**Represents monetary values with currency, handling precision and arithmetic correctly.**

### Purpose

Avoid floating-point precision errors and encapsulate currency-specific logic.

### Example

```typescript
class Money {
  private readonly amount: number;
  private readonly currency: Currency;

  private constructor(amount: number, currency: Currency) {
    this.amount = Math.round(amount);
    this.currency = currency;
    Object.freeze(this);
  }

  static fromCents(cents: number, currency: Currency): Money {
    return new Money(cents, currency);
  }

  static fromDollars(dollars: number, currency: Currency = Currency.USD): Money {
    return new Money(Math.round(dollars * 100), currency);
  }

  static zero(currency: Currency = Currency.USD): Money {
    return new Money(0, currency);
  }

  get cents(): number {
    return this.amount;
  }

  get dollars(): number {
    return this.amount / 100;
  }

  add(other: Money): Money {
    this.assertSameCurrency(other);
    return new Money(this.amount + other.amount, this.currency);
  }

  subtract(other: Money): Money {
    this.assertSameCurrency(other);
    return new Money(this.amount - other.amount, this.currency);
  }

  multiply(multiplier: number): Money {
    return new Money(Math.round(this.amount * multiplier), this.currency);
  }

  divide(divisor: number): Money {
    if (divisor === 0) {
      throw new Error('Cannot divide by zero');
    }
    return new Money(Math.round(this.amount / divisor), this.currency);
  }

  isGreaterThan(other: Money): boolean {
    this.assertSameCurrency(other);
    return this.amount > other.amount;
  }

  isLessThan(other: Money): boolean {
    this.assertSameCurrency(other);
    return this.amount < other.amount;
  }

  equals(other: Money): boolean {
    return this.amount === other.amount && this.currency === other.currency;
  }

  private assertSameCurrency(other: Money): void {
    if (this.currency !== other.currency) {
      throw new Error(`Cannot operate on different currencies: ${this.currency} and ${other.currency}`);
    }
  }

  toString(): string {
    return `${this.currency} ${(this.amount / 100).toFixed(2)}`;
  }

  format(): string {
    const formatter = new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: this.currency
    });
    return formatter.format(this.dollars);
  }
}

enum Currency {
  USD = 'USD',
  EUR = 'EUR',
  GBP = 'GBP',
  JPY = 'JPY'
}

// Usage
const price = Money.fromDollars(99.99);
const tax = price.multiply(0.08);
const total = price.add(tax);

console.log(total.format()); // "$107.99"

// Safe currency handling
const usd = Money.fromDollars(100, Currency.USD);
const eur = Money.fromDollars(100, Currency.EUR);
// usd.add(eur); // Throws error: different currencies
```

### Best Practices

✅ **DO:**
- Store amounts as integers (cents)
- Check currency compatibility
- Use precise arithmetic
- Provide formatting methods
- Make immutable

❌ **DON'T:**
- Use floating-point for money
- Mix currencies without conversion
- Allow negative amounts without validation
- Use primitives for money

---

## Special Case

### Definition

**A subclass that provides special behavior for particular cases, replacing conditional logic.**

### Purpose

Eliminate null checks and special-case conditionals with polymorphism.

### Example

```typescript
// Instead of null checks everywhere
class CustomerService {
  getDiscount(customer: Customer | null): number {
    if (customer === null) {
      return 0;
    }
    if (customer.isPreferred()) {
      return 0.15;
    }
    return 0.05;
  }
}

// Use Special Case pattern
abstract class Customer {
  abstract getName(): string;
  abstract getDiscount(): number;
  abstract isPreferred(): boolean;
  abstract sendEmail(message: string): void;
}

class RealCustomer extends Customer {
  constructor(
    private name: string,
    private email: string,
    private preferred: boolean = false
  ) {
    super();
  }

  getName(): string {
    return this.name;
  }

  getDiscount(): number {
    return this.preferred ? 0.15 : 0.05;
  }

  isPreferred(): boolean {
    return this.preferred;
  }

  sendEmail(message: string): void {
    emailService.send(this.email, message);
  }
}

class GuestCustomer extends Customer {
  getName(): string {
    return 'Guest';
  }

  getDiscount(): number {
    return 0; // No discount for guests
  }

  isPreferred(): boolean {
    return false;
  }

  sendEmail(message: string): void {
    // Do nothing - guests don't have email
  }
}

class CustomerRepository {
  findById(id: string): Customer {
    const data = this.db.findById(id);
    return data ? new RealCustomer(data.name, data.email, data.preferred) : new GuestCustomer();
  }
}

// Usage - no null checks needed!
const customer = customerRepo.findById('123');
const discount = customer.getDiscount(); // Works for both real and guest
customer.sendEmail('Welcome!'); // Safe - guest does nothing
```

### Common Special Cases

```typescript
// Null Object
class NullLogger implements Logger {
  log(message: string): void {
    // Do nothing
  }
}

// Unknown Case
class UnknownProduct extends Product {
  getName(): string {
    return 'Unknown Product';
  }

  getPrice(): Money {
    return Money.zero();
  }
}

// Default Case
class DefaultConfiguration extends Configuration {
  get(key: string): string {
    return this.defaults[key] || '';
  }
}
```

### Best Practices

✅ **DO:**
- Replace null checks with special case objects
- Implement same interface as real object
- Use for common special cases (null, unknown, default)
- Make behavior explicit

❌ **DON'T:**
- Use for rarely occurring cases
- Create too many special cases
- Hide important business logic in special cases

---

## Registry

### Definition

**A well-known object that other objects can use to find common objects and services.**

### Purpose

Provide global access to frequently used objects without global variables.

### Example

```typescript
class ServiceRegistry {
  private static instance: ServiceRegistry;
  private services = new Map<string, any>();

  private constructor() {}

  static getInstance(): ServiceRegistry {
    if (!ServiceRegistry.instance) {
      ServiceRegistry.instance = new ServiceRegistry();
    }
    return ServiceRegistry.instance;
  }

  register<T>(key: string, service: T): void {
    this.services.set(key, service);
  }

  get<T>(key: string): T {
    const service = this.services.get(key);
    if (!service) {
      throw new Error(`Service not found: ${key}`);
    }
    return service as T;
  }

  has(key: string): boolean {
    return this.services.has(key);
  }

  clear(): void {
    this.services.clear();
  }
}

// Type-safe registry
class TypedRegistry {
  private static userRepository: UserRepository;
  private static orderRepository: OrderRepository;

  static setUserRepository(repo: UserRepository): void {
    this.userRepository = repo;
  }

  static getUserRepository(): UserRepository {
    if (!this.userRepository) {
      throw new Error('UserRepository not initialized');
    }
    return this.userRepository;
  }

  static setOrderRepository(repo: OrderRepository): void {
    this.orderRepository = repo;
  }

  static getOrderRepository(): OrderRepository {
    if (!this.orderRepository) {
      throw new Error('OrderRepository not initialized');
    }
    return this.orderRepository;
  }
}

// Usage
const registry = ServiceRegistry.getInstance();
registry.register('database', new PostgreSQLDatabase());
registry.register('logger', new ConsoleLogger());

const db = registry.get<Database>('database');
const logger = registry.get<Logger>('logger');

// Type-safe usage
TypedRegistry.setUserRepository(new PostgreSQLUserRepository());
const userRepo = TypedRegistry.getUserRepository();
```

### Best Practices

✅ **DO:**
- Use for truly global services
- Make thread-safe if needed
- Provide clear access methods
- Consider type-safe alternatives

❌ **DON'T:**
- Overuse (prefer dependency injection)
- Create multiple registries
- Use for business objects
- Make it a dumping ground

---

## Layer Supertype

### Definition

**A type that acts as the supertype for all types in its layer.**

### Purpose

Consolidate common behavior for all objects in a layer.

### Example

```typescript
// Domain layer supertype
abstract class Entity {
  constructor(public readonly id: string) {}

  equals(other: Entity): boolean {
    return this.id === other.id;
  }

  abstract validate(): void;
}

class User extends Entity {
  constructor(
    id: string,
    public name: string,
    public email: Email
  ) {
    super(id);
  }

  validate(): void {
    if (!this.name) {
      throw new ValidationError('Name is required');
    }
  }
}

class Order extends Entity {
  constructor(
    id: string,
    public customerId: string,
    public items: OrderItem[]
  ) {
    super(id);
  }

  validate(): void {
    if (this.items.length === 0) {
      throw new ValidationError('Order must have items');
    }
  }
}

// Repository layer supertype
abstract class Repository<T extends Entity> {
  constructor(protected db: Database) {}

  abstract findById(id: string): Promise<T | null>;

  async save(entity: T): Promise<void> {
    entity.validate(); // Common validation
    await this.doSave(entity);
  }

  protected abstract doSave(entity: T): Promise<void>;

  async delete(id: string): Promise<void> {
    await this.db.execute(
      `DELETE FROM ${this.getTableName()} WHERE id = $1`,
      [id]
    );
  }

  protected abstract getTableName(): string;
}

class UserRepository extends Repository<User> {
  async findById(id: string): Promise<User | null> {
    const row = await this.db.queryOne(
      'SELECT * FROM users WHERE id = $1',
      [id]
    );
    return row ? this.mapToUser(row) : null;
  }

  protected async doSave(user: User): Promise<void> {
    await this.db.execute(
      'INSERT INTO users (id, name, email) VALUES ($1, $2, $3) ON CONFLICT (id) DO UPDATE SET name = $2, email = $3',
      [user.id, user.name, user.email.toString()]
    );
  }

  protected getTableName(): string {
    return 'users';
  }

  private mapToUser(row: any): User {
    return new User(row.id, row.name, new Email(row.email));
  }
}
```

### Best Practices

✅ **DO:**
- Use for truly common behavior
- Keep layer supertypes focused
- Make abstract when appropriate
- Use for cross-cutting concerns

❌ **DON'T:**
- Create deep inheritance hierarchies
- Put layer-specific logic in supertype
- Force all classes to inherit

---

## Separated Interface

### Definition

**Define an interface in a separate package from its implementation to reduce coupling.**

### Purpose

Allow clients to depend on interfaces without depending on implementations.

### Example

```typescript
// domain/interfaces/repositories.ts (high-level package)
export interface UserRepository {
  findById(id: string): Promise<User | null>;
  findByEmail(email: string): Promise<User | null>;
  save(user: User): Promise<void>;
}

export interface OrderRepository {
  findById(id: string): Promise<Order | null>;
  findByCustomerId(customerId: string): Promise<Order[]>;
  save(order: Order): Promise<void>;
}

// domain/use-cases/create-order.ts (depends on interface)
import { UserRepository, OrderRepository } from '../interfaces/repositories';

export class CreateOrderUseCase {
  constructor(
    private userRepo: UserRepository,
    private orderRepo: OrderRepository
  ) {}

  async execute(request: CreateOrderRequest): Promise<Order> {
    const user = await this.userRepo.findById(request.userId);
    if (!user) {
      throw new Error('User not found');
    }

    const order = new Order(user.id, request.items);
    await this.orderRepo.save(order);
    return order;
  }
}

// infrastructure/repositories/postgresql-user-repository.ts (low-level package)
import { UserRepository } from '../../domain/interfaces/repositories';

export class PostgreSQLUserRepository implements UserRepository {
  async findById(id: string): Promise<User | null> {
    // PostgreSQL specific implementation
  }

  async findByEmail(email: string): Promise<User | null> {
    // PostgreSQL specific implementation
  }

  async save(user: User): Promise<void> {
    // PostgreSQL specific implementation
  }
}

// infrastructure/repositories/mongodb-user-repository.ts
import { UserRepository } from '../../domain/interfaces/repositories';

export class MongoDBUserRepository implements UserRepository {
  async findById(id: string): Promise<User | null> {
    // MongoDB specific implementation
  }

  // ... other methods
}

// main/composition-root.ts (wires everything together)
import { CreateOrderUseCase } from '../domain/use-cases/create-order';
import { PostgreSQLUserRepository } from '../infrastructure/repositories/postgresql-user-repository';
import { PostgreSQLOrderRepository } from '../infrastructure/repositories/postgresql-order-repository';

const userRepo = new PostgreSQLUserRepository(db);
const orderRepo = new PostgreSQLOrderRepository(db);
const createOrder = new CreateOrderUseCase(userRepo, orderRepo);
```

### Best Practices

✅ **DO:**
- Define interfaces in client package
- Use for dependency inversion
- Keep interfaces focused
- Support multiple implementations

❌ **DON'T:**
- Create interfaces for every class
- Put interfaces with implementations
- Over-abstract simple cases

---

## Plugin

### Definition

**Links classes during configuration rather than compilation to enable extension without modification.**

### Purpose

Allow behavior to be extended without modifying core code.

### Example

```typescript
// Plugin interface
interface ValidationPlugin {
  name: string;
  validate(user: User): ValidationResult;
}

// Core validator with plugin support
class UserValidator {
  private plugins: ValidationPlugin[] = [];

  registerPlugin(plugin: ValidationPlugin): void {
    this.plugins.push(plugin);
  }

  validate(user: User): ValidationResult {
    const results: ValidationResult[] = [];

    // Core validation
    if (!user.email) {
      results.push({ valid: false, message: 'Email is required' });
    }

    // Plugin validations
    for (const plugin of this.plugins) {
      const result = plugin.validate(user);
      results.push(result);
    }

    const allValid = results.every(r => r.valid);
    const messages = results.filter(r => !r.valid).map(r => r.message);

    return {
      valid: allValid,
      message: messages.join(', ')
    };
  }
}

// Plugin implementations
class PasswordStrengthPlugin implements ValidationPlugin {
  name = 'password-strength';

  validate(user: User): ValidationResult {
    if (user.password.length < 8) {
      return { valid: false, message: 'Password must be at least 8 characters' };
    }
    return { valid: true, message: '' };
  }
}

class EmailDomainPlugin implements ValidationPlugin {
  constructor(private allowedDomains: string[]) {}

  name = 'email-domain';

  validate(user: User): ValidationResult {
    const domain = user.email.getDomain();
    if (!this.allowedDomains.includes(domain)) {
      return { valid: false, message: `Email domain ${domain} not allowed` };
    }
    return { valid: true, message: '' };
  }
}

// Usage
const validator = new UserValidator();
validator.registerPlugin(new PasswordStrengthPlugin());
validator.registerPlugin(new EmailDomainPlugin(['company.com']));

const result = validator.validate(user);
```

### Plugin Discovery

```typescript
// Auto-discovery pattern
class PluginManager {
  private plugins = new Map<string, Plugin>();

  async loadPlugins(directory: string): Promise<void> {
    const files = await fs.readdir(directory);

    for (const file of files) {
      if (file.endsWith('.plugin.js')) {
        const pluginModule = await import(path.join(directory, file));
        const plugin = new pluginModule.default();
        this.plugins.set(plugin.name, plugin);
      }
    }
  }

  getPlugin(name: string): Plugin | undefined {
    return this.plugins.get(name);
  }

  getAllPlugins(): Plugin[] {
    return Array.from(this.plugins.values());
  }
}
```

### Best Practices

✅ **DO:**
- Define clear plugin interfaces
- Version plugin APIs
- Provide plugin lifecycle hooks
- Document plugin capabilities

❌ **DON'T:**
- Make plugins too complex
- Allow plugins to break core functionality
- Skip plugin validation
- Create tight coupling between plugins

---

## Mapper

### Definition

**An object that sets up communication between two independent objects.**

### Purpose

Convert between different representations of data (domain ↔ database, domain ↔ DTO).

### Example

```typescript
class UserMapper {
  toDomain(row: DatabaseRow): User {
    return new User(
      row.id,
      row.name,
      new Email(row.email),
      new Date(row.created_at)
    );
  }

  toDatabase(user: User): DatabaseRow {
    return {
      id: user.id,
      name: user.name,
      email: user.email.toString(),
      created_at: user.createdAt.toISOString()
    };
  }

  toDTO(user: User): UserDTO {
    return {
      id: user.id,
      name: user.name,
      email: user.email.toString(),
      memberSince: user.createdAt.toISOString()
    };
  }

  fromDTO(dto: CreateUserDTO): User {
    return new User(
      generateId(),
      dto.name,
      new Email(dto.email),
      new Date()
    );
  }
}

// Bidirectional mapper
class OrderMapper {
  constructor(
    private productRepo: ProductRepository,
    private customerRepo: CustomerRepository
  ) {}

  async toDomain(row: OrderRow, itemRows: OrderItemRow[]): Promise<Order> {
    const customer = await this.customerRepo.findById(row.customer_id);

    const items = await Promise.all(
      itemRows.map(async itemRow => {
        const product = await this.productRepo.findById(itemRow.product_id);
        return new OrderItem(product, itemRow.quantity);
      })
    );

    return new Order(row.id, customer, items, OrderStatus[row.status], new Date(row.created_at));
  }

  toDatabase(order: Order): { orderRow: OrderRow; itemRows: OrderItemRow[] } {
    const orderRow = {
      id: order.id,
      customer_id: order.customer.id,
      status: order.status.toString(),
      created_at: order.createdAt.toISOString()
    };

    const itemRows = order.items.map(item => ({
      order_id: order.id,
      product_id: item.product.id,
      quantity: item.quantity,
      price: item.price.cents
    }));

    return { orderRow, itemRows };
  }
}
```

### Best Practices

✅ **DO:**
- Create focused mappers
- Handle null/undefined gracefully
- Use for boundary crossings
- Keep mappers stateless

❌ **DON'T:**
- Put business logic in mappers
- Create circular dependencies
- Make mappers too generic

---

## Common Pitfalls

❌ **Primitive Obsession:** Using primitives instead of value objects
❌ **Null Everywhere:** Not using Special Case pattern
❌ **Service Locator Overuse:** Using registry instead of dependency injection
❌ **Deep Inheritance:** Creating complex layer supertype hierarchies
❌ **Tight Coupling:** Not using separated interfaces

## Key Takeaways

1. **Value Object:** Immutable objects defined by value, not identity
2. **Money:** Special value object for monetary values with currency
3. **Special Case:** Replace null checks with polymorphism
4. **Registry:** Global service access (use sparingly)
5. **Layer Supertype:** Consolidate common layer behavior
6. **Separated Interface:** Define interfaces separate from implementations
7. **Plugin:** Extend behavior without modification
8. **Mapper:** Convert between representations at boundaries
