# Data Access Patterns

## Overview

Data access patterns manage the interaction between domain objects and databases, solving the object-relational impedance mismatch.

## Pattern Selection Guide

| Pattern | Coupling | Complexity | Testability | Best For |
|---------|----------|-----------|-------------|----------|
| Active Record | High | Low | Medium | Simple domains |
| Data Mapper | Low | High | High | Complex domains |
| Repository | Low | Medium | High | Clean architecture |
| Table Data Gateway | Medium | Low | Medium | Procedural code |
| Row Data Gateway | Medium | Low | Medium | Simple objects |

---

## Repository

### Definition

**Mediates between the domain and data mapping layers using a collection-like interface for accessing domain objects.**

### Purpose

Provides an abstraction over data access, allowing domain code to work with objects through a simple collection interface.

### When to Use

✅ **Good For:**
- Domain-driven design
- Clean architecture
- Complex querying needs
- Testable code
- Multiple data sources

❌ **Not Ideal For:**
- Very simple CRUD
- Highly procedural code
- Direct SQL requirements

### Example

```typescript
interface UserRepository {
  findById(id: string): Promise<User | null>;
  findByEmail(email: string): Promise<User | null>;
  findAll(): Promise<User[]>;
  save(user: User): Promise<void>;
  delete(user: User): Promise<void>;
}

class PostgreSQLUserRepository implements UserRepository {
  constructor(private db: Database) {}

  async findById(id: string): Promise<User | null> {
    const row = await this.db.queryOne(
      'SELECT * FROM users WHERE id = $1',
      [id]
    );

    return row ? this.mapToUser(row) : null;
  }

  async findByEmail(email: string): Promise<User | null> {
    const row = await this.db.queryOne(
      'SELECT * FROM users WHERE email = $1',
      [email]
    );

    return row ? this.mapToUser(row) : null;
  }

  async save(user: User): Promise<void> {
    const exists = await this.findById(user.id);

    if (exists) {
      await this.db.execute(
        'UPDATE users SET name = $1, email = $2 WHERE id = $3',
        [user.name, user.email, user.id]
      );
    } else {
      await this.db.execute(
        'INSERT INTO users (id, name, email) VALUES ($1, $2, $3)',
        [user.id, user.name, user.email]
      );
    }
  }

  private mapToUser(row: any): User {
    return new User(row.id, row.name, row.email);
  }
}
```

### Best Practices

✅ **DO:**
- Return domain objects, not data structures
- Use collection-like interface (findAll, findById)
- Keep repositories focused on single aggregate root
- Use specification pattern for complex queries
- Make repositories interfaces (program to abstraction)

❌ **DON'T:**
- Expose database details
- Return DTOs from repositories
- Create generic repositories for all entities
- Put business logic in repositories
- Leak query objects into domain layer

### Specification Pattern with Repository

```typescript
interface Specification<T> {
  isSatisfiedBy(entity: T): boolean;
  toSql(): { where: string; params: any[] };
}

class ActiveUserSpecification implements Specification<User> {
  isSatisfiedBy(user: User): boolean {
    return user.isActive;
  }

  toSql() {
    return {
      where: 'is_active = $1',
      params: [true]
    };
  }
}

interface UserRepository {
  find(spec: Specification<User>): Promise<User[]>;
}

// Usage
const activeUsers = await userRepo.find(new ActiveUserSpecification());
```

---

## Data Mapper

### Definition

**A layer of mappers that moves data between objects and a database while keeping them independent of each other.**

### Purpose

Complete separation between domain objects and database. Domain knows nothing about persistence.

### When to Use

✅ **Good For:**
- Rich domain models
- Complex object graphs
- Domain-driven design
- When domain and schema differ significantly

❌ **Not Ideal For:**
- Simple CRUD applications
- Schemas that closely match objects
- Small applications

### Example

```typescript
class User {
  constructor(
    public readonly id: string,
    private name: string,
    private email: Email
  ) {}

  changeName(newName: string) {
    this.name = newName;
  }

  // No database awareness
}

class UserMapper {
  constructor(private db: Database) {}

  async find(id: string): Promise<User | null> {
    const row = await this.db.queryOne(
      'SELECT u.*, e.address FROM users u JOIN emails e ON u.email_id = e.id WHERE u.id = $1',
      [id]
    );

    if (!row) return null;

    return new User(
      row.id,
      row.name,
      new Email(row.address)
    );
  }

  async insert(user: User): Promise<void> {
    // Complex mapping logic
    const emailId = await this.insertEmail(user.email);

    await this.db.execute(
      'INSERT INTO users (id, name, email_id) VALUES ($1, $2, $3)',
      [user.id, user.name, emailId]
    );
  }

  async update(user: User): Promise<void> {
    await this.updateEmail(user.email);

    await this.db.execute(
      'UPDATE users SET name = $1 WHERE id = $2',
      [user.name, user.id]
    );
  }

  private async insertEmail(email: Email): Promise<string> {
    const id = generateId();
    await this.db.execute(
      'INSERT INTO emails (id, address) VALUES ($1, $2)',
      [id, email.address]
    );
    return id;
  }
}
```

### Best Practices

✅ **DO:**
- Keep domain objects persistence ignorant
- Handle complex object graphs
- Map between different schemas
- Use metadata for configuration
- Separate mapper from domain

❌ **DON'T:**
- Mix mapper logic with domain logic
- Create circular dependencies
- Ignore lazy loading strategies
- Map every property manually if ORM available

---

## Active Record

### Definition

**An object that wraps a row in a database table, encapsulates database access, and adds domain logic on that data.**

### Purpose

Combine data and behavior in a single class that knows how to persist itself.

### When to Use

✅ **Good For:**
- Simple domain logic
- Objects that map closely to database tables
- Rapid development
- Ruby on Rails, Laravel style apps

❌ **Not Ideal For:**
- Complex domain models
- When domain and schema differ significantly
- Test-driven development (harder to test)

### Example

```typescript
class User extends ActiveRecord {
  id: string;
  name: string;
  email: string;

  static async find(id: string): Promise<User | null> {
    const row = await this.db.queryOne(
      'SELECT * FROM users WHERE id = $1',
      [id]
    );

    if (!row) return null;

    const user = new User();
    user.id = row.id;
    user.name = row.name;
    user.email = row.email;
    return user;
  }

  async save(): Promise<void> {
    if (await User.find(this.id)) {
      await this.db.execute(
        'UPDATE users SET name = $1, email = $2 WHERE id = $3',
        [this.name, this.email, this.id]
      );
    } else {
      await this.db.execute(
        'INSERT INTO users (id, name, email) VALUES ($1, $2, $3)',
        [this.id, this.name, this.email]
      );
    }
  }

  async delete(): Promise<void> {
    await this.db.execute('DELETE FROM users WHERE id = $1', [this.id]);
  }

  // Domain logic mixed with persistence
  async sendWelcomeEmail(): Promise<void> {
    const mailer = new Mailer();
    await mailer.send(this.email, 'Welcome!');
    // Could also update database
    this.emailSent = true;
    await this.save();
  }
}

// Usage
const user = await User.find('123');
user.name = 'New Name';
await user.save();
```

### Best Practices

✅ **DO:**
- Use for simple domains
- Keep database logic in base class
- Use for rapid prototyping
- Leverage framework support (TypeORM, Sequelize)

❌ **DON'T:**
- Use for complex domains
- Mix too much business logic with persistence
- Use when domain model complex
- Ignore testability issues

### Trade-offs

**Advantages:**
- Simple and intuitive
- Less code
- Rapid development
- Good framework support

**Disadvantages:**
- Tight coupling to database
- Harder to test
- Domain depends on infrastructure
- Not suitable for complex domains

---

## Unit of Work

### Definition

**Maintains a list of objects affected by a business transaction and coordinates writing out changes and resolving concurrency problems.**

### Purpose

Track all changes in a transaction and commit them together, ensuring consistency.

### When to Use

✅ **Good For:**
- Complex transactions affecting multiple objects
- Managing database transactions
- Batch updates
- Optimizing database calls

❌ **Not Ideal For:**
- Simple single-object updates
- Read-only operations
- Stateless services

### Example

```typescript
class UnitOfWork {
  private newObjects: Set<any> = new Set();
  private dirtyObjects: Set<any> = new Set();
  private removedObjects: Set<any> = new Set();

  registerNew(obj: any): void {
    if (this.removedObjects.has(obj)) {
      throw new Error('Cannot register removed object as new');
    }
    if (this.dirtyObjects.has(obj)) {
      throw new Error('Cannot register dirty object as new');
    }
    this.newObjects.add(obj);
  }

  registerDirty(obj: any): void {
    if (!this.newObjects.has(obj) && !this.dirtyObjects.has(obj)) {
      this.dirtyObjects.add(obj);
    }
  }

  registerRemoved(obj: any): void {
    if (this.newObjects.has(obj)) {
      this.newObjects.delete(obj);
    } else {
      this.dirtyObjects.delete(obj);
      this.removedObjects.add(obj);
    }
  }

  async commit(): Promise<void> {
    const db = await Database.connect();
    await db.beginTransaction();

    try {
      // Insert new objects
      for (const obj of this.newObjects) {
        await this.insertObject(db, obj);
      }

      // Update dirty objects
      for (const obj of this.dirtyObjects) {
        await this.updateObject(db, obj);
      }

      // Delete removed objects
      for (const obj of this.removedObjects) {
        await this.deleteObject(db, obj);
      }

      await db.commit();
      this.clear();
    } catch (error) {
      await db.rollback();
      throw error;
    }
  }

  private clear(): void {
    this.newObjects.clear();
    this.dirtyObjects.clear();
    this.removedObjects.clear();
  }

  private async insertObject(db: Database, obj: any): Promise<void> {
    // Use mapper to insert object
  }

  private async updateObject(db: Database, obj: any): Promise<void> {
    // Use mapper to update object
  }

  private async deleteObject(db: Database, obj: any): Promise<void> {
    // Use mapper to delete object
  }
}

// Usage
const uow = new UnitOfWork();

const user = new User('1', 'John');
uow.registerNew(user);

const order = await orderRepo.find('order-1');
order.addItem(product);
uow.registerDirty(order);

const oldProduct = await productRepo.find('old-1');
uow.registerRemoved(oldProduct);

await uow.commit(); // All changes committed together
```

### Best Practices

✅ **DO:**
- Commit or rollback atomically
- Track changes automatically when possible
- Clear state after commit
- Handle concurrency conflicts

❌ **DON'T:**
- Keep UnitOfWork alive too long
- Share UnitOfWork across threads
- Commit partially on error
- Ignore transaction boundaries

---

## Identity Map

### Definition

**Ensures that each object gets loaded only once by keeping every loaded object in a map, looking up objects using the map when referring to them.**

### Purpose

Prevent duplicate objects and ensure object identity within a session.

### When to Use

✅ **Good For:**
- Maintaining object identity
- Preventing duplicate loads
- Circular references
- Performance optimization

❌ **Not Ideal For:**
- Stateless services
- Large datasets (memory concerns)
- Read-only scenarios

### Example

```typescript
class IdentityMap {
  private map = new Map<string, any>();

  get(key: string): any | null {
    return this.map.get(key) || null;
  }

  put(key: string, value: any): void {
    this.map.set(key, value);
  }

  has(key: string): boolean {
    return this.map.has(key);
  }

  clear(): void {
    this.map.clear();
  }
}

class UserMapper {
  constructor(
    private db: Database,
    private identityMap: IdentityMap
  ) {}

  async find(id: string): Promise<User | null> {
    // Check identity map first
    if (this.identityMap.has(id)) {
      return this.identityMap.get(id);
    }

    // Load from database
    const row = await this.db.queryOne(
      'SELECT * FROM users WHERE id = $1',
      [id]
    );

    if (!row) return null;

    const user = new User(row.id, row.name, row.email);

    // Store in identity map
    this.identityMap.put(id, user);

    return user;
  }
}

// Usage ensures same instance
const user1 = await userMapper.find('123');
const user2 = await userMapper.find('123');
console.log(user1 === user2); // true - same instance
```

---

## Lazy Load

### Definition

**An object that doesn't contain all of the data you need but knows how to get it.**

### Purpose

Defer loading of expensive data until actually needed.

### Types

1. **Lazy Initialization:** Load on first access
2. **Virtual Proxy:** Proxy object loads real object on demand
3. **Value Holder:** Wrapper that loads value when accessed
4. **Ghost:** Partial object that loads full data on access

### Example

```typescript
// Lazy Initialization
class Order {
  constructor(
    private id: string,
    private customerId: string,
    private _customer?: Customer
  ) {}

  async getCustomer(): Promise<Customer> {
    if (!this._customer) {
      this._customer = await customerRepo.find(this.customerId);
    }
    return this._customer;
  }
}

// Virtual Proxy
class CustomerProxy extends Customer {
  private realCustomer?: Customer;

  constructor(private id: string, private loader: CustomerLoader) {
    super();
  }

  get name(): string {
    return this.getRealCustomer().name;
  }

  get email(): string {
    return this.getRealCustomer().email;
  }

  private getRealCustomer(): Customer {
    if (!this.realCustomer) {
      this.realCustomer = this.loader.load(this.id);
    }
    return this.realCustomer;
  }
}
```

---

## Pattern Combinations

### Repository + Unit of Work

```typescript
class UserRepository {
  constructor(private unitOfWork: UnitOfWork) {}

  async save(user: User): Promise<void> {
    if (user.isNew()) {
      this.unitOfWork.registerNew(user);
    } else {
      this.unitOfWork.registerDirty(user);
    }
  }
}

// Service layer commits unit of work
class UserService {
  async updateUserEmail(userId: string, newEmail: string): Promise<void> {
    const user = await this.userRepo.findById(userId);
    user.changeEmail(newEmail);
    await this.userRepo.save(user); // Registers with UoW
    await this.unitOfWork.commit(); // Commits transaction
  }
}
```

### Data Mapper + Identity Map

```typescript
class OrderMapper {
  constructor(
    private db: Database,
    private identityMap: IdentityMap
  ) {}

  async find(id: string): Promise<Order> {
    // Check cache
    let order = this.identityMap.get(id);
    if (order) return order;

    // Load from DB
    const row = await this.db.queryOne('SELECT * FROM orders WHERE id = $1', [id]);
    order = this.mapToOrder(row);

    // Cache it
    this.identityMap.put(id, order);

    return order;
  }
}
```

## Common Pitfalls

❌ **Leaky Abstractions:** Repository exposing SQL details
❌ **Anemic Repositories:** Just CRUD, no domain queries
❌ **N+1 Queries:** Lazy loading causing performance issues
❌ **Stale Identity Map:** Not clearing between requests
❌ **Wrong Pattern:** Using Active Record for complex domains

## Key Takeaways

1. **Repository:** Collection-like interface for domain objects
2. **Data Mapper:** Complete separation of domain and persistence
3. **Active Record:** Simple pattern for simple domains
4. **Unit of Work:** Coordinate changes across multiple objects
5. **Identity Map:** Ensure object identity and prevent duplicates
6. **Lazy Load:** Defer expensive loads until needed
