# Domain-Driven Design (DDD) Guidelines

## Overview

Domain-Driven Design is a strategic approach to developing software for complex domains. It emphasizes collaboration between technical and domain experts, focusing on a shared understanding of the problem space.

## Core Concepts

### Ubiquitous Language

**Definition:** A common language shared by developers and domain experts, used consistently in code, conversations, and documentation.

**Purpose:**
- Eliminate translation between technical and business terminology
- Reduce misunderstandings
- Make code more expressive and maintainable

**Best Practices:**
✅ Use domain terms in class/method names
✅ Avoid technical jargon when business terms exist
✅ Update code when language evolves
✅ Document terms in a glossary

❌ Don't use generic names (Manager, Handler, Processor)
❌ Don't create technical abstractions that obscure domain concepts

### Bounded Context

**Definition:** A boundary within which a particular model is defined and applicable. Each context maintains its own unified model and ubiquitous language.

**Purpose:**
- Divide large systems into manageable sections
- Recognize that total unification isn't feasible or cost-effective
- Maintain model integrity within boundaries

**Identifying Boundaries:**
- Human culture and language differences
- Organizational structure and team communication patterns
- Technical representation differences
- Conceptual distinctions within the domain

**Example:**
In an electricity utility:
- "Meter" in customer service = customer relationship
- "Meter" in field operations = physical equipment
- "Meter" in billing = usage recording device

These are different bounded contexts.

### Context Mapping

**Definition:** Mechanisms to translate between different Bounded Contexts that share common concepts but model them distinctly.

**Patterns:**

**Shared Kernel:**
- Two contexts share a subset of the domain model
- Requires coordination between teams
- Changes require mutual agreement

**Customer-Supplier:**
- Downstream context depends on upstream
- Upstream team provides what downstream needs
- Clear customer-supplier relationship

**Conformist:**
- Downstream conforms to upstream model
- Used when upstream won't accommodate changes
- Reduces integration complexity

**Anti-Corruption Layer:**
- Isolate your model from external systems
- Translate between your model and external concepts
- Protects domain purity

**Open Host Service:**
- Define protocol for accessing your subsystem
- Often REST API or message-based integration
- Make it easy for other contexts to integrate

**Published Language:**
- Well-documented shared language between contexts
- Often XML schemas or JSON formats
- Reduces coupling through standardization

## Strategic Design

### Core Domain

**Definition:** The primary area of focus that provides competitive advantage.

**Characteristics:**
- Most valuable to the business
- Requires best developers and attention
- Custom-built, not purchased
- Where innovation happens

**Investment Strategy:**
Invest heavily in core domain with:
- Best team members
- Most time and resources
- Sophisticated modeling
- Rich ubiquitous language

### Supporting Subdomain

**Definition:** Necessary but not core to competitive advantage.

**Characteristics:**
- Important but not differentiating
- May be purchased or built simply
- Less modeling sophistication needed

### Generic Subdomain

**Definition:** Common functionality without business differentiation.

**Characteristics:**
- Solved problems (auth, logging, email)
- Should use off-the-shelf solutions
- Minimal custom development
- Don't waste effort here

## Tactical Design Patterns

### Entities

**Definition:** Objects with identity that persists over time.

**Characteristics:**
- Defined by identity, not attributes
- Mutable
- Continuity through lifecycle

```typescript
class Order {
  constructor(
    private readonly id: OrderId,
    private items: OrderItem[],
    private status: OrderStatus
  ) {}

  addItem(item: OrderItem) {
    if (this.status !== OrderStatus.Draft) {
      throw new Error('Cannot modify confirmed order');
    }
    this.items.push(item);
  }
}
```

### Value Objects

**Definition:** Objects defined by their attributes with no conceptual identity.

**Characteristics:**
- Immutable
- Defined by values, not identity
- Can be freely replaced
- Often shared

```typescript
class Money {
  constructor(
    readonly amount: number,
    readonly currency: Currency
  ) {}

  add(other: Money): Money {
    if (this.currency !== other.currency) {
      throw new Error('Currency mismatch');
    }
    return new Money(this.amount + other.amount, this.currency);
  }
}
```

### Aggregates

**Definition:** Cluster of entities and value objects with defined boundary and root entity.

**Characteristics:**
- Root entity controls access
- Maintains invariants
- Unit of consistency
- Transaction boundary

```typescript
class Order {
  private items: OrderItem[] = [];

  addItem(product: Product, quantity: number) {
    // Aggregate ensures invariants
    if (this.totalItems() + quantity > MAX_ITEMS) {
      throw new Error('Too many items');
    }

    const item = new OrderItem(product, quantity);
    this.items.push(item);
  }

  // Only Order can modify its items
  private totalItems(): number {
    return this.items.reduce((sum, item) => sum + item.quantity, 0);
  }
}
```

### Domain Events

**Definition:** Something that happened in the domain that domain experts care about.

**Characteristics:**
- Past tense naming (OrderPlaced, PaymentReceived)
- Immutable
- Carries relevant information
- May trigger side effects

```typescript
class OrderPlacedEvent {
  constructor(
    readonly orderId: OrderId,
    readonly customerId: CustomerId,
    readonly total: Money,
    readonly occurredAt: Date
  ) {}
}
```

### Repositories

**Definition:** Provides illusion of in-memory collection of aggregates.

**Characteristics:**
- Persistence abstraction
- Works with aggregate roots only
- Provides query methods

```typescript
interface OrderRepository {
  findById(id: OrderId): Promise<Order | null>;
  save(order: Order): Promise<void>;
  findByCustomer(customerId: CustomerId): Promise<Order[]>;
}
```

### Domain Services

**Definition:** Operations that don't naturally fit within entities or value objects.

**Characteristics:**
- Stateless
- Operates on domain objects
- Captures domain concepts

```typescript
class TransferMoneyService {
  transfer(from: Account, to: Account, amount: Money) {
    from.withdraw(amount);
    to.deposit(amount);
    // Coordinates between aggregates
  }
}
```

## Best Practices

### Model-Driven Design

✅ **DO:**
- Model reflects domain expert knowledge
- Use ubiquitous language in code
- Iterate model with domain experts
- Refactor toward deeper insight

❌ **DON'T:**
- Let database schema drive model
- Use anemic domain models (just getters/setters)
- Separate model from implementation
- Create models in isolation from domain experts

### Aggregate Design

✅ **DO:**
- Keep aggregates small
- Reference other aggregates by ID only
- Use eventual consistency between aggregates
- Enforce invariants within aggregate

❌ **DON'T:**
- Create large aggregates with nested entities
- Hold references to other aggregate roots
- Require immediate consistency across aggregates
- Put unrelated concepts in same aggregate

### Bounded Context Integration

✅ **DO:**
- Make boundaries explicit
- Use context maps
- Implement anti-corruption layers
- Publish integration events

❌ **DON'T:**
- Share domain model code between contexts
- Assume same concepts mean same things
- Create tight coupling between contexts
- Ignore context boundaries

## Common Pitfalls

❌ **Anemic Domain Models:** Just data structures with no behavior
❌ **God Objects:** Aggregates that do everything
❌ **Ignoring Context Boundaries:** One model to rule them all
❌ **Technical Abstractions:** Generic, meaningless names
❌ **Premature Patterns:** Applying DDD to simple CRUD
❌ **Isolating Developers:** Not collaborating with domain experts

## When to Use DDD

✅ **Good For:**
- Complex business domains
- Long-lived applications
- Domains with ambiguous or evolving rules
- Projects where domain understanding is competitive advantage

❌ **Not Needed For:**
- Simple CRUD applications
- Technical/infrastructure systems
- Well-understood commodity domains
- Short-lived prototypes

## Continuous Learning

DDD is a journey of continuous discovery:
- Regular conversations with domain experts
- Refactoring toward deeper insight
- Evolving ubiquitous language
- Discovering implicit concepts
- Clarifying boundaries
