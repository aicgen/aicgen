# Integration Testing

## Testing Real Dependencies

```typescript
describe('UserRepository Integration', () => {
  let db: Database;
  let repository: UserRepository;

  beforeAll(async () => {
    db = await createTestDatabase();
    repository = new UserRepository(db);
  });

  afterAll(async () => {
    await db.close();
  });

  beforeEach(async () => {
    await db.clear('users'); // Clean slate for each test
  });

  it('should persist and retrieve user', async () => {
    const userData = { email: 'test@example.com', name: 'Test User' };

    const created = await repository.create(userData);
    const found = await repository.findById(created.id);

    expect(found).toEqual(expect.objectContaining(userData));
  });
});
```

## API Integration Tests

```typescript
describe('POST /api/users', () => {
  let app: Express;
  let db: Database;

  beforeAll(async () => {
    db = await createTestDatabase();
    app = createApp(db);
  });

  afterEach(async () => {
    await db.clear('users');
  });

  it('should create user and return 201', async () => {
    const response = await request(app)
      .post('/api/users')
      .send({ email: 'new@example.com', name: 'New User' })
      .expect(201);

    expect(response.body.data).toEqual(
      expect.objectContaining({
        email: 'new@example.com',
        name: 'New User'
      })
    );

    // Verify in database
    const user = await db.findOne('users', { email: 'new@example.com' });
    expect(user).toBeTruthy();
  });

  it('should return 400 for invalid email', async () => {
    const response = await request(app)
      .post('/api/users')
      .send({ email: 'invalid', name: 'Test' })
      .expect(400);

    expect(response.body.error.code).toBe('VALIDATION_ERROR');
  });
});
```

## Database Transaction Testing

```typescript
describe('OrderService Integration', () => {
  it('should rollback on payment failure', async () => {
    const order = await orderService.createOrder({ items: [...] });

    // Mock payment to fail
    paymentGateway.charge.mockRejectedValue(new Error('Declined'));

    await expect(
      orderService.processOrder(order.id)
    ).rejects.toThrow('Payment failed');

    // Verify order status unchanged
    const updatedOrder = await orderRepository.findById(order.id);
    expect(updatedOrder.status).toBe('pending');

    // Verify inventory not deducted
    const inventory = await inventoryRepository.findByProductId(productId);
    expect(inventory.quantity).toBe(originalQuantity);
  });
});
```

## Test Data Builders

```typescript
class UserBuilder {
  private data: Partial<User> = {
    email: 'default@example.com',
    name: 'Default User',
    role: 'user'
  };

  withEmail(email: string) { this.data.email = email; return this; }
  withRole(role: string) { this.data.role = role; return this; }
  asAdmin() { this.data.role = 'admin'; return this; }

  build(): User { return this.data as User; }

  async save(db: Database): Promise<User> {
    return db.insert('users', this.data);
  }
}

// Usage
const admin = await new UserBuilder()
  .withEmail('admin@example.com')
  .asAdmin()
  .save(db);
```

## Test Isolation

```typescript
// Use transactions that rollback
describe('IntegrationTests', () => {
  beforeEach(async () => {
    await db.beginTransaction();
  });

  afterEach(async () => {
    await db.rollbackTransaction();
  });
});

// Or use test containers
import { PostgreSqlContainer } from '@testcontainers/postgresql';

let container: PostgreSqlContainer;

beforeAll(async () => {
  container = await new PostgreSqlContainer().start();
  db = await connect(container.getConnectionUri());
});

afterAll(async () => {
  await container.stop();
});
```
