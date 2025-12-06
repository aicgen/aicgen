# Testing Best Practices & Guidelines

## Test Pyramid

### Structure

```
        /\
       /  \
      / UI \         ← Few (slow, brittle, expensive)
     /------\
    /        \
   / Integration \   ← Some (medium speed, moderate cost)
  /--------------\
 /                \
/   Unit Tests     \ ← Many (fast, cheap, stable)
--------------------
```

**Principle**: Write lots of small fast unit tests, some integration tests, very few UI tests.

### Test Distribution

```typescript
// ✅ Good distribution
Unit Tests:        1000+ tests, ~1-2 minutes total
Integration Tests: 50-100 tests, ~5-10 minutes total
E2E Tests:         5-15 tests, ~15-30 minutes total

// ❌ Ice cream cone anti-pattern
Unit Tests:        50 tests
Integration Tests: 200 tests
E2E Tests:         500 tests  // Maintenance nightmare
```

## Unit Testing

### Test Structure: Arrange-Act-Assert

```typescript
describe('UserService', () => {
  describe('createUser', () => {
    it('should create user with hashed password', async () => {
      // Arrange
      const userData = {
        email: 'test@example.com',
        password: 'password123'
      };
      const mockRepo = {
        save: jest.fn().mockResolvedValue({ id: '1', ...userData })
      };
      const service = new UserService(mockRepo);

      // Act
      const result = await service.createUser(userData);

      // Assert
      expect(result.id).toBe('1');
      expect(result.email).toBe('test@example.com');
      expect(mockRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({
          email: 'test@example.com',
          password: expect.not.stringMatching('password123') // Password should be hashed
        })
      );
    });
  });
});
```

### Test Observable Behavior, Not Implementation

```typescript
// ❌ Testing implementation details
it('should call validateEmail method', () => {
  const spy = jest.spyOn(service, 'validateEmail');
  service.createUser({ email: 'test@example.com', password: 'pass' });
  expect(spy).toHaveBeenCalled(); // Brittle - breaks if refactored
});

// ✅ Testing observable behavior
it('should reject invalid email', async () => {
  await expect(
    service.createUser({ email: 'invalid', password: 'pass' })
  ).rejects.toThrow('Invalid email');
});
```

### One Test Per Condition

```typescript
// ❌ Multiple assertions for different scenarios
it('should validate user input', () => {
  expect(() => validate({ age: -1 })).toThrow();
  expect(() => validate({ age: 200 })).toThrow();
  expect(() => validate({ name: '' })).toThrow();
  // Hard to identify which condition failed
});

// ✅ One test per condition
it('should reject negative age', () => {
  expect(() => validate({ age: -1 })).toThrow('Age must be positive');
});

it('should reject age over 150', () => {
  expect(() => validate({ age: 200 })).toThrow('Age must be under 150');
});

it('should reject empty name', () => {
  expect(() => validate({ name: '' })).toThrow('Name is required');
});
```

### Avoid Testing Trivial Code

```typescript
// ❌ Testing getters/setters
it('should set and get name', () => {
  user.setName('John');
  expect(user.getName()).toBe('John');
});

// ❌ Testing framework code
it('should return JSON response', () => {
  const result = res.json({ data: 'test' });
  expect(result).toBeDefined(); // Testing Express, not your code
});

// ✅ Test business logic
it('should calculate discounted price correctly', () => {
  const order = new Order({ items: [{ price: 100 }], discountPercent: 10 });
  expect(order.getTotal()).toBe(90);
});
```

### Solitary vs Sociable Unit Tests

```typescript
// Solitary: All collaborators mocked
describe('OrderService (solitary)', () => {
  it('should process order', async () => {
    const mockPayment = { charge: jest.fn().mockResolvedValue({ success: true }) };
    const mockInventory = { reserve: jest.fn().mockResolvedValue(true) };
    const mockEmail = { send: jest.fn().mockResolvedValue(true) };

    const service = new OrderService(mockPayment, mockInventory, mockEmail);
    await service.processOrder(order);

    expect(mockPayment.charge).toHaveBeenCalled();
    expect(mockInventory.reserve).toHaveBeenCalled();
    expect(mockEmail.send).toHaveBeenCalled();
  });
});

// Sociable: Real collaborators where practical
describe('OrderService (sociable)', () => {
  it('should calculate total with real tax calculator', async () => {
    const taxCalculator = new TaxCalculator(); // Real object
    const mockPayment = { charge: jest.fn() }; // Mock external service

    const service = new OrderService(mockPayment, taxCalculator);
    await service.processOrder(order);

    expect(mockPayment.charge).toHaveBeenCalledWith(
      expect.objectContaining({ amount: 108 }) // $100 + 8% tax
    );
  });
});
```

## Test Doubles

### Types

```typescript
// Dummy: Passed but never used
const dummyLogger = {} as Logger;
const service = new Service(dummyLogger);

// Stub: Returns canned responses
const stubDatabase = {
  findUser: () => ({ id: '1', name: 'Test User' })
};

// Spy: Records how it was called
const spyLogger = {
  log: jest.fn()
};
service.doSomething();
expect(spyLogger.log).toHaveBeenCalledWith('Action completed');

// Mock: Pre-programmed with expectations
const mockPayment = {
  charge: jest.fn()
    .mockResolvedValueOnce({ success: true })
    .mockResolvedValueOnce({ success: false })
};

// Fake: Working implementation (not for production)
class FakeDatabase implements Database {
  private data: Map<string, any> = new Map();

  async save(id: string, data: any) {
    this.data.set(id, data);
  }

  async find(id: string) {
    return this.data.get(id);
  }
}
```

### When to Use Each

```typescript
// Use Stubs for queries
const stubUserRepo = {
  findById: (id: string) => ({ id, name: 'John', role: 'admin' })
};

// Use Mocks for commands (behavior verification)
const mockEmailService = {
  send: jest.fn()
};
await service.registerUser(userData);
expect(mockEmailService.send).toHaveBeenCalledWith(
  expect.objectContaining({ to: userData.email, subject: 'Welcome' })
);

// Use Fakes for complex dependencies
const fakeCache = new InMemoryCache(); // Faster than Redis in tests
const service = new Service(fakeCache);
```

## Integration Testing

### Database Integration Tests

```typescript
describe('UserRepository (integration)', () => {
  let db: Database;

  beforeAll(async () => {
    // Use test database or in-memory DB
    db = await createTestDatabase();
  });

  afterAll(async () => {
    await db.close();
  });

  beforeEach(async () => {
    // Clean database before each test
    await db.query('TRUNCATE TABLE users CASCADE');
  });

  it('should persist and retrieve user', async () => {
    const repo = new UserRepository(db);
    const user = await repo.create({
      email: 'test@example.com',
      name: 'Test User'
    });

    const retrieved = await repo.findById(user.id);

    expect(retrieved).toMatchObject({
      email: 'test@example.com',
      name: 'Test User'
    });
  });

  it('should enforce unique email constraint', async () => {
    const repo = new UserRepository(db);

    await repo.create({ email: 'test@example.com', name: 'User 1' });

    await expect(
      repo.create({ email: 'test@example.com', name: 'User 2' })
    ).rejects.toThrow('Email already exists');
  });
});
```

### API Integration Tests

```typescript
import request from 'supertest';
import { app } from '../app';

describe('POST /api/users', () => {
  it('should create user and return 201', async () => {
    const response = await request(app)
      .post('/api/users')
      .send({
        email: 'test@example.com',
        password: 'securepassword123'
      })
      .expect(201);

    expect(response.body).toMatchObject({
      id: expect.any(String),
      email: 'test@example.com'
    });
    expect(response.body.password).toBeUndefined(); // Password not returned
  });

  it('should return 400 for invalid email', async () => {
    const response = await request(app)
      .post('/api/users')
      .send({
        email: 'invalid-email',
        password: 'password123'
      })
      .expect(400);

    expect(response.body.error).toContain('Invalid email');
  });
});
```

### External Service Integration Tests

```typescript
import nock from 'nock';

describe('PaymentService integration', () => {
  afterEach(() => {
    nock.cleanAll();
  });

  it('should process payment via external API', async () => {
    // Mock external payment API
    nock('https://api.payment-provider.com')
      .post('/charges')
      .reply(200, {
        id: 'ch_123',
        status: 'succeeded',
        amount: 1000
      });

    const service = new PaymentService();
    const result = await service.charge({ amount: 1000, currency: 'USD' });

    expect(result.status).toBe('succeeded');
    expect(result.id).toBe('ch_123');
  });

  it('should handle payment API errors', async () => {
    nock('https://api.payment-provider.com')
      .post('/charges')
      .reply(402, { error: 'Insufficient funds' });

    const service = new PaymentService();

    await expect(
      service.charge({ amount: 1000, currency: 'USD' })
    ).rejects.toThrow('Payment failed: Insufficient funds');
  });
});
```

## End-to-End Testing

### Critical User Journeys Only

```typescript
// ✅ Test critical paths
describe('E2E: User Registration Flow', () => {
  it('should complete full registration', async () => {
    await page.goto('http://localhost:3000/register');

    // Fill form
    await page.fill('[name="email"]', 'newuser@example.com');
    await page.fill('[name="password"]', 'securepassword123');
    await page.fill('[name="confirmPassword"]', 'securepassword123');

    // Submit
    await page.click('button[type="submit"]');

    // Verify success
    await expect(page.locator('.success-message')).toContainText(
      'Registration successful'
    );

    // Verify redirect to dashboard
    await expect(page).toHaveURL('http://localhost:3000/dashboard');
  });
});

// ❌ Don't test every edge case at E2E level
describe('E2E: Form Validation', () => {
  // These should be unit/integration tests instead
  it('should show error for missing email', async () => { /* ... */ });
  it('should show error for invalid email format', async () => { /* ... */ });
  it('should show error for short password', async () => { /* ... */ });
  // 50 more validation tests...
});
```

### Page Object Pattern

```typescript
// pages/registration.page.ts
export class RegistrationPage {
  constructor(private page: Page) {}

  async navigate() {
    await this.page.goto('http://localhost:3000/register');
  }

  async fillEmail(email: string) {
    await this.page.fill('[name="email"]', email);
  }

  async fillPassword(password: string) {
    await this.page.fill('[name="password"]', password);
  }

  async submit() {
    await this.page.click('button[type="submit"]');
  }

  async getErrorMessage() {
    return this.page.locator('.error-message').textContent();
  }
}

// Test using Page Object
describe('User Registration', () => {
  let registrationPage: RegistrationPage;

  beforeEach(async () => {
    registrationPage = new RegistrationPage(page);
    await registrationPage.navigate();
  });

  it('should register new user', async () => {
    await registrationPage.fillEmail('user@example.com');
    await registrationPage.fillPassword('securepassword');
    await registrationPage.submit();

    await expect(page).toHaveURL(/\/dashboard/);
  });
});
```

## Test-Driven Development (TDD)

### Red-Green-Refactor Cycle

```typescript
// 1. RED: Write failing test
describe('calculateDiscount', () => {
  it('should apply 10% discount for orders over $100', () => {
    const result = calculateDiscount(150);
    expect(result).toBe(15); // Test fails - function doesn't exist
  });
});

// 2. GREEN: Write minimal code to pass
const calculateDiscount = (amount: number): number => {
  if (amount > 100) {
    return amount * 0.1;
  }
  return 0;
};

// 3. REFACTOR: Improve code while keeping tests green
const calculateDiscount = (amount: number): number => {
  const DISCOUNT_THRESHOLD = 100;
  const DISCOUNT_RATE = 0.1;

  return amount > DISCOUNT_THRESHOLD ? amount * DISCOUNT_RATE : 0;
};
```

## Contract Testing

### Consumer-Driven Contracts

```typescript
// Consumer test (Frontend)
import { pact } from '@pact-foundation/pact';

describe('User API Contract', () => {
  const provider = pact({
    consumer: 'FrontendApp',
    provider: 'UserAPI'
  });

  it('should get user by ID', async () => {
    await provider.addInteraction({
      state: 'user with ID 123 exists',
      uponReceiving: 'a request for user 123',
      withRequest: {
        method: 'GET',
        path: '/api/users/123'
      },
      willRespondWith: {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
        body: {
          id: '123',
          name: 'John Doe',
          email: 'john@example.com'
        }
      }
    });

    const response = await userClient.getUser('123');
    expect(response.name).toBe('John Doe');
  });
});

// Provider verification (Backend)
describe('User API Provider', () => {
  it('should verify contract', async () => {
    await verifyPacts({
      provider: 'UserAPI',
      providerBaseUrl: 'http://localhost:3000',
      pactUrls: ['./pacts/FrontendApp-UserAPI.json']
    });
  });
});
```

## Test Best Practices

### Keep Tests Independent

```typescript
// ❌ Tests depend on order
let userId: string;

it('should create user', async () => {
  const user = await service.createUser({ name: 'Test' });
  userId = user.id; // Shared state
});

it('should update user', async () => {
  await service.updateUser(userId, { name: 'Updated' }); // Fails if run alone
});

// ✅ Each test is independent
it('should create user', async () => {
  const user = await service.createUser({ name: 'Test' });
  expect(user.id).toBeDefined();
});

it('should update user', async () => {
  const user = await service.createUser({ name: 'Test' });
  const updated = await service.updateUser(user.id, { name: 'Updated' });
  expect(updated.name).toBe('Updated');
});
```

### Use Test Helpers and Factories

```typescript
// Test helpers
const createTestUser = (overrides = {}) => ({
  email: 'test@example.com',
  name: 'Test User',
  role: 'user',
  ...overrides
});

const createTestOrder = (overrides = {}) => ({
  userId: '123',
  items: [{ productId: 'p1', quantity: 1, price: 100 }],
  status: 'pending',
  ...overrides
});

// Usage
it('should process order for premium user', async () => {
  const premiumUser = createTestUser({ role: 'premium' });
  const order = createTestOrder({ userId: premiumUser.id });

  const result = await service.processOrder(order);

  expect(result.discount).toBeGreaterThan(0);
});
```

### Readable Test Names

```typescript
// ❌ Unclear test names
it('test1', () => { /* ... */ });
it('works correctly', () => { /* ... */ });
it('should return true', () => { /* ... */ });

// ✅ Descriptive test names
it('should reject order when inventory is insufficient', () => { /* ... */ });
it('should send confirmation email after successful payment', () => { /* ... */ });
it('should apply 15% discount for VIP customers on orders over $200', () => { /* ... */ });
```

### Don't Over-DRY Tests

```typescript
// ❌ Over-abstracted (hard to understand)
const runTest = (input, expected, errorMsg) => {
  it(errorMsg, () => {
    expect(validate(input)).toBe(expected);
  });
};
runTest({ age: -1 }, false, 'test1');
runTest({ age: 200 }, false, 'test2');

// ✅ Some repetition is OK for clarity
it('should reject negative age', () => {
  expect(validate({ age: -1 })).toBe(false);
});

it('should reject age over 150', () => {
  expect(validate({ age: 200 })).toBe(false);
});
```

## Handling Flaky Tests

### Eliminate Non-Determinism

```typescript
// ❌ Time-dependent test
it('should create timestamp', () => {
  const result = service.createRecord();
  expect(result.timestamp).toBe(new Date('2024-01-01')); // Fails tomorrow
});

// ✅ Inject time dependency
class Service {
  constructor(private clock: Clock = new SystemClock()) {}

  createRecord() {
    return { timestamp: this.clock.now() };
  }
}

it('should create timestamp', () => {
  const mockClock = { now: () => new Date('2024-01-01') };
  const service = new Service(mockClock);

  const result = service.createRecord();
  expect(result.timestamp).toEqual(new Date('2024-01-01'));
});
```

### Avoid Race Conditions

```typescript
// ❌ Race condition
it('should process async operation', async () => {
  service.startAsyncTask();
  // Task might not complete yet
  expect(service.isComplete()).toBe(true); // Flaky
});

// ✅ Wait for completion
it('should process async operation', async () => {
  await service.startAsyncTask();
  expect(service.isComplete()).toBe(true);
});

// ✅ Use polling for eventual consistency
it('should eventually update status', async () => {
  service.startAsyncTask();

  await waitFor(() => {
    expect(service.getStatus()).toBe('complete');
  }, { timeout: 5000 });
});
```

## Test Coverage

### Use Coverage as a Guide, Not a Goal

```bash
# Generate coverage report
npm run test:coverage

# Typical output
Statements   : 85.5% ( 1234/1443 )
Branches     : 78.2% ( 567/725 )
Functions    : 82.1% ( 234/285 )
Lines        : 86.3% ( 1198/1388 )
```

```typescript
// ✅ 100% coverage doesn't mean bug-free
const divide = (a: number, b: number) => a / b;

it('should divide numbers', () => {
  expect(divide(10, 2)).toBe(5); // 100% coverage
});

// Missing test: divide(10, 0) → Infinity (edge case not covered)

// ✅ Focus on important paths
it('should handle division by zero', () => {
  expect(() => divide(10, 0)).toThrow('Cannot divide by zero');
});
```

## Anti-Patterns

### ❌ Testing Private Methods

```typescript
class UserService {
  private validateEmail(email: string) { /* ... */ }

  public createUser(data: UserData) {
    this.validateEmail(data.email);
    // ...
  }
}

// ❌ Don't test private methods
it('should validate email', () => {
  const service = new UserService();
  expect(service['validateEmail']('test@example.com')).toBe(true);
});

// ✅ Test through public interface
it('should reject invalid email', () => {
  const service = new UserService();
  expect(() => service.createUser({ email: 'invalid' }))
    .toThrow('Invalid email');
});
```

### ❌ Mocking Everything

```typescript
// ❌ Over-mocking loses confidence
it('should calculate total', () => {
  const mockCalculator = {
    add: jest.fn().mockReturnValue(10),
    multiply: jest.fn().mockReturnValue(100)
  };

  const service = new PriceService(mockCalculator);
  const result = service.calculateTotal();

  expect(result).toBe(100); // Not testing real calculation
});

// ✅ Use real objects when simple
it('should calculate total', () => {
  const calculator = new Calculator(); // Real implementation
  const service = new PriceService(calculator);

  const result = service.calculateTotal([
    { price: 10, quantity: 2 },
    { price: 15, quantity: 3 }
  ]);

  expect(result).toBe(65); // 20 + 45
});
```

### ❌ Slow Test Suites

```typescript
// ❌ Testing everything at E2E level
describe('Form validation (E2E)', () => {
  it('should validate email format', async () => { /* ... */ }); // 5s
  it('should validate password length', async () => { /* ... */ }); // 5s
  // 100 more E2E tests... → 10+ minutes
});

// ✅ Push tests down the pyramid
describe('Form validation (unit)', () => {
  it('should validate email format', () => { /* ... */ }); // 5ms
  it('should validate password length', () => { /* ... */ }); // 5ms
  // 100 tests → < 1 second
});

describe('Form submission (E2E)', () => {
  it('should complete registration flow', async () => { /* ... */ }); // 5s
  // Just the happy path
});
```

## References

- [Test Pyramid](https://martinfowler.com/bliki/TestPyramid.html)
- [Mocks Aren't Stubs](https://martinfowler.com/articles/mocksArentStubs.html)
- [Practical Test Pyramid](https://martinfowler.com/articles/practical-test-pyramid.html)
- [Eradicating Non-Determinism in Tests](https://martinfowler.com/articles/nonDeterminism.html)
- [Test-Driven Development](https://martinfowler.com/bliki/TestDrivenDevelopment.html)
