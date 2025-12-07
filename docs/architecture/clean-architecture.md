# Clean Architecture Guidelines

## Overview

Clean Architecture, introduced by Robert C. Martin (Uncle Bob), is an architectural pattern that emphasizes separation of concerns through layers with strict dependency rules. The core principle: **dependencies point inward toward business logic**.

## Core Principles

### The Dependency Rule

**Source code dependencies must point only inward, toward higher-level policies.**

- Outer circles are mechanisms
- Inner circles are policies
- Inner circles know nothing about outer circles
- Data formats from outer circles must not be used by inner circles

### Circles of Clean Architecture

**From Outside to Inside:**

1. **Frameworks & Drivers** (outermost)
   - UI, Database, Web, External Interfaces
   - Details that change frequently

2. **Interface Adapters**
   - Controllers, Presenters, Gateways
   - Convert data between use cases and external formats

3. **Application Business Rules**
   - Use Cases / Interactors
   - Application-specific business rules

4. **Enterprise Business Rules** (innermost)
   - Entities
   - Enterprise-wide business rules
   - Most stable, least likely to change

## Layer Responsibilities

### Entities (Enterprise Business Rules)

**What They Are:**
- Core business objects
- Encapsulate enterprise-wide critical rules
- Least likely to change when something external changes

**Characteristics:**
- No dependencies on anything
- Pure business logic
- Can be used across many applications

```typescript
class Loan {
  constructor(
    private principal: Money,
    private rate: InterestRate,
    private term: Term
  ) {}

  calculateMonthlyPayment(): Money {
    // Pure business calculation
    const monthlyRate = this.rate.monthly();
    const months = this.term.inMonths();
    return this.principal.monthlyPayment(monthlyRate, months);
  }
}
```

### Use Cases (Application Business Rules)

**What They Are:**
- Application-specific business rules
- Orchestrate flow of data to/from entities
- Direct entities to use enterprise rules

**Characteristics:**
- Depend only on entities
- Independent of UI, database, frameworks
- Changes to use cases don't affect entities

```typescript
interface CreateOrderUseCase {
  execute(request: CreateOrderRequest): Promise<CreateOrderResponse>;
}

class CreateOrder implements CreateOrderUseCase {
  constructor(
    private orderRepository: OrderRepository,
    private paymentGateway: PaymentGateway
  ) {}

  async execute(request: CreateOrderRequest): Promise<CreateOrderResponse> {
    // Application orchestration logic
    const order = new Order(request.items);
    const payment = await this.paymentGateway.process(order.total);

    if (payment.successful) {
      await this.orderRepository.save(order);
      return { orderId: order.id, status: 'confirmed' };
    }

    return { orderId: null, status: 'payment-failed' };
  }
}
```

### Interface Adapters

**What They Are:**
- Convert data between use case and external world formats
- Controllers, Presenters, Gateways

**Characteristics:**
- Depend on use cases, not on frameworks
- Transform external data to use case format
- Transform use case results to external format

```typescript
class OrderController {
  constructor(private createOrderUseCase: CreateOrderUseCase) {}

  async handleRequest(httpRequest: HttpRequest): Promise<HttpResponse> {
    // Adapt HTTP to use case
    const request: CreateOrderRequest = {
      items: httpRequest.body.items.map(item => ({
        productId: item.id,
        quantity: item.qty
      }))
    };

    const response = await this.createOrderUseCase.execute(request);

    // Adapt use case result to HTTP
    return {
      status: response.status === 'confirmed' ? 200 : 400,
      body: { orderId: response.orderId }
    };
  }
}
```

### Frameworks & Drivers

**What They Are:**
- External tools, frameworks, databases
- Web framework, database, UI framework

**Characteristics:**
- Outermost layer
- Details that can be swapped
- Glue code connecting to inner layers

## Dependency Inversion

### The Problem

Higher-level policies shouldn't depend on lower-level details.

❌ **Wrong Direction:**
```typescript
class OrderService {
  async createOrder(data: any) {
    const db = new PostgreSQLDatabase(); // Direct dependency
    await db.save(data);
  }
}
```

### The Solution

Define interfaces in inner layers, implement in outer layers.

✅ **Correct Direction:**
```typescript
// Inner layer defines interface
interface OrderRepository {
  save(order: Order): Promise<void>;
}

// Use case depends on abstraction
class CreateOrderUseCase {
  constructor(private repository: OrderRepository) {}

  async execute(request: CreateOrderRequest) {
    const order = new Order(request);
    await this.repository.save(order); // Depends on abstraction
  }
}

// Outer layer implements interface
class PostgreSQLOrderRepository implements OrderRepository {
  async save(order: Order): Promise<void> {
    // PostgreSQL specific implementation
  }
}
```

## Best Practices

### Independent of Frameworks

✅ **Framework as Tool:**
- Use frameworks, don't marry them
- Business logic doesn't depend on framework existence
- Can change frameworks without rewriting business logic

❌ **Framework as Architecture:**
- Don't inherit from framework base classes in business logic
- Don't let framework dictate your architecture

### Independent of UI

✅ **UI Agnostic:**
- Business logic works with any UI
- Same use cases for web, mobile, CLI, API
- UI is a plugin to business logic

❌ **UI Coupled:**
- Business logic in controllers or views
- Different logic for different UIs

### Independent of Database

✅ **Storage Agnostic:**
- Business rules don't care about storage
- Can swap databases without changing use cases
- Database is a detail, not a dependency

❌ **Database Coupled:**
- Business logic depends on SQL or ORM
- Domain objects are database entities

### Testable

✅ **Easy Testing:**
- Test business rules without UI, database, web server
- Test use cases with mocked repositories
- Test entities with pure unit tests

❌ **Hard Testing:**
- Need to spin up database for unit tests
- Need to start web server for logic tests
- Can't test without external dependencies

## Folder Structure Example

```
src/
├── domain/                 # Enterprise Business Rules
│   ├── entities/
│   │   ├── Order.ts
│   │   └── Customer.ts
│   └── value-objects/
│       ├── Money.ts
│       └── Email.ts
├── application/           # Application Business Rules
│   ├── use-cases/
│   │   ├── CreateOrder.ts
│   │   └── GetOrderHistory.ts
│   └── ports/            # Interfaces (ports)
│       ├── OrderRepository.ts
│       └── PaymentGateway.ts
├── adapters/             # Interface Adapters
│   ├── controllers/
│   │   └── OrderController.ts
│   ├── presenters/
│   │   └── OrderPresenter.ts
│   └── gateways/
│       └── StripePaymentGateway.ts
├── infrastructure/       # Frameworks & Drivers
│   ├── database/
│   │   └── PostgreSQLOrderRepository.ts
│   ├── web/
│   │   └── ExpressServer.ts
│   └── config/
│       └── AppConfig.ts
└── main/                 # Composition Root
    └── index.ts          # Wire everything together
```

## Crossing Boundaries

### Data Transfer Objects (DTOs)

Use simple data structures to cross boundaries:

```typescript
// Use case request (adapter → use case)
interface CreateOrderRequest {
  customerId: string;
  items: Array<{
    productId: string;
    quantity: number;
  }>;
}

// Use case response (use case → adapter)
interface CreateOrderResponse {
  orderId: string;
  status: 'confirmed' | 'payment-failed';
  total: number;
}
```

### Avoid Passing Entities

❌ **Don't:**
```typescript
// Don't pass domain entities across boundaries
function handleHttpRequest(req): Order {
  return createOrder(req); // Returns entity
}
```

✅ **Do:**
```typescript
// Use DTOs at boundaries
function handleHttpRequest(req): OrderDTO {
  const order = createOrder(req);
  return toDTO(order); // Convert to DTO
}
```

## Common Pitfalls

❌ **Leaking Abstractions:** Database models leaking into use cases
❌ **God Use Cases:** Single use case doing everything
❌ **Anemic Domain:** All logic in use cases, entities are just data
❌ **Framework Coupling:** Inheriting from framework classes in domain
❌ **Skipping Layers:** Controllers directly accessing repositories
❌ **Wrong Dependencies:** Use cases depending on infrastructure

## When to Use Clean Architecture

✅ **Good For:**
- Long-lived applications
- Complex business domains
- Applications requiring high testability
- Projects where business rules change frequently
- Systems with multiple UIs or integration points

❌ **Overkill For:**
- Simple CRUD applications
- Prototypes or short-lived experiments
- Small microservices with trivial logic
- Applications with stable, simple requirements

## Benefits

✅ Independent of frameworks
✅ Testable business logic
✅ Independent of UI
✅ Independent of database
✅ Independent of external agencies
✅ Screaming architecture (intent is clear)
✅ Easy to understand and reason about
✅ Supports multiple UIs and databases

## Trade-offs

⚠️ More files and indirection
⚠️ Initial development may feel slower
⚠️ Requires discipline to maintain boundaries
⚠️ May be over-engineering for simple domains
⚠️ Team must understand the pattern

## Key Takeaways

1. **Dependencies point inward** - This is non-negotiable
2. **Business rules at center** - Isolated from details
3. **Frameworks are details** - Use, don't depend on
4. **Testability is paramount** - Test without external dependencies
5. **Screaming architecture** - Purpose is obvious from structure
