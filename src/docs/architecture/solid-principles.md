# SOLID Principles Guidelines

## Overview

SOLID is an acronym for five design principles that make software designs more understandable, flexible, and maintainable. Introduced by Robert C. Martin (Uncle Bob), these principles form the foundation of good object-oriented design.

## S - Single Responsibility Principle (SRP)

### Definition

**"A class should have one, and only one, reason to change."**

Each module, class, or function should have responsibility over a single part of functionality, and that responsibility should be entirely encapsulated by the class.

### Why It Matters

- **Maintainability:** Changes to one responsibility don't affect others
- **Testability:** Easier to test focused, single-purpose code
- **Understandability:** Clear, obvious purpose

### Examples

❌ **Violates SRP:**
```typescript
class User {
  constructor(public name: string, public email: string) {}

  save() {
    // Database logic
    const db = new Database();
    db.insert('users', this);
  }

  sendEmail(message: string) {
    // Email logic
    const mailer = new Mailer();
    mailer.send(this.email, message);
  }

  generateReport(): string {
    // Reporting logic
    return `User Report: ${this.name}`;
  }
}
```

**Problems:** Class has three reasons to change (database, email, reporting)

✅ **Follows SRP:**
```typescript
class User {
  constructor(public name: string, public email: string) {}
}

class UserRepository {
  save(user: User) {
    const db = new Database();
    db.insert('users', user);
  }
}

class EmailService {
  sendToUser(user: User, message: string) {
    const mailer = new Mailer();
    mailer.send(user.email, message);
  }
}

class UserReportGenerator {
  generate(user: User): string {
    return `User Report: ${user.name}`;
  }
}
```

### Best Practices

✅ **DO:**
- One class = one responsibility
- Extract cohesive functionality into separate classes
- Name classes after their single responsibility

❌ **DON'T:**
- Create "god objects" that do everything
- Mix business logic with infrastructure concerns
- Combine unrelated functionality

---

## O - Open/Closed Principle (OCP)

### Definition

**"Software entities should be open for extension but closed for modification."**

You should be able to add new functionality without changing existing code.

### Why It Matters

- **Stability:** Existing code doesn't break when adding features
- **Flexibility:** Easy to extend behavior
- **Risk Reduction:** Less chance of introducing bugs

### Examples

❌ **Violates OCP:**
```typescript
class PaymentProcessor {
  processPayment(type: string, amount: number) {
    if (type === 'credit-card') {
      // Process credit card
    } else if (type === 'paypal') {
      // Process PayPal
    } else if (type === 'bitcoin') {
      // Process Bitcoin - MODIFIED existing code
    }
  }
}
```

**Problem:** Adding new payment type requires modifying existing code

✅ **Follows OCP:**
```typescript
interface PaymentMethod {
  process(amount: number): Promise<PaymentResult>;
}

class CreditCardPayment implements PaymentMethod {
  async process(amount: number): Promise<PaymentResult> {
    // Credit card logic
  }
}

class PayPalPayment implements PaymentMethod {
  async process(amount: number): Promise<PaymentResult> {
    // PayPal logic
  }
}

class BitcoinPayment implements PaymentMethod {
  async process(amount: number): Promise<PaymentResult> {
    // Bitcoin logic - NEW class, no modification
  }
}

class PaymentProcessor {
  constructor(private method: PaymentMethod) {}

  async process(amount: number): Promise<PaymentResult> {
    return this.method.process(amount);
  }
}
```

### Best Practices

✅ **DO:**
- Use interfaces and abstract classes
- Employ strategy pattern for variation
- Use dependency injection
- Design for extension points

❌ **DON'T:**
- Use long if/else or switch statements for type checking
- Modify existing classes for new behavior
- Hard-code dependencies

---

## L - Liskov Substitution Principle (LSP)

### Definition

**"Subtypes must be substitutable for their base types without altering program correctness."**

If S is a subtype of T, then objects of type T can be replaced with objects of type S without breaking the program.

### Why It Matters

- **Polymorphism:** True object-oriented behavior
- **Reliability:** Subtypes honor base type contracts
- **Predictability:** No surprising behavior changes

### Examples

❌ **Violates LSP:**
```typescript
class Rectangle {
  constructor(protected width: number, protected height: number) {}

  setWidth(width: number) {
    this.width = width;
  }

  setHeight(height: number) {
    this.height = height;
  }

  getArea(): number {
    return this.width * this.height;
  }
}

class Square extends Rectangle {
  setWidth(width: number) {
    this.width = width;
    this.height = width; // Violates expectation
  }

  setHeight(height: number) {
    this.width = height; // Violates expectation
    this.height = height;
  }
}

// This breaks LSP
function resize(rectangle: Rectangle) {
  rectangle.setWidth(5);
  rectangle.setHeight(4);
  console.log(rectangle.getArea()); // Expects 20
}

resize(new Square(3)); // Outputs 16, not 20!
```

✅ **Follows LSP:**
```typescript
interface Shape {
  getArea(): number;
}

class Rectangle implements Shape {
  constructor(private width: number, private height: number) {}

  getArea(): number {
    return this.width * this.height;
  }
}

class Square implements Shape {
  constructor(private size: number) {}

  getArea(): number {
    return this.size * this.size;
  }
}
```

### Best Practices

✅ **DO:**
- Ensure derived classes honor base class contracts
- Validate that subtypes can replace base types
- Avoid strengthening preconditions in subtypes
- Avoid weakening postconditions in subtypes

❌ **DON'T:**
- Override methods to do nothing or throw errors
- Change expected behavior in subtypes
- Break base class invariants
- Use inheritance for code reuse only

---

## I - Interface Segregation Principle (ISP)

### Definition

**"Clients should not be forced to depend on interfaces they don't use."**

Many specific interfaces are better than one general-purpose interface.

### Why It Matters

- **Cohesion:** Interfaces represent specific capabilities
- **Flexibility:** Easier to implement small interfaces
- **Decoupling:** Clients depend only on what they need

### Examples

❌ **Violates ISP:**
```typescript
interface Worker {
  work(): void;
  eat(): void;
  sleep(): void;
}

class Human implements Worker {
  work() { /* ... */ }
  eat() { /* ... */ }
  sleep() { /* ... */ }
}

class Robot implements Worker {
  work() { /* ... */ }
  eat() { throw new Error('Robots don\'t eat'); } // Forced to implement
  sleep() { throw new Error('Robots don\'t sleep'); } // Forced to implement
}
```

✅ **Follows ISP:**
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
  work() { /* ... */ }
  eat() { /* ... */ }
  sleep() { /* ... */ }
}

class Robot implements Workable {
  work() { /* ... */ }
  // Only implements what it needs
}
```

### Best Practices

✅ **DO:**
- Create focused, cohesive interfaces
- Use interface composition
- Design interfaces from client perspective
- Keep interfaces small

❌ **DON'T:**
- Create fat interfaces with many methods
- Force implementations to throw "not implemented" errors
- Add methods to interfaces that only some implementers need

---

## D - Dependency Inversion Principle (DIP)

### Definition

**"High-level modules should not depend on low-level modules. Both should depend on abstractions."**

**"Abstractions should not depend on details. Details should depend on abstractions."**

### Why It Matters

- **Flexibility:** Easy to swap implementations
- **Testability:** Easy to mock dependencies
- **Decoupling:** High-level policy independent of details

### Examples

❌ **Violates DIP:**
```typescript
class MySQLDatabase {
  save(data: any) {
    // MySQL specific code
  }
}

class UserService {
  private database = new MySQLDatabase(); // Direct dependency

  saveUser(user: User) {
    this.database.save(user);
  }
}
```

**Problem:** UserService tightly coupled to MySQL

✅ **Follows DIP:**
```typescript
interface Database {
  save(data: any): void;
}

class MySQLDatabase implements Database {
  save(data: any) {
    // MySQL specific code
  }
}

class PostgreSQLDatabase implements Database {
  save(data: any) {
    // PostgreSQL specific code
  }
}

class UserService {
  constructor(private database: Database) {} // Depends on abstraction

  saveUser(user: User) {
    this.database.save(user);
  }
}

// Composition root
const database = new MySQLDatabase();
const userService = new UserService(database);
```

### Best Practices

✅ **DO:**
- Define interfaces in high-level modules
- Inject dependencies through constructors
- Depend on abstractions, not concretions
- Use dependency injection containers

❌ **DON'T:**
- Use `new` keyword in business logic
- Hard-code dependencies
- Let abstractions depend on implementation details
- Create dependencies on concrete classes

---

## Applying SOLID Together

### Real-World Example

```typescript
// Domain (high-level)
interface OrderRepository {
  save(order: Order): Promise<void>;
  findById(id: string): Promise<Order | null>;
}

interface PaymentGateway {
  charge(amount: Money): Promise<PaymentResult>;
}

// Use Case (high-level, depends on abstractions - DIP)
class CreateOrderUseCase {
  constructor(
    private orderRepo: OrderRepository, // ISP - focused interface
    private paymentGateway: PaymentGateway // ISP - focused interface
  ) {}

  async execute(request: CreateOrderRequest): Promise<OrderResult> { // SRP - one responsibility
    const order = Order.create(request.items); // OCP - extend through new Orders
    const payment = await this.paymentGateway.charge(order.total);

    if (payment.successful) {
      await this.orderRepo.save(order);
      return { success: true, orderId: order.id };
    }

    return { success: false, error: 'Payment failed' };
  }
}

// Infrastructure (low-level, implements abstractions - DIP, LSP)
class PostgreSQLOrderRepository implements OrderRepository {
  async save(order: Order): Promise<void> {
    // PostgreSQL implementation
  }

  async findById(id: string): Promise<Order | null> {
    // PostgreSQL implementation
  }
}

class StripePaymentGateway implements PaymentGateway {
  async charge(amount: Money): Promise<PaymentResult> {
    // Stripe implementation
  }
}
```

## Benefits of SOLID

✅ **Maintainability:** Easier to understand and modify
✅ **Testability:** Easier to write unit tests
✅ **Flexibility:** Easy to extend and adapt
✅ **Reusability:** Components can be reused
✅ **Scalability:** Architecture supports growth
✅ **Collaboration:** Clear boundaries and contracts

## Common Pitfalls

❌ Over-engineering simple solutions
❌ Creating abstractions prematurely
❌ Too many small classes (analysis paralysis)
❌ Violating principles in the name of "pragmatism"
❌ Not refactoring when violations accumulate
❌ Treating SOLID as dogma rather than guidelines

## When to Apply SOLID

✅ **Always Consider:**
- SRP when designing classes
- OCP when identifying variation points
- DIP for major dependencies

⚠️ **Apply Judiciously:**
- LSP if using inheritance
- ISP if interfaces grow large
- Full SOLID in complex domains

❌ **Don't Over-Apply:**
- Simple scripts or utilities
- Prototypes or experiments
- Very stable, simple code

## Key Takeaways

1. **SRP:** One class, one responsibility
2. **OCP:** Extend behavior without modifying code
3. **LSP:** Subtypes must be substitutable
4. **ISP:** Prefer many small interfaces
5. **DIP:** Depend on abstractions, not concretions

**Remember:** SOLID principles are guidelines, not laws. Apply them thoughtfully based on context and complexity.
