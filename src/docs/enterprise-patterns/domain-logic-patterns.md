# Domain Logic Patterns

## Overview

Domain logic patterns organize the business logic that is the core of enterprise applications. Different patterns suit different levels of complexity.

## Pattern Selection Guide

| Pattern | Complexity | Database Integration | Testability | Best For |
|---------|-----------|---------------------|-------------|----------|
| Transaction Script | Low | Direct SQL | Low | Simple CRUD, reports |
| Table Module | Medium | Coupled | Medium | Table-centric logic |
| Domain Model | High | Separated | High | Complex business rules |
| Service Layer | Any | Abstraction | High | API boundaries |

---

## Transaction Script

### Definition

**Organize business logic through procedures, where each procedure handles a single request from the presentation.**

### Structure

Each business transaction becomes a procedure (function or method) that performs the complete operation.

### When to Use

✅ **Good For:**
- Simple applications with minimal business logic
- Applications where procedures map cleanly to database tables
- Quick prototypes or MVPs
- Reporting and data analysis tools

❌ **Not Ideal For:**
- Complex business rules with many variations
- Applications requiring high reusability
- Systems with complex object interactions

### Example

```typescript
class TransferMoneyScript {
  async execute(fromAccountId: string, toAccountId: string, amount: number) {
    // Start transaction
    const db = await Database.connect();
    await db.beginTransaction();

    try {
      // Get accounts
      const fromAccount = await db.query(
        'SELECT * FROM accounts WHERE id = ?',
        [fromAccountId]
      );
      const toAccount = await db.query(
        'SELECT * FROM accounts WHERE id = ?',
        [toAccountId]
      );

      // Business logic
      if (fromAccount.balance < amount) {
        throw new Error('Insufficient funds');
      }

      // Update balances
      await db.execute(
        'UPDATE accounts SET balance = balance - ? WHERE id = ?',
        [amount, fromAccountId]
      );
      await db.execute(
        'UPDATE accounts SET balance = balance + ? WHERE id = ?',
        [amount, toAccountId]
      );

      // Log transaction
      await db.execute(
        'INSERT INTO transactions (from_id, to_id, amount, date) VALUES (?, ?, ?, ?)',
        [fromAccountId, toAccountId, amount, new Date()]
      );

      await db.commit();
    } catch (error) {
      await db.rollback();
      throw error;
    }
  }
}
```

### Best Practices

✅ **DO:**
- Keep scripts focused on single operations
- Use database transactions appropriately
- Extract common code into utility functions
- Keep scripts stateless

❌ **DON'T:**
- Duplicate logic across multiple scripts
- Mix presentation logic with business logic
- Create overly complex procedural code
- Ignore database transaction boundaries

### Trade-offs

**Advantages:**
- Simple to understand
- Works well with procedural tools
- Minimal ceremony
- Direct database access

**Disadvantages:**
- Code duplication across scripts
- Difficult to maintain complex logic
- Poor reusability
- Tight coupling to database

---

## Table Module

### Definition

**A single instance that handles the business logic for all rows in a database table or view.**

### Structure

One class per table with methods that operate on multiple rows simultaneously.

### When to Use

✅ **Good For:**
- Record-set oriented platforms (.NET DataSet)
- Applications with table-centric operations
- Batch processing
- Systems where database tables drive design

❌ **Not Ideal For:**
- Object-oriented designs
- Complex object graphs
- Rich domain models

### Example

```typescript
class AccountModule {
  constructor(private recordSet: RecordSet) {}

  calculateTotalBalance(): number {
    let total = 0;
    for (const record of this.recordSet.rows) {
      total += record.balance;
    }
    return total;
  }

  applyInterest(rate: number): void {
    for (const record of this.recordSet.rows) {
      const interest = record.balance * rate;
      record.balance += interest;
    }
  }

  findOverdrawn(): RecordSet {
    return this.recordSet.filter(r => r.balance < 0);
  }

  static async load(db: Database): Promise<AccountModule> {
    const recordSet = await db.query('SELECT * FROM accounts');
    return new AccountModule(recordSet);
  }

  async save(db: Database): Promise<void> {
    for (const record of this.recordSet.rows) {
      if (record.isDirty) {
        await db.update('accounts', record);
      }
    }
  }
}
```

### Best Practices

✅ **DO:**
- Operate on multiple rows efficiently
- Use record-set abstractions
- Keep table modules stateless
- Combine with Table Data Gateway

❌ **DON'T:**
- Mix multiple tables in one module
- Create complex object relationships
- Use when rich object model is needed

### Trade-offs

**Advantages:**
- Natural fit for record-set platforms
- Batch operations efficient
- Clear table-to-code mapping

**Disadvantages:**
- Doesn't support rich object models
- Awkward for complex relationships
- Limited polymorphism

---

## Domain Model

### Definition

**An object model of the domain that incorporates both behavior and data.**

### Structure

Objects represent domain concepts with business logic encapsulated within them. Rich object graphs with inheritance, composition, and polymorphism.

### When to Use

✅ **Good For:**
- Complex business logic
- Applications with intricate business rules
- Long-term, evolving applications
- Object-oriented teams

❌ **Not Ideal For:**
- Simple CRUD applications
- Highly procedural systems
- Rapid prototypes (initially)

### Example

```typescript
class Account {
  constructor(
    private readonly id: string,
    private balance: Money,
    private overdraftLimit: Money
  ) {}

  withdraw(amount: Money): void {
    if (!this.canWithdraw(amount)) {
      throw new InsufficientFundsError(amount, this.availableBalance());
    }
    this.balance = this.balance.subtract(amount);
  }

  deposit(amount: Money): void {
    this.balance = this.balance.add(amount);
  }

  private canWithdraw(amount: Money): boolean {
    return this.availableBalance().isGreaterThanOrEqual(amount);
  }

  private availableBalance(): Money {
    return this.balance.add(this.overdraftLimit);
  }

  transfer(amount: Money, recipient: Account): void {
    this.withdraw(amount);
    recipient.deposit(amount);
  }
}

class PremiumAccount extends Account {
  constructor(id: string, balance: Money) {
    super(id, balance, new Money(5000, Currency.USD)); // Higher overdraft
  }

  // Premium accounts get cashback
  override withdraw(amount: Money): void {
    super.withdraw(amount);
    const cashback = amount.multiply(0.01); // 1% cashback
    this.deposit(cashback);
  }
}
```

### Best Practices

✅ **DO:**
- Use rich domain models with behavior
- Encapsulate business rules in domain objects
- Use value objects for concepts like Money
- Employ inheritance and polymorphism
- Separate domain from infrastructure

❌ **DON'T:**
- Create anemic domain models (just getters/setters)
- Mix persistence logic with domain logic
- Use domain objects as DTOs
- Let database schema drive domain design

### Trade-offs

**Advantages:**
- Handles complexity well
- Highly maintainable
- Excellent code reuse
- Supports sophisticated designs

**Disadvantages:**
- Steeper learning curve
- More initial development
- Requires O/R mapping
- Can be over-engineering for simple cases

---

## Service Layer

### Definition

**Defines an application's boundary with a layer of services that establishes available operations and coordinates application responses.**

### Structure

A set of operations (services) that define the application's API. Sits between presentation and domain layers.

### When to Use

✅ **Good For:**
- Multiple client types (web, mobile, API)
- Complex transaction control
- Security boundaries
- Remote access scenarios

❌ **Not Ideal For:**
- Very simple applications
- Single presentation layer
- When direct domain access suffices

### Example

```typescript
interface TransferMoneyRequest {
  fromAccountId: string;
  toAccountId: string;
  amount: number;
  currency: string;
}

interface TransferMoneyResponse {
  transactionId: string;
  newBalance: number;
  timestamp: Date;
}

class AccountService {
  constructor(
    private accountRepository: AccountRepository,
    private transactionRepository: TransactionRepository,
    private unitOfWork: UnitOfWork
  ) {}

  async transferMoney(request: TransferMoneyRequest): Promise<TransferMoneyResponse> {
    // Service orchestrates domain objects
    const fromAccount = await this.accountRepository.findById(request.fromAccountId);
    const toAccount = await this.accountRepository.findById(request.toAccountId);

    if (!fromAccount || !toAccount) {
      throw new AccountNotFoundError();
    }

    const amount = new Money(request.amount, request.currency);

    // Domain logic executed
    fromAccount.transfer(amount, toAccount);

    // Create transaction record
    const transaction = new Transaction(
      fromAccount.id,
      toAccount.id,
      amount,
      new Date()
    );

    // Coordinate persistence
    await this.accountRepository.save(fromAccount);
    await this.accountRepository.save(toAccount);
    await this.transactionRepository.save(transaction);
    await this.unitOfWork.commit();

    return {
      transactionId: transaction.id,
      newBalance: fromAccount.balance.amount,
      timestamp: transaction.date
    };
  }

  async getAccountBalance(accountId: string): Promise<number> {
    const account = await this.accountRepository.findById(accountId);
    if (!account) {
      throw new AccountNotFoundError();
    }
    return account.balance.amount;
  }
}
```

### Responsibilities

**Service Layer Should:**
- Define application operations
- Coordinate domain objects
- Manage transactions
- Handle security/authorization
- Provide API for presentation layer

**Service Layer Should NOT:**
- Contain business logic (that's in domain)
- Access database directly (use repositories)
- Know about UI concerns
- Duplicate domain logic

### Best Practices

✅ **DO:**
- Keep services thin (orchestration, not logic)
- Use DTOs for service boundaries
- Implement transaction boundaries at service level
- Make services stateless
- Design for remote invocation

❌ **DON'T:**
- Put business logic in services
- Create services for every domain object
- Mix service and domain responsibilities
- Create chatty interfaces with many calls

### Trade-offs

**Advantages:**
- Clear API boundary
- Multiple client support
- Transaction demarcation
- Security enforcement point
- Facade for complex operations

**Disadvantages:**
- Additional layer
- Risk of anemic domain if overused
- Can become procedural

---

## Combining Patterns

### Domain Model + Service Layer

```typescript
// Domain
class Order {
  private items: OrderItem[] = [];

  addItem(product: Product, quantity: number) {
    this.items.push(new OrderItem(product, quantity));
  }

  calculateTotal(): Money {
    return this.items.reduce(
      (sum, item) => sum.add(item.subtotal()),
      Money.zero()
    );
  }
}

// Service Layer
class OrderService {
  constructor(
    private orderRepo: OrderRepository,
    private productRepo: ProductRepository
  ) {}

  async createOrder(request: CreateOrderRequest): Promise<OrderResponse> {
    const order = new Order(request.customerId);

    for (const item of request.items) {
      const product = await this.productRepo.findById(item.productId);
      order.addItem(product, item.quantity);
    }

    await this.orderRepo.save(order);
    return { orderId: order.id, total: order.calculateTotal().amount };
  }
}
```

## Pattern Selection Decision Tree

```
Start
  ├─ Simple logic, SQL-focused? → Transaction Script
  ├─ Table-centric, batch operations? → Table Module
  ├─ Complex business rules? → Domain Model
  │   └─ Multiple clients or remote access? → + Service Layer
  └─ Need clear API boundary? → Service Layer
      └─ What underneath? → Choose from above
```

## Common Pitfalls

❌ **Anemic Domain Model:** Domain objects with no behavior (just data)
❌ **Fat Services:** All logic in service layer, domain just data
❌ **Wrong Pattern:** Using Domain Model for simple CRUD
❌ **No Separation:** Mixing scripts with presentation
❌ **Over-Layering:** Service layer with no real orchestration

## Key Takeaways

1. **Transaction Script:** Simple, procedural, direct SQL
2. **Table Module:** One class per table, batch operations
3. **Domain Model:** Rich objects, complex rules, OO design
4. **Service Layer:** API boundary, orchestration, transaction control
5. **Combine patterns** for best results (Domain Model + Service Layer)
