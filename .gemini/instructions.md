# Gemini Development Guide

**Role:** You are an expert software engineer specialized in typescript and layered architecture.
**Objective:** Write clean, efficient, and maintainable code following the guidelines below.

## Guiding Principles
1. **Quality First**: Prioritize code quality and maintainability over speed.
2. **Step-by-Step**: Think through problems systematically.
3. **Verify**: Double-check your code against the guidelines.



## Language

# TypeScript Fundamentals

## Strict Mode (Required)

Always use strict mode in `tsconfig.json`:

```json
{
  "compilerOptions": {
    "strict": true,
    "noImplicitAny": true,
    "strictNullChecks": true,
    "strictFunctionTypes": true
  }
}
```

## Type Annotations

Use explicit types for clarity:

```typescript
// Function signatures
function calculateTotal(items: CartItem[], taxRate: number): number {
  const subtotal = items.reduce((sum, item) => sum + item.price, 0);
  return subtotal * (1 + taxRate);
}

// Variable declarations
const userName: string = "Alice";
const age: number = 30;
const isActive: boolean = true;
```

## Avoid `any`

Never use `any` - use `unknown` with type guards:

```typescript
// ❌ Bad
function processData(data: any) {
  return data.value;
}

// ✅ Good
function processData(data: unknown): string {
  if (typeof data === 'object' && data !== null && 'value' in data) {
    return String(data.value);
  }
  throw new Error('Invalid data structure');
}
```

## Type Guards

Implement custom type guards:

```typescript
interface User {
  id: string;
  email: string;
}

function isUser(value: unknown): value is User {
  return (
    typeof value === 'object' &&
    value !== null &&
    'id' in value &&
    'email' in value &&
    typeof value.id === 'string' &&
    typeof value.email === 'string'
  );
}

// Usage
if (isUser(data)) {
  console.log(data.email); // Type: User
}
```

## Naming Conventions

- Classes/Interfaces: `PascalCase`
- Functions/Variables: `camelCase`
- Constants: `UPPER_SNAKE_CASE`
- Files: `kebab-case.ts`
- No `I` prefix for interfaces


# Async/Await Patterns

## Prefer async/await

Always use async/await over promise chains:

```typescript
// ✅ Good
async function fetchUser(id: string): Promise<User> {
  const response = await fetch(`/api/users/${id}`);
  if (!response.ok) {
    throw new Error(`HTTP ${response.status}`);
  }
  return await response.json();
}

// ❌ Avoid
function fetchUser(id: string): Promise<User> {
  return fetch(`/api/users/${id}`)
    .then(res => res.json());
}
```

## Error Handling

Always wrap async operations in try/catch:

```typescript
async function safeOperation(): Promise<Result> {
  try {
    const data = await riskyOperation();
    return { success: true, data };
  } catch (error) {
    logger.error('Operation failed', error);
    return { success: false, error: error.message };
  }
}
```

## Parallel Execution

Use `Promise.all()` for independent operations:

```typescript
// ✅ Good - parallel (fast)
const [users, posts, comments] = await Promise.all([
  fetchUsers(),
  fetchPosts(),
  fetchComments()
]);

// ❌ Bad - sequential (slow)
const users = await fetchUsers();
const posts = await fetchPosts();
const comments = await fetchComments();
```

## Handling Failures

Use `Promise.allSettled()` when some failures are acceptable:

```typescript
const results = await Promise.allSettled([
  fetchData1(),
  fetchData2(),
  fetchData3()
]);

results.forEach((result, index) => {
  if (result.status === 'fulfilled') {
    console.log(`Success ${index}:`, result.value);
  } else {
    console.error(`Failed ${index}:`, result.reason);
  }
});
```

## Retry Pattern

Implement retry with exponential backoff:

```typescript
async function retryWithBackoff<T>(
  fn: () => Promise<T>,
  maxRetries: number = 3
): Promise<T> {
  let lastError: Error;

  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error as Error;
      if (attempt < maxRetries - 1) {
        const delay = 1000 * Math.pow(2, attempt);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
  }

  throw lastError!;
}
```


# TypeScript Types & Interfaces

## Prefer Interfaces for Public APIs

```typescript
// ✅ Use interfaces for object shapes
interface User {
  id: string;
  name: string;
  email: string;
  createdAt: Date;
}

// ✅ Use type aliases for unions and complex types
type UserRole = 'admin' | 'editor' | 'viewer';
type ResponseHandler = (response: Response) => void;
```

## Discriminated Unions

```typescript
// ✅ Use discriminated unions for variant types
type Result<T> =
  | { success: true; data: T }
  | { success: false; error: string };

function handleResult(result: Result<User>) {
  if (result.success) {
    console.log(result.data.name); // TypeScript knows data exists
  } else {
    console.error(result.error); // TypeScript knows error exists
  }
}
```

## Utility Types

```typescript
// Use built-in utility types
type PartialUser = Partial<User>;           // All fields optional
type RequiredUser = Required<User>;         // All fields required
type ReadonlyUser = Readonly<User>;         // All fields readonly
type UserKeys = keyof User;                 // 'id' | 'name' | 'email' | 'createdAt'
type PickedUser = Pick<User, 'id' | 'name'>; // Only id and name
type OmittedUser = Omit<User, 'createdAt'>; // Everything except createdAt
```

## Type Guards

```typescript
// ✅ Use type guards for runtime checking
function isUser(value: unknown): value is User {
  return (
    typeof value === 'object' &&
    value !== null &&
    'id' in value &&
    'email' in value
  );
}

// Usage
const data: unknown = fetchData();
if (isUser(data)) {
  console.log(data.email); // TypeScript knows it's a User
}
```

## Avoid `any`

```typescript
// ❌ Never use any
function process(data: any) {
  return data.name; // No type safety
}

// ✅ Use unknown with type guards
function process(data: unknown) {
  if (isUser(data)) {
    return data.name; // Type-safe
  }
  throw new Error('Invalid data');
}
```


# TypeScript Error Handling

## Custom Error Classes

```typescript
// ✅ Create structured error hierarchy
class AppError extends Error {
  constructor(
    message: string,
    public statusCode: number = 500,
    public code: string = 'INTERNAL_ERROR',
    public details?: unknown
  ) {
    super(message);
    this.name = this.constructor.name;
    Error.captureStackTrace(this, this.constructor);
  }
}

class NotFoundError extends AppError {
  constructor(resource: string, id: string) {
    super(`${resource} with id ${id} not found`, 404, 'NOT_FOUND', { resource, id });
  }
}

class ValidationError extends AppError {
  constructor(message: string, details: unknown) {
    super(message, 400, 'VALIDATION_ERROR', details);
  }
}
```

## Async Error Handling

```typescript
// ✅ Always handle promise rejections
async function fetchUser(id: string): Promise<User> {
  try {
    const response = await api.get(`/users/${id}`);
    return response.data;
  } catch (error) {
    if (error instanceof ApiError && error.status === 404) {
      throw new NotFoundError('User', id);
    }
    throw new AppError('Failed to fetch user', 500, 'FETCH_ERROR', { userId: id });
  }
}

// ✅ Use wrapper for Express async handlers
const asyncHandler = (fn: RequestHandler) => {
  return (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
};
```

## Result Type Pattern

```typescript
// ✅ Explicit success/failure without exceptions
type Result<T, E = Error> =
  | { success: true; value: T }
  | { success: false; error: E };

function parseJSON<T>(json: string): Result<T, string> {
  try {
    return { success: true, value: JSON.parse(json) };
  } catch {
    return { success: false, error: 'Invalid JSON' };
  }
}

// Usage
const result = parseJSON<User>(data);
if (result.success) {
  console.log(result.value.name);
} else {
  console.error(result.error);
}
```

## Centralized Error Handler

```typescript
// ✅ Express error middleware
app.use((err: Error, req: Request, res: Response, next: NextFunction) => {
  if (err instanceof AppError) {
    return res.status(err.statusCode).json({
      error: { message: err.message, code: err.code, details: err.details }
    });
  }

  console.error('Unexpected error:', err);
  res.status(500).json({
    error: { message: 'Internal server error', code: 'INTERNAL_ERROR' }
  });
});
```


# TypeScript Testing

## Test Structure: Arrange-Act-Assert

```typescript
describe('UserService', () => {
  describe('createUser', () => {
    it('should create user with hashed password', async () => {
      // Arrange
      const userData = { email: 'test@example.com', password: 'password123' };
      const mockRepo = { save: jest.fn().mockResolvedValue({ id: '1', ...userData }) };
      const service = new UserService(mockRepo);

      // Act
      const result = await service.createUser(userData);

      // Assert
      expect(result.id).toBe('1');
      expect(mockRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({ email: 'test@example.com' })
      );
    });
  });
});
```

## Test Observable Behavior, Not Implementation

```typescript
// ❌ Testing implementation details
it('should call validateEmail method', () => {
  const spy = jest.spyOn(service, 'validateEmail');
  service.createUser({ email: 'test@example.com' });
  expect(spy).toHaveBeenCalled(); // Brittle - breaks if refactored
});

// ✅ Testing observable behavior
it('should reject invalid email', async () => {
  await expect(
    service.createUser({ email: 'invalid' })
  ).rejects.toThrow('Invalid email');
});
```

## Test Doubles

```typescript
// Stub: Returns canned responses
const stubDatabase = {
  findUser: () => ({ id: '1', name: 'Test User' })
};

// Mock: Pre-programmed with expectations
const mockPayment = {
  charge: jest.fn()
    .mockResolvedValueOnce({ success: true })
    .mockResolvedValueOnce({ success: false })
};

// Fake: Working implementation (not for production)
class FakeDatabase implements Database {
  private data = new Map<string, any>();

  async save(id: string, data: any) { this.data.set(id, data); }
  async find(id: string) { return this.data.get(id); }
}
```

## One Test Per Condition

```typescript
// ❌ Multiple assertions for different scenarios
it('should validate user input', () => {
  expect(() => validate({ age: -1 })).toThrow();
  expect(() => validate({ age: 200 })).toThrow();
  expect(() => validate({ name: '' })).toThrow();
});

// ✅ One test per condition
it('should reject negative age', () => {
  expect(() => validate({ age: -1 })).toThrow('Age must be positive');
});

it('should reject age over 150', () => {
  expect(() => validate({ age: 200 })).toThrow('Age must be under 150');
});
```

## Keep Tests Independent

```typescript
// ✅ Each test is self-contained
it('should update user', async () => {
  const user = await service.createUser({ name: 'Test' });
  const updated = await service.updateUser(user.id, { name: 'Updated' });
  expect(updated.name).toBe('Updated');
});
```


# TypeScript Configuration

## tsconfig.json Best Practices

```json
{
  "compilerOptions": {
    // Strict type checking
    "strict": true,
    "noImplicitAny": true,
    "strictNullChecks": true,
    "strictFunctionTypes": true,
    "strictBindCallApply": true,
    "strictPropertyInitialization": true,
    "noImplicitThis": true,
    "alwaysStrict": true,

    // Additional checks
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "noImplicitReturns": true,
    "noFallthroughCasesInSwitch": true,
    "noUncheckedIndexedAccess": true,

    // Module resolution
    "module": "ESNext",
    "moduleResolution": "bundler",
    "esModuleInterop": true,
    "allowSyntheticDefaultImports": true,
    "resolveJsonModule": true,

    // Output
    "target": "ES2022",
    "outDir": "./dist",
    "declaration": true,
    "declarationMap": true,
    "sourceMap": true,

    // Path aliases
    "baseUrl": ".",
    "paths": {
      "@/*": ["src/*"],
      "@services/*": ["src/services/*"],
      "@models/*": ["src/models/*"]
    }
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules", "dist", "**/*.test.ts"]
}
```

## Path Aliases Setup

```typescript
// With path aliases configured:
import { UserService } from '@services/user';
import { User } from '@models/user';

// Instead of relative paths:
import { UserService } from '../../../services/user';
```

## Project References (Monorepo)

```json
// packages/shared/tsconfig.json
{
  "compilerOptions": {
    "composite": true,
    "outDir": "./dist"
  }
}

// packages/api/tsconfig.json
{
  "extends": "../../tsconfig.base.json",
  "references": [
    { "path": "../shared" }
  ]
}
```

## Environment-Specific Configs

```json
// tsconfig.build.json - for production builds
{
  "extends": "./tsconfig.json",
  "compilerOptions": {
    "sourceMap": false,
    "removeComments": true
  },
  "exclude": ["**/*.test.ts", "**/*.spec.ts"]
}
```


---


## Testing

# Unit Testing Fundamentals

## Arrange-Act-Assert Pattern

```typescript
describe('UserService', () => {
  it('should create user with hashed password', async () => {
    // Arrange - Set up test data and dependencies
    const userData = { email: 'test@example.com', password: 'secret123' };
    const mockRepo = { save: jest.fn().mockResolvedValue({ id: '1', ...userData }) };
    const service = new UserService(mockRepo);

    // Act - Execute the behavior being tested
    const result = await service.createUser(userData);

    // Assert - Verify the outcomes
    expect(result.id).toBe('1');
    expect(mockRepo.save).toHaveBeenCalledWith(
      expect.objectContaining({ email: 'test@example.com' })
    );
  });
});
```

## Test Observable Behavior, Not Implementation

```typescript
// ❌ Bad: Testing implementation details
it('should call validateEmail method', () => {
  const spy = jest.spyOn(service, 'validateEmail');
  service.createUser({ email: 'test@example.com' });
  expect(spy).toHaveBeenCalled();
});

// ✅ Good: Testing observable behavior
it('should reject invalid email', async () => {
  await expect(
    service.createUser({ email: 'invalid-email' })
  ).rejects.toThrow('Invalid email format');
});

it('should accept valid email', async () => {
  const result = await service.createUser({ email: 'valid@example.com' });
  expect(result.email).toBe('valid@example.com');
});
```

## One Assertion Per Test Concept

```typescript
// ❌ Bad: Multiple unrelated assertions
it('should validate user input', () => {
  expect(() => validate({ age: -1 })).toThrow();
  expect(() => validate({ age: 200 })).toThrow();
  expect(() => validate({ name: '' })).toThrow();
});

// ✅ Good: One test per scenario
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

## Descriptive Test Names

```typescript
// ❌ Vague names
it('should work correctly', () => {});
it('handles edge case', () => {});

// ✅ Descriptive names - describe the scenario and expected outcome
it('should return empty array when no users match filter', () => {});
it('should throw ValidationError when email is empty', () => {});
it('should retry failed payment up to 3 times before giving up', () => {});
```

## Tests Should Be Independent

```typescript
// ❌ Bad: Tests depend on each other
let userId: string;

it('should create user', async () => {
  const user = await service.createUser(data);
  userId = user.id; // Shared state!
});

it('should update user', async () => {
  await service.updateUser(userId, newData); // Depends on previous test
});

// ✅ Good: Each test is self-contained
it('should update user', async () => {
  const user = await service.createUser(data);
  const updated = await service.updateUser(user.id, newData);
  expect(updated.name).toBe(newData.name);
});
```

## Test Edge Cases

```typescript
describe('divide', () => {
  it('should divide two positive numbers', () => {
    expect(divide(10, 2)).toBe(5);
  });

  it('should throw when dividing by zero', () => {
    expect(() => divide(10, 0)).toThrow('Division by zero');
  });

  it('should handle negative numbers', () => {
    expect(divide(-10, 2)).toBe(-5);
  });

  it('should return zero when numerator is zero', () => {
    expect(divide(0, 5)).toBe(0);
  });
});
```


# Test Doubles and Mocking

## Types of Test Doubles

```typescript
// STUB: Returns canned responses
const stubUserRepo = {
  findById: () => ({ id: '1', name: 'Test User' })
};

// MOCK: Pre-programmed with expectations
const mockPaymentGateway = {
  charge: jest.fn()
    .mockResolvedValueOnce({ success: true, transactionId: 'tx1' })
    .mockResolvedValueOnce({ success: false, error: 'Declined' })
};

// SPY: Records calls for verification
const spy = jest.spyOn(emailService, 'send');

// FAKE: Working implementation (not for production)
class FakeDatabase implements Database {
  private data = new Map<string, any>();

  async save(id: string, entity: any) { this.data.set(id, entity); }
  async find(id: string) { return this.data.get(id); }
}
```

## When to Mock

```typescript
// ✅ Mock external services (APIs, databases)
const mockHttpClient = {
  get: jest.fn().mockResolvedValue({ data: userData })
};

// ✅ Mock time-dependent operations
jest.useFakeTimers();
jest.setSystemTime(new Date('2024-01-15'));

// ✅ Mock random/non-deterministic functions
jest.spyOn(Math, 'random').mockReturnValue(0.5);

// ❌ Don't mock the code you're testing
// ❌ Don't mock simple data structures
```

## Mock Verification

```typescript
it('should send welcome email after registration', async () => {
  const mockEmail = { send: jest.fn().mockResolvedValue(true) };
  const service = new UserService({ emailService: mockEmail });

  await service.register({ email: 'new@example.com' });

  expect(mockEmail.send).toHaveBeenCalledWith({
    to: 'new@example.com',
    template: 'welcome',
    subject: 'Welcome!'
  });
  expect(mockEmail.send).toHaveBeenCalledTimes(1);
});
```

## Partial Mocks

```typescript
// Mock only specific methods
const service = new OrderService();

jest.spyOn(service, 'validateOrder').mockReturnValue(true);
jest.spyOn(service, 'calculateTotal').mockReturnValue(100);
// Other methods use real implementation

const result = await service.processOrder(orderData);
expect(result.total).toBe(100);
```

## Resetting Mocks

```typescript
describe('PaymentService', () => {
  const mockGateway = { charge: jest.fn() };
  const service = new PaymentService(mockGateway);

  beforeEach(() => {
    jest.clearAllMocks(); // Clear call history
    // or jest.resetAllMocks() to also reset return values
  });

  it('should process payment', async () => {
    mockGateway.charge.mockResolvedValue({ success: true });
    await service.charge(100);
    expect(mockGateway.charge).toHaveBeenCalledTimes(1);
  });
});
```

## Mock Modules

```typescript
// Mock entire module
jest.mock('./email-service', () => ({
  EmailService: jest.fn().mockImplementation(() => ({
    send: jest.fn().mockResolvedValue(true)
  }))
}));

// Mock with partial implementation
jest.mock('./config', () => ({
  ...jest.requireActual('./config'),
  API_KEY: 'test-key'
}));
```


# Testing Basics

## Your First Unit Test

A unit test verifies that a small piece of code works correctly.

```pseudocode
// Function to test
function add(a, b):
    return a + b

// Test for the function
test "add should sum two numbers":
    result = add(2, 3)
    expect result equals 5
```

## Test Structure

Every test has three parts:

1. **Setup** - Prepare what you need
2. **Execute** - Run the code
3. **Verify** - Check the result

```pseudocode
test "should create user with name":
    // 1. Setup
    userName = "Alice"

    // 2. Execute
    user = createUser(userName)

    // 3. Verify
    expect user.name equals "Alice"
```

## Common Assertions

```pseudocode
// Equality
expect value equals 5
expect value equals { id: 1 }

// Truthiness
expect value is truthy
expect value is falsy
expect value is null
expect value is undefined

// Numbers
expect value > 3
expect value < 10

// Strings
expect text contains "hello"

// Arrays/Lists
expect array contains item
expect array length equals 3
```

## Testing Expected Errors

```pseudocode
test "should throw error for invalid input":
    expect error when:
        divide(10, 0)
    with message "Cannot divide by zero"
```

## Async Tests

```pseudocode
test "should fetch user data" async:
    user = await fetchUser(123)
    expect user.id equals 123
```

## Test Naming

Use clear, descriptive names:

```pseudocode
// ❌ Bad
test "test1"
test "it works"

// ✅ Good
test "should return user when ID exists"
test "should throw error when ID is invalid"
```

## Running Tests

```bash
# Run all tests
run-tests

# Run specific test file
run-tests user-test

# Watch mode (re-run on changes)
run-tests --watch
```

## Best Practices

1. **One test, one thing** - Test one behavior per test
2. **Independent tests** - Tests should not depend on each other
3. **Clear names** - Name should describe what is being tested
4. **Fast tests** - Tests should run quickly

```pseudocode
// ❌ Bad: Testing multiple things
test "user operations":
    expect createUser("Bob").name equals "Bob"
    expect deleteUser(1) equals true
    expect listUsers().length equals 0

// ✅ Good: One test per operation
test "should create user with given name":
    user = createUser("Bob")
    expect user.name equals "Bob"

test "should delete user by ID":
    result = deleteUser(1)
    expect result equals true

test "should return empty list when no users":
    users = listUsers()
    expect users.length equals 0
```

## When to Write Tests

- **Before fixing bugs** - Write test that fails, then fix
- **For new features** - Test expected behavior
- **For edge cases** - Empty input, null values, large numbers

## What to Test

✅ **Do test:**
- Public functions and methods
- Edge cases (empty, null, zero, negative)
- Error conditions

❌ **Don't test:**
- Private implementation details
- Third-party libraries (they're already tested)
- Getters/setters with no logic


---


## Security

# Injection Prevention

## SQL Injection Prevention

```typescript
// ❌ DANGEROUS: String concatenation
const getUserByEmail = async (email: string) => {
  const query = `SELECT * FROM users WHERE email = '${email}'`;
  // Input: ' OR '1'='1
  // Result: SELECT * FROM users WHERE email = '' OR '1'='1'
  return db.query(query);
};

// ✅ SAFE: Parameterized queries
const getUserByEmail = async (email: string) => {
  return db.query('SELECT * FROM users WHERE email = ?', [email]);
};

// ✅ SAFE: Using ORM
const getUserByEmail = async (email: string) => {
  return userRepository.findOne({ where: { email } });
};

// ✅ SAFE: Query builder
const getUsers = async (minAge: number) => {
  return db
    .select('*')
    .from('users')
    .where('age', '>', minAge); // Automatically parameterized
};
```

## NoSQL Injection Prevention

```typescript
// ❌ DANGEROUS: Accepting objects from user input
app.post('/login', (req, res) => {
  const { username, password } = req.body;
  // If password = {$gt: ""}, it bypasses password check!
  db.users.findOne({ username, password });
});

// ✅ SAFE: Validate input types
app.post('/login', (req, res) => {
  const { username, password } = req.body;

  if (typeof username !== 'string' || typeof password !== 'string') {
    throw new Error('Invalid input types');
  }

  db.users.findOne({ username, password });
});
```

## Command Injection Prevention

```typescript
// ❌ DANGEROUS: Shell command with user input
const convertImage = async (filename: string) => {
  exec(`convert ${filename} output.jpg`);
  // Input: "file.png; rm -rf /"
};

// ✅ SAFE: Use arrays, avoid shell
import { execFile } from 'child_process';

const convertImage = async (filename: string) => {
  execFile('convert', [filename, 'output.jpg']);
};

// ✅ SAFE: Validate input against whitelist
const allowedFilename = /^[a-zA-Z0-9_-]+\.(png|jpg|gif)$/;
if (!allowedFilename.test(filename)) {
  throw new Error('Invalid filename');
}
```

## Path Traversal Prevention

```typescript
// ❌ DANGEROUS: Direct path usage
app.get('/files/:filename', (req, res) => {
  res.sendFile(`/uploads/${req.params.filename}`);
  // Input: ../../etc/passwd
});

// ✅ SAFE: Validate and normalize path
import path from 'path';

app.get('/files/:filename', (req, res) => {
  const safeName = path.basename(req.params.filename);
  const filePath = path.join('/uploads', safeName);
  const normalizedPath = path.normalize(filePath);

  if (!normalizedPath.startsWith('/uploads/')) {
    return res.status(400).json({ error: 'Invalid filename' });
  }

  res.sendFile(normalizedPath);
});
```

## Input Validation

```typescript
// ✅ Whitelist validation
import { z } from 'zod';

const userSchema = z.object({
  email: z.string().email(),
  password: z.string().min(12).max(160),
  age: z.number().int().min(0).max(150),
  role: z.enum(['user', 'admin'])
});

const validateUser = (data: unknown) => {
  return userSchema.parse(data);
};
```


# Authentication & JWT Security

## Password Storage

```typescript
import bcrypt from 'bcrypt';

const SALT_ROUNDS = 12; // Work factor

// ✅ Hash password with bcrypt
async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, SALT_ROUNDS);
}

async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

// ✅ Validate password strength
function validatePassword(password: string): void {
  if (password.length < 12) {
    throw new Error('Password must be at least 12 characters');
  }
  if (password.length > 160) {
    throw new Error('Password too long'); // Prevent DoS via bcrypt
  }
}
```

## JWT Best Practices

```typescript
import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET!;
const ACCESS_TOKEN_EXPIRY = '15m';
const REFRESH_TOKEN_EXPIRY = '7d';

// ✅ Generate tokens
function generateTokens(userId: string) {
  const accessToken = jwt.sign(
    { sub: userId, type: 'access' },
    JWT_SECRET,
    { expiresIn: ACCESS_TOKEN_EXPIRY }
  );

  const refreshToken = jwt.sign(
    { sub: userId, type: 'refresh' },
    JWT_SECRET,
    { expiresIn: REFRESH_TOKEN_EXPIRY }
  );

  return { accessToken, refreshToken };
}

// ✅ Verify and decode token
function verifyToken(token: string) {
  try {
    return jwt.verify(token, JWT_SECRET);
  } catch (error) {
    if (error instanceof jwt.TokenExpiredError) {
      throw new UnauthorizedError('Token expired');
    }
    throw new UnauthorizedError('Invalid token');
  }
}
```

## Login Protection

```typescript
import rateLimit from 'express-rate-limit';

// ✅ Rate limit login attempts
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // 5 attempts
  message: 'Too many login attempts, please try again later',
});

app.post('/login', loginLimiter, async (req, res) => {
  const { email, password } = req.body;

  const user = await userService.findByEmail(email);

  // ✅ Generic error message (don't reveal if user exists)
  if (!user || !await verifyPassword(password, user.passwordHash)) {
    return res.status(401).json({ error: 'Invalid email or password' });
  }

  const tokens = generateTokens(user.id);

  // Regenerate session to prevent fixation
  req.session.regenerate(() => {
    res.json({ ...tokens });
  });
});
```

## Session Security

```typescript
app.use(session({
  secret: process.env.SESSION_SECRET!,
  name: 'sessionId', // Don't use default 'connect.sid'

  cookie: {
    secure: true,        // HTTPS only
    httpOnly: true,      // Prevent XSS access
    sameSite: 'strict',  // CSRF protection
    maxAge: 30 * 60 * 1000, // 30 minutes
  },

  resave: false,
  saveUninitialized: false,
  store: new RedisStore({ client: redisClient })
}));

// ✅ Session regeneration after login
app.post('/login', async (req, res, next) => {
  // ... authenticate user ...

  req.session.regenerate((err) => {
    req.session.userId = user.id;
    res.json({ success: true });
  });
});
```

## Authorization Middleware

```typescript
// ✅ Require authentication
const requireAuth = async (req: Request, res: Response, next: NextFunction) => {
  const token = req.headers.authorization?.replace('Bearer ', '');

  if (!token) {
    return res.status(401).json({ error: 'Authentication required' });
  }

  try {
    const payload = verifyToken(token);
    req.user = await userService.findById(payload.sub);
    next();
  } catch (error) {
    res.status(401).json({ error: 'Invalid token' });
  }
};

// ✅ Require specific role
const requireRole = (...roles: string[]) => {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({ error: 'Forbidden' });
    }
    next();
  };
};
```


# Secrets Management

## Environment Variables

```typescript
// ❌ NEVER hardcode secrets
const config = {
  dbPassword: 'super_secret_password',
  apiKey: 'sk-1234567890abcdef'
};

// ✅ Use environment variables
import dotenv from 'dotenv';
dotenv.config();

const config = {
  dbPassword: process.env.DB_PASSWORD,
  apiKey: process.env.API_KEY,
  sessionSecret: process.env.SESSION_SECRET
};
```

## Validate Required Secrets

```typescript
// ✅ Fail fast if secrets missing
const requiredEnvVars = [
  'DB_PASSWORD',
  'API_KEY',
  'SESSION_SECRET',
  'JWT_SECRET'
];

requiredEnvVars.forEach(varName => {
  if (!process.env[varName]) {
    throw new Error(`Missing required environment variable: ${varName}`);
  }
});

// ✅ Type-safe config
interface Config {
  dbPassword: string;
  apiKey: string;
  sessionSecret: string;
}

function loadConfig(): Config {
  const dbPassword = process.env.DB_PASSWORD;
  if (!dbPassword) throw new Error('DB_PASSWORD required');

  // ... validate all required vars

  return { dbPassword, apiKey, sessionSecret };
}
```

## Generate Strong Secrets

```bash
# Generate cryptographically secure secrets
node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"

# Or using OpenSSL
openssl rand -base64 32

# Or using head
head -c32 /dev/urandom | base64
```

## .gitignore Configuration

```bash
# .gitignore - NEVER commit secrets
.env
.env.local
.env.*.local
*.key
*.pem
secrets/
credentials.json
```

## Environment Example File

```bash
# .env.example - commit this to show required variables
DB_HOST=localhost
DB_PORT=5432
DB_NAME=myapp
DB_USER=
DB_PASSWORD=

API_KEY=
SESSION_SECRET=
JWT_SECRET=

# Copy to .env and fill in actual values
```

## Secrets in CI/CD

```yaml
# GitHub Actions
- name: Deploy
  env:
    DB_PASSWORD: ${{ secrets.DB_PASSWORD }}
    API_KEY: ${{ secrets.API_KEY }}
  run: ./deploy.sh

# ❌ Never echo secrets in logs
- name: Configure
  run: |
    echo "Configuring application..."
    # echo "DB_PASSWORD=$DB_PASSWORD"  # NEVER do this!
```

## Secrets Rotation

```typescript
// ✅ Support for rotating secrets
class SecretManager {
  async getSecret(name: string): Promise<string> {
    // Check for new secret first (during rotation)
    const newSecret = process.env[`${name}_NEW`];
    if (newSecret) {
      return newSecret;
    }

    const secret = process.env[name];
    if (!secret) {
      throw new Error(`Secret ${name} not found`);
    }
    return secret;
  }
}

// ✅ Accept multiple JWT signing keys during rotation
function verifyToken(token: string) {
  const keys = [process.env.JWT_SECRET, process.env.JWT_SECRET_OLD].filter(Boolean);

  for (const key of keys) {
    try {
      return jwt.verify(token, key);
    } catch {}
  }
  throw new Error('Invalid token');
}
```


---


## Performance

# Performance Basics

## Choose the Right Data Structure

Different data structures have different speeds for different operations.

### Arrays vs Objects vs Maps

```pseudocode
// ❌ Slow: Looking up in array (O(n))
users = [
    { id: 1, name: 'Alice' },
    { id: 2, name: 'Bob' },
    // ... 1000 more
]
user = users.find(u => u.id == 500)  // Checks 500 items

// ✅ Fast: Looking up in Map (O(1))
users = Map()
users.set(1, { id: 1, name: 'Alice' })
users.set(2, { id: 2, name: 'Bob' })

user = users.get(500)  // Instant lookup
```

### Arrays vs Sets

```pseudocode
// ❌ Slow: Checking if item exists in array
items = [1, 2, 3, 4, 5, ... 1000 more]
if items.contains(500):  // Checks every item

// ✅ Fast: Checking if item exists in Set
items = Set([1, 2, 3, 4, 5, ... 1000 more])
if items.has(500):  // Instant check
```

### When to Use Each

| Data Structure | Good For |
|----------------|----------|
| **Array/List** | Ordered items, iteration |
| **Object/Dict** | Key-value pairs (string keys) |
| **Map** | Key-value pairs (any type keys), frequent lookups |
| **Set** | Unique values, membership checks |

## Avoid N+1 Queries

One of the most common performance problems.

```pseudocode
// ❌ BAD: N+1 queries (1 + N database calls)
orders = database.query("SELECT * FROM orders")

for each order in orders:
    // Separate query for EACH order! 😱
    customer = database.query(
        "SELECT * FROM customers WHERE id = ?",
        [order.customer_id]
    )
    order.customer = customer
// If 100 orders = 101 database calls!

// ✅ GOOD: Single query with JOIN
ordersWithCustomers = database.query("
    SELECT
        orders.*,
        customers.name as customer_name,
        customers.email as customer_email
    FROM orders
    JOIN customers ON orders.customer_id = customers.id
")
// Only 1 database call!
```

## Don't Load What You Don't Need

```pseudocode
// ❌ Bad: Fetching entire object when you only need one field
user = database.query("SELECT * FROM users WHERE id = ?", [id])
print(user.email)

// ✅ Good: Fetch only what you need
result = database.query(
    "SELECT email FROM users WHERE id = ?",
    [id]
)
print(result.email)

// ❌ Bad: Loading all records
users = database.query("SELECT * FROM users")

// ✅ Good: Add LIMIT
users = database.query("SELECT * FROM users LIMIT 100")
```

## Use Async for I/O Operations

Don't block the program waiting for slow operations.

```pseudocode
// ❌ Slow: Blocking operations (synchronous)
file1 = readFileSync("file1.txt")
file2 = readFileSync("file2.txt")
file3 = readFileSync("file3.txt")
// Total: 300ms (100ms each, one after another)

// ✅ Fast: Async operations (parallel)
files = await Promise.all([
    readFile("file1.txt"),
    readFile("file2.txt"),
    readFile("file3.txt")
])
// Total: 100ms (all at once)
```

## Avoid Unnecessary Work in Loops

```pseudocode
// ❌ Bad: Work done every iteration
for i in 0 to items.length:
    total = calculateTotal(items)  // Recalculated each time!
    if items[i].price > total * 0.1:
        // ...

// ✅ Good: Work done once
total = calculateTotal(items)
for i in 0 to items.length:
    if items[i].price > total * 0.1:
        // ...

// ❌ Bad: Array length calculated each time
for i in 0 to items.length:
    // ...

// ✅ Good: Length cached (minor improvement)
len = items.length
for i in 0 to len:
    // ...

// ✅ Best: Modern for-each loop
for each item in items:
    // ...
```

## Index Your Database

Indexes make lookups fast, but slow down writes.

```sql
-- Without index: Checks every row
SELECT * FROM users WHERE email = 'alice@example.com';
-- With 1 million users: ~1 second

-- Add index
CREATE INDEX idx_users_email ON users(email);

-- Now same query is instant
SELECT * FROM users WHERE email = 'alice@example.com';
-- With 1 million users: ~1 millisecond
```

### When to Add Indexes

- Columns used in WHERE clauses
- Columns used in JOIN conditions
- Columns used in ORDER BY

```sql
-- Frequently queried
CREATE INDEX idx_orders_status ON orders(status);
CREATE INDEX idx_users_email ON users(email);

-- Used in joins
CREATE INDEX idx_orders_customer_id ON orders(customer_id);
```

## Cache Expensive Results

Don't recalculate the same thing repeatedly.

```pseudocode
// ❌ Bad: Calculating every time
function getReport(userId):
    data = expensiveCalculation(userId)  // 5 seconds
    return data

// Called 100 times = 500 seconds!

// ✅ Good: Cache results
cache = Map()

function getReport(userId):
    if cache.has(userId):
        return cache.get(userId)  // Instant

    data = expensiveCalculation(userId)
    cache.set(userId, data)
    return data

// First call: 5 seconds, next 99 calls: instant
```

## Batch Operations

Process multiple items together instead of one at a time.

```pseudocode
// ❌ Bad: Individual database calls
for each user in users:
    database.execute("INSERT INTO users (name) VALUES (?)", [user.name])
// 100 users = 100 database calls

// ✅ Good: Batch insert
database.execute("
    INSERT INTO users (name)
    VALUES " + users.map(u => "(?)").join(", "),
    users.map(u => u.name)
)
// 100 users = 1 database call
```

## Profile Before Optimizing

Don't guess where the problem is - measure!

```pseudocode
// Measure execution time
startTime = currentTime()
result = await slowOperation()
endTime = currentTime()
print("Operation took:", endTime - startTime, "ms")

// Measure specific parts
startDB = currentTime()
data = await database.query("...")
print("Database:", currentTime() - startDB, "ms")

startProcess = currentTime()
processed = processData(data)
print("Processing:", currentTime() - startProcess, "ms")
```

## Common Performance Mistakes

### Mistake 1: Nested Loops with Database Queries

```pseudocode
// ❌ TERRIBLE: Nested queries
for each user in users:
    for each order in orders:
        product = await database.query(
            "SELECT * FROM products WHERE id = ?",
            [order.product_id]
        )
// 100 users × 50 orders = 5000 database calls!

// ✅ GOOD: Load all data first
products = await database.query("SELECT * FROM products")
productMap = Map()
for each p in products:
    productMap.set(p.id, p)

for each user in users:
    for each order in orders:
        product = productMap.get(order.product_id)  // Instant
```

### Mistake 2: Loading Everything into Memory

```pseudocode
// ❌ Bad: Loading 1 million records
allUsers = await database.query("SELECT * FROM users")
// Crashes with out of memory!

// ✅ Good: Process in batches
BATCH_SIZE = 1000
offset = 0

while true:
    users = await database.query(
        "SELECT * FROM users LIMIT ? OFFSET ?",
        [BATCH_SIZE, offset]
    )

    if users.length == 0:
        break

    await processUsers(users)
    offset = offset + BATCH_SIZE
```

### Mistake 3: Not Using Indexes

```sql
-- ❌ Slow: No index on email column
SELECT * FROM users WHERE email = 'alice@example.com';
-- 1 million rows: ~2 seconds

-- ✅ Fast: Add index
CREATE INDEX idx_users_email ON users(email);
-- Same query: ~2 milliseconds
```

## Quick Performance Checklist

- [ ] Use Map/Set for lookups instead of Array
- [ ] Avoid N+1 queries (use JOINs)
- [ ] Add database indexes on frequently queried columns
- [ ] Don't load all records (use LIMIT)
- [ ] Cache expensive calculations
- [ ] Run independent operations in parallel
- [ ] Move work outside of loops
- [ ] Batch database operations
- [ ] Profile before optimizing

## When to Optimize

1. **Measure first** - Is there actually a problem?
2. **Find the bottleneck** - What's slow?
3. **Fix the biggest problem** - Don't waste time on small gains
4. **Measure again** - Did it help?

Don't optimize prematurely - write clear code first, optimize when needed!


# Async Performance Patterns

## Parallel Execution

```typescript
// ❌ Sequential - slow
async function getUserData(userId: string) {
  const user = await fetchUser(userId);       // 100ms
  const posts = await fetchPosts(userId);     // 150ms
  const comments = await fetchComments(userId); // 120ms
  return { user, posts, comments }; // Total: 370ms
}

// ✅ Parallel - fast
async function getUserData(userId: string) {
  const [user, posts, comments] = await Promise.all([
    fetchUser(userId),
    fetchPosts(userId),
    fetchComments(userId)
  ]);
  return { user, posts, comments }; // Total: 150ms
}

// ✅ Partial parallel with dependencies
async function getOrderDetails(orderId: string) {
  const order = await fetchOrder(orderId); // Must fetch first

  const [customer, items, shipping] = await Promise.all([
    fetchCustomer(order.customerId),
    fetchOrderItems(orderId),
    fetchShippingInfo(orderId)
  ]);

  return { order, customer, items, shipping };
}
```

## Promise.allSettled for Partial Failures

```typescript
// Return partial data instead of complete failure
async function getDashboard(userId: string) {
  const [user, orders, stats] = await Promise.allSettled([
    getUser(userId),
    getOrders(userId),
    getStats(userId)
  ]);

  return {
    user: user.status === 'fulfilled' ? user.value : null,
    orders: orders.status === 'fulfilled' ? orders.value : [],
    stats: stats.status === 'fulfilled' ? stats.value : null,
    errors: {
      user: user.status === 'rejected' ? user.reason.message : null,
      orders: orders.status === 'rejected' ? orders.reason.message : null,
      stats: stats.status === 'rejected' ? stats.reason.message : null
    }
  };
}
```

## Batch Processing

```typescript
// ❌ One at a time - slow
async function processUsers(userIds: string[]) {
  for (const id of userIds) {
    await updateUser(id);
  }
}

// ✅ Batch processing
async function processUsers(userIds: string[]) {
  const BATCH_SIZE = 50;

  for (let i = 0; i < userIds.length; i += BATCH_SIZE) {
    const batch = userIds.slice(i, i + BATCH_SIZE);
    await Promise.all(batch.map(id => updateUser(id)));
  }
}

// ✅ Bulk database operations
async function createUsers(users: User[]) {
  await db.query(`
    INSERT INTO users (name, email)
    VALUES ${users.map(() => '(?, ?)').join(', ')}
  `, users.flatMap(u => [u.name, u.email]));
}
```

## Debouncing and Throttling

```typescript
// Debounce: Wait until user stops typing
const debounce = <T extends (...args: any[]) => any>(
  fn: T,
  delay: number
): ((...args: Parameters<T>) => void) => {
  let timeoutId: NodeJS.Timeout;

  return (...args: Parameters<T>) => {
    clearTimeout(timeoutId);
    timeoutId = setTimeout(() => fn(...args), delay);
  };
};

// Throttle: Execute at most once per interval
const throttle = <T extends (...args: any[]) => any>(
  fn: T,
  limit: number
): ((...args: Parameters<T>) => void) => {
  let inThrottle: boolean;

  return (...args: Parameters<T>) => {
    if (!inThrottle) {
      fn(...args);
      inThrottle = true;
      setTimeout(() => (inThrottle = false), limit);
    }
  };
};

// Usage
const searchUsers = debounce(query => api.search(query), 300);
const handleScroll = throttle(() => console.log('scroll'), 100);
```

## Rate Limiting Concurrent Operations

```typescript
async function processWithLimit<T>(
  items: T[],
  fn: (item: T) => Promise<void>,
  concurrency: number
): Promise<void> {
  const chunks = [];
  for (let i = 0; i < items.length; i += concurrency) {
    chunks.push(items.slice(i, i + concurrency));
  }

  for (const chunk of chunks) {
    await Promise.all(chunk.map(fn));
  }
}

// Usage: Process 100 items, max 10 at a time
await processWithLimit(users, updateUser, 10);
```


---


## API Design

# API Basics

## HTTP Methods

Use the right method for each operation:

| Method | Purpose | Example |
|--------|---------|---------|
| GET | Read data | Get list of users |
| POST | Create new resource | Create a new user |
| PUT | Replace entire resource | Update all user fields |
| PATCH | Update part of resource | Update user's email only |
| DELETE | Remove resource | Delete a user |

## GET - Reading Data

```pseudocode
// Get all items
route GET "/api/users":
    users = getAllUsers()
    return JSON(users)

// Get single item by ID
route GET "/api/users/:id":
    user = getUserById(params.id)
    if user is null:
        return status 404, JSON({ error: "User not found" })
    return JSON(user)
```

## POST - Creating Data

```pseudocode
route POST "/api/users":
    name = request.body.name
    email = request.body.email

    // Validate input
    if name is empty or email is empty:
        return status 400, JSON({ error: "Name and email required" })

    newUser = createUser({ name, email })

    // Return 201 Created with new resource
    return status 201, JSON(newUser)
```

## PUT - Replacing Data

```pseudocode
route PUT "/api/users/:id":
    id = params.id
    name = request.body.name
    email = request.body.email

    user = getUserById(id)
    if user is null:
        return status 404, JSON({ error: "User not found" })

    updated = replaceUser(id, { name, email })
    return JSON(updated)
```

## PATCH - Updating Data

```pseudocode
route PATCH "/api/users/:id":
    id = params.id
    updates = request.body  // Only fields to update

    user = getUserById(id)
    if user is null:
        return status 404, JSON({ error: "User not found" })

    updated = updateUser(id, updates)
    return JSON(updated)
```

## DELETE - Removing Data

```pseudocode
route DELETE "/api/users/:id":
    id = params.id

    user = getUserById(id)
    if user is null:
        return status 404, JSON({ error: "User not found" })

    deleteUser(id)

    // 204 No Content - successful deletion
    return status 204
```

## HTTP Status Codes

### Success Codes (2xx)

```pseudocode
// 200 OK - Request succeeded
return status 200, JSON(data)

// 201 Created - New resource created
return status 201, JSON(newResource)

// 204 No Content - Success with no response body
return status 204
```

### Client Error Codes (4xx)

```pseudocode
// 400 Bad Request - Invalid input
return status 400, JSON({ error: "Invalid email format" })

// 401 Unauthorized - Not authenticated
return status 401, JSON({ error: "Login required" })

// 403 Forbidden - Authenticated but not allowed
return status 403, JSON({ error: "Admin access required" })

// 404 Not Found - Resource doesn't exist
return status 404, JSON({ error: "User not found" })

// 409 Conflict - Resource already exists
return status 409, JSON({ error: "Email already registered" })
```

### Server Error Codes (5xx)

```pseudocode
// 500 Internal Server Error - Unexpected error
return status 500, JSON({ error: "Internal server error" })

// 503 Service Unavailable - Temporary issue
return status 503, JSON({ error: "Database unavailable" })
```

## URL Structure

Use clear, hierarchical URLs:

```
✅ Good
GET  /api/users           # List all users
GET  /api/users/123       # Get user 123
POST /api/users           # Create user
GET  /api/users/123/posts # Get posts by user 123

❌ Bad
GET  /api/getUsers
POST /api/createUser
GET  /api/user?id=123
```

## Request and Response Format

### JSON Request Body

```
// Client sends
POST /api/users
Content-Type: application/json

{
  "name": "Alice",
  "email": "alice@example.com"
}
```

### JSON Response

```
// Server responds
HTTP/1.1 201 Created
Content-Type: application/json

{
  "id": 123,
  "name": "Alice",
  "email": "alice@example.com",
  "createdAt": "2024-01-15T10:30:00Z"
}
```

## Query Parameters

Use query parameters for filtering, sorting, and pagination:

```pseudocode
// Filter by status
// GET /api/orders?status=pending
route GET "/api/orders":
    status = query.status
    orders = getOrders({ status })
    return JSON(orders)

// Sort by field
// GET /api/users?sort=name

// Pagination
// GET /api/users?page=2&limit=20
```

## Error Responses

Always return consistent error format:

```pseudocode
// ✅ Good: Structured error
return status 400, JSON({
    error: {
        code: "VALIDATION_ERROR",
        message: "Invalid input",
        details: {
            email: "Email format is invalid"
        }
    }
})

// ❌ Bad: Inconsistent
return status 400, "Bad request"
return status 400, JSON({ msg: "Error" })
```

## Best Practices

1. **Use correct HTTP methods** - GET for reading, POST for creating, etc.
2. **Use appropriate status codes** - 200 for success, 404 for not found, etc.
3. **Return JSON** - Standard format for APIs
4. **Validate input** - Check data before processing
5. **Handle errors** - Return clear error messages

```pseudocode
// Complete example
route POST "/api/products":
    name = request.body.name
    price = request.body.price

    // Validate
    if name is empty or price is empty:
        return status 400, JSON({
            error: "Name and price are required"
        })

    if price < 0:
        return status 400, JSON({
            error: "Price cannot be negative"
        })

    // Check for duplicates
    if productExists(name):
        return status 409, JSON({
            error: "Product already exists"
        })

    // Create
    product = createProduct({ name, price })

    // Return success
    return status 201, JSON(product)
```

## Common Mistakes

```pseudocode
// ❌ Wrong method for operation
route GET "/api/users/delete/:id"  // Should be DELETE

// ❌ Wrong status code
route POST "/api/users":
    user = createUser(body)
    return status 200, JSON(user)  // Should be 201

// ❌ Not handling missing resources
route GET "/api/users/:id":
    user = getUserById(params.id)
    return JSON(user)  // What if user is null?

// ✅ Correct
route DELETE "/api/users/:id"

route POST "/api/users":
    user = createUser(body)
    return status 201, JSON(user)

route GET "/api/users/:id":
    user = getUserById(params.id)
    if user is null:
        return status 404, JSON({ error: "User not found" })
    return JSON(user)
```


# REST API Design

## Resource-Oriented URLs

```
✅ Good (nouns, plural)
GET    /api/v1/books           # List books
GET    /api/v1/books/123       # Get book
POST   /api/v1/books           # Create book
PUT    /api/v1/books/123       # Replace book
PATCH  /api/v1/books/123       # Update book
DELETE /api/v1/books/123       # Delete book

❌ Bad (verbs, actions)
POST /api/v1/createBook
GET  /api/v1/getBookById/123
POST /api/v1/updateBook/123
```

## HTTP Methods

```typescript
// GET - Read (safe, idempotent)
app.get('/api/v1/users/:id', async (req, res) => {
  const user = await userService.findById(req.params.id);
  res.json({ data: user });
});

// POST - Create (not idempotent)
app.post('/api/v1/users', async (req, res) => {
  const user = await userService.create(req.body);
  res.status(201)
    .location(`/api/v1/users/${user.id}`)
    .json({ data: user });
});

// PUT - Replace entire resource (idempotent)
app.put('/api/v1/users/:id', async (req, res) => {
  const user = await userService.replace(req.params.id, req.body);
  res.json({ data: user });
});

// PATCH - Partial update (idempotent)
app.patch('/api/v1/users/:id', async (req, res) => {
  const user = await userService.update(req.params.id, req.body);
  res.json({ data: user });
});

// DELETE - Remove (idempotent)
app.delete('/api/v1/users/:id', async (req, res) => {
  await userService.delete(req.params.id);
  res.status(204).end();
});
```

## Status Codes

```typescript
// Success
200 OK           // GET, PUT, PATCH succeeded
201 Created      // POST succeeded
204 No Content   // DELETE succeeded

// Client errors
400 Bad Request  // Validation failed
401 Unauthorized // Not authenticated
403 Forbidden    // Authenticated but not allowed
404 Not Found    // Resource doesn't exist
409 Conflict     // Duplicate, version conflict
422 Unprocessable // Business rule violation

// Server errors
500 Internal Server Error
```

## Response Format

```typescript
// Single resource
{
  "data": {
    "id": 123,
    "name": "John Doe",
    "email": "john@example.com"
  }
}

// Collection with pagination
{
  "data": [
    { "id": 1, "name": "Item 1" },
    { "id": 2, "name": "Item 2" }
  ],
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 150,
    "totalPages": 8
  }
}

// Error response
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "The request contains invalid data",
    "details": [
      { "field": "email", "message": "Invalid email format" }
    ]
  }
}
```

## Hierarchical Resources

```
✅ Limit nesting to 2-3 levels
GET /api/v1/authors/456/books       # Books by author
GET /api/v1/orders/789/items        # Items in order

❌ Too deep
GET /api/v1/publishers/1/authors/2/books/3/reviews/4

✅ Use query parameters instead
GET /api/v1/reviews?bookId=3
```

## API Versioning

```
✅ Always version from the start
/api/v1/books
/api/v2/books

❌ No version
/api/books
```


# API Pagination

## Always Paginate Collections

```typescript
// ✅ Paginated endpoint
app.get('/api/v1/books', async (req, res) => {
  const page = parseInt(req.query.page as string) || 1;
  const limit = Math.min(parseInt(req.query.limit as string) || 20, 100);

  const { data, total } = await bookService.findAll({ page, limit });

  res.json({
    data,
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
      hasNext: page * limit < total,
      hasPrevious: page > 1
    }
  });
});
```

## Offset-Based Pagination

```typescript
// Simple but has issues with large datasets
GET /api/v1/books?page=1&limit=20
GET /api/v1/books?page=2&limit=20

// Implementation
const getBooks = async (page: number, limit: number) => {
  const offset = (page - 1) * limit;

  const [data, total] = await Promise.all([
    db.query('SELECT * FROM books ORDER BY id LIMIT ? OFFSET ?', [limit, offset]),
    db.query('SELECT COUNT(*) FROM books')
  ]);

  return { data, total };
};
```

## Cursor-Based Pagination

```typescript
// Better for large datasets and real-time data
GET /api/v1/books?cursor=eyJpZCI6MTIzfQ&limit=20

// Response includes next cursor
{
  "data": [...],
  "pagination": {
    "nextCursor": "eyJpZCI6MTQzfQ",
    "hasMore": true
  }
}

// Implementation
const getBooks = async (cursor: string | null, limit: number) => {
  let query = 'SELECT * FROM books';

  if (cursor) {
    const { id } = decodeCursor(cursor);
    query += ` WHERE id > ${id}`;
  }

  query += ` ORDER BY id LIMIT ${limit + 1}`;
  const data = await db.query(query);

  const hasMore = data.length > limit;
  const items = hasMore ? data.slice(0, limit) : data;

  return {
    data: items,
    pagination: {
      nextCursor: hasMore ? encodeCursor({ id: items[items.length - 1].id }) : null,
      hasMore
    }
  };
};
```

## Keyset Pagination

```sql
-- Most efficient for large tables
-- First page
SELECT * FROM products
ORDER BY created_at DESC, id DESC
LIMIT 20;

-- Next page (using last item's values)
SELECT * FROM products
WHERE (created_at, id) < ('2024-01-15 10:00:00', 12345)
ORDER BY created_at DESC, id DESC
LIMIT 20;
```

## HATEOAS Links

```typescript
// Include navigation links
{
  "data": [...],
  "pagination": {
    "page": 2,
    "limit": 20,
    "total": 150
  },
  "links": {
    "self": "/api/v1/books?page=2&limit=20",
    "first": "/api/v1/books?page=1&limit=20",
    "prev": "/api/v1/books?page=1&limit=20",
    "next": "/api/v1/books?page=3&limit=20",
    "last": "/api/v1/books?page=8&limit=20"
  }
}
```

## Pagination Best Practices

```typescript
// ✅ Set reasonable defaults and limits
const page = parseInt(req.query.page) || 1;
const limit = Math.min(parseInt(req.query.limit) || 20, 100);

// ✅ Include total count (when practical)
const total = await db.count('books');

// ✅ Use consistent response structure
{
  "data": [],
  "pagination": { ... }
}

// ❌ Don't return unlimited results
// ❌ Don't allow page < 1 or limit < 1
```


# API Versioning

## Versioning Strategies

### URL Path Versioning
```
GET /api/v1/users
GET /api/v2/users
```

### Header Versioning
```
GET /api/users
Accept: application/vnd.api+json; version=2
```

### Query Parameter
```
GET /api/users?version=2
```

## Implementation

```typescript
// URL path versioning
app.use('/api/v1', v1Router);
app.use('/api/v2', v2Router);

// Header versioning middleware
function versionMiddleware(req, res, next) {
  const version = req.headers['api-version'] || '1';
  req.apiVersion = parseInt(version);
  next();
}

app.get('/users', versionMiddleware, (req, res) => {
  if (req.apiVersion >= 2) {
    return handleV2(req, res);
  }
  return handleV1(req, res);
});
```

## Deprecation Strategy

```typescript
// Add deprecation headers
res.setHeader('Deprecation', 'true');
res.setHeader('Sunset', 'Sat, 01 Jan 2025 00:00:00 GMT');
res.setHeader('Link', '</api/v2/users>; rel="successor-version"');
```

## Best Practices

- Version from the start
- Support at least N-1 versions
- Document deprecation timeline
- Provide migration guides
- Use semantic versioning for breaking changes
- Consider backwards-compatible changes first


---


## Code Style

# Naming Conventions

## Variables and Functions

```typescript
// camelCase for variables and functions
const userName = 'John';
const isActive = true;
const itemCount = 42;

function calculateTotal(items: Item[]): number {
  return items.reduce((sum, item) => sum + item.price, 0);
}

// Boolean variables: use is/has/can/should prefix
const isValid = validate(input);
const hasPermission = checkPermission(user);
const canEdit = user.role === 'admin';
const shouldRetry = error.code === 'TIMEOUT';

// Collections: use plural names
const users = getUsers();
const activeOrders = orders.filter(o => o.status === 'active');
```

## Constants

```typescript
// UPPER_SNAKE_CASE for constants
const MAX_RETRY_ATTEMPTS = 3;
const DEFAULT_TIMEOUT_MS = 5000;
const API_BASE_URL = 'https://api.example.com';

// Enum-like objects
const ORDER_STATUS = {
  PENDING: 'pending',
  PROCESSING: 'processing',
  SHIPPED: 'shipped',
  DELIVERED: 'delivered',
  CANCELLED: 'cancelled'
} as const;

const HTTP_STATUS = {
  OK: 200,
  CREATED: 201,
  BAD_REQUEST: 400,
  NOT_FOUND: 404
} as const;
```

## Classes and Types

```typescript
// PascalCase for classes and types
class UserService {
  constructor(private userRepository: UserRepository) {}
}

interface User {
  id: string;
  name: string;
  email: string;
}

type UserRole = 'admin' | 'editor' | 'viewer';

// Avoid prefixes
// ❌ IUser, CUser, TUser
// ✅ User
```

## Files and Modules

```typescript
// kebab-case for files
user-service.ts
order-repository.ts
create-user.dto.ts

// Match file name to primary export
// user-service.ts exports UserService
// order-repository.ts exports OrderRepository
```

## Avoid Bad Names

```typescript
// ❌ Bad - unclear
const d = Date.now();
const tmp = user.name;
const data = fetchData();
const flag = true;

// ✅ Good - descriptive
const currentDate = Date.now();
const originalUserName = user.name;
const customerOrders = fetchCustomerOrders();
const isEmailVerified = true;
```

## Avoid Magic Numbers

```typescript
// ❌ Magic numbers
if (user.age >= 18) { ... }
if (items.length > 100) { ... }
setTimeout(callback, 5000);

// ✅ Named constants
const LEGAL_AGE = 18;
const MAX_BATCH_SIZE = 100;
const DEFAULT_TIMEOUT_MS = 5000;

if (user.age >= LEGAL_AGE) { ... }
if (items.length > MAX_BATCH_SIZE) { ... }
setTimeout(callback, DEFAULT_TIMEOUT_MS);
```

## Consistency

```typescript
// Pick ONE style and stick with it across the project

// ✅ Consistent camelCase in APIs
{
  "userId": 123,
  "firstName": "John",
  "createdAt": "2024-01-01"
}

// ❌ Mixed styles
{
  "user_id": 123,      // snake_case
  "firstName": "John", // camelCase - inconsistent!
}
```


# Code Organization

## Function Length

```typescript
// ❌ Function too long (>50 lines)
function processOrder(orderId: string) {
  // 200 lines of validation, payment, inventory, shipping...
}

// ✅ Extract into smaller, focused functions
function processOrder(orderId: string) {
  const order = fetchOrder(orderId);

  validateOrder(order);
  reserveInventory(order.items);
  processPayment(order);
  scheduleShipping(order);
  sendConfirmation(order.customer.email);

  return order;
}
```

## Nesting Depth

```typescript
// ❌ Too much nesting (>3 levels)
if (user) {
  if (user.isActive) {
    if (user.hasPermission('edit')) {
      if (resource.isAvailable) {
        // Deep nesting is hard to follow
      }
    }
  }
}

// ✅ Guard clauses to reduce nesting
if (!user) return;
if (!user.isActive) return;
if (!user.hasPermission('edit')) return;
if (!resource.isAvailable) return;

// Clear logic at top level

// ✅ Extract complex conditions
function canEditResource(user: User, resource: Resource): boolean {
  return user &&
         user.isActive &&
         user.hasPermission('edit') &&
         resource.isAvailable;
}

if (canEditResource(user, resource)) {
  // Single level of nesting
}
```

## File Length

```typescript
// ❌ God file (1000+ lines)
// user-service.ts with 50 methods handling users, auth, permissions...

// ✅ Split into focused modules (~200-300 lines each)
// user-service.ts - CRUD operations
// auth-service.ts - login, logout, tokens
// permission-service.ts - role checks
```

## File Organization

```typescript
// Consistent structure within files:

// 1. Imports (grouped and ordered)
import fs from 'fs';                    // Standard library
import express from 'express';          // External dependencies
import { UserService } from './user';   // Internal modules

// 2. Constants and type definitions
const MAX_RETRIES = 3;

interface UserDTO {
  id: string;
  name: string;
}

// 3. Helper functions (if needed)
function validateInput(input: unknown): boolean {
  // ...
}

// 4. Main exports/classes
export class OrderService {
  // ...
}

// 5. Module initialization (if applicable)
export default new OrderService();
```

## Single Responsibility

```typescript
// ❌ Class doing too much
class UserManager {
  createUser() {}
  updateUser() {}
  sendEmail() {}
  hashPassword() {}
  generateToken() {}
}

// ✅ Split by responsibility
class UserRepository {
  create(user: User) {}
  update(id: string, data: Partial<User>) {}
}

class EmailService {
  send(to: string, template: string) {}
}

class PasswordService {
  hash(password: string): string {}
  verify(password: string, hash: string): boolean {}
}

class AuthService {
  generateToken(userId: string): string {}
}
```

## DRY (Don't Repeat Yourself)

```typescript
// ❌ Duplicated logic
function processUserOrder(order: Order) {
  const total = order.items.reduce((sum, i) => sum + i.price * i.quantity, 0);
  const tax = total * 0.08;
  return total + tax;
}

function processGuestOrder(order: Order) {
  const total = order.items.reduce((sum, i) => sum + i.price * i.quantity, 0);
  const tax = total * 0.08;
  return total + tax;
}

// ✅ Extract common logic
function calculateOrderTotal(items: Item[]): number {
  const subtotal = items.reduce((sum, i) => sum + i.price * i.quantity, 0);
  const tax = subtotal * 0.08;
  return subtotal + tax;
}

function processUserOrder(order: Order) {
  return calculateOrderTotal(order.items);
}
```


---


## Error Handling

# Error Handling Strategy

## Custom Error Classes

```typescript
class AppError extends Error {
  constructor(
    message: string,
    public statusCode: number = 500,
    public code: string = 'INTERNAL_ERROR',
    public details?: unknown
  ) {
    super(message);
    this.name = this.constructor.name;
    Error.captureStackTrace(this, this.constructor);
  }
}

class NotFoundError extends AppError {
  constructor(resource: string, id: string) {
    super(`${resource} with id ${id} not found`, 404, 'NOT_FOUND', { resource, id });
  }
}

class ValidationError extends AppError {
  constructor(message: string, details: unknown) {
    super(message, 400, 'VALIDATION_ERROR', details);
  }
}

// Usage
if (!user) {
  throw new NotFoundError('User', userId);
}
```

## Never Swallow Errors

```typescript
// ❌ Silent failure - dangerous!
try {
  await criticalOperation();
} catch (error) {
  // Error ignored
}

// ✅ Log and handle appropriately
try {
  await criticalOperation();
} catch (error) {
  logger.error('Critical operation failed', { error });
  throw error; // Or handle gracefully
}
```

## Specific Error Messages

```typescript
// ❌ Not actionable
throw new Error('Something went wrong');

// ✅ Specific and actionable
throw new ValidationError('Email must be a valid email address', {
  field: 'email',
  value: userInput.email
});
```

## Centralized Error Handler

```typescript
// Express error middleware
app.use((err: Error, req: Request, res: Response, next: NextFunction) => {
  if (err instanceof AppError) {
    return res.status(err.statusCode).json({
      error: {
        message: err.message,
        code: err.code,
        details: err.details
      }
    });
  }

  // Log unexpected errors
  console.error('Unexpected error:', err);

  // Don't expose internal details
  res.status(500).json({
    error: {
      message: 'Internal server error',
      code: 'INTERNAL_ERROR'
    }
  });
});
```

## Async Error Wrapper

```typescript
// Wrap async handlers to catch errors automatically
const asyncHandler = (fn: RequestHandler) => {
  return (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
};

// Usage
app.get('/users/:id', asyncHandler(async (req, res) => {
  const user = await getUser(req.params.id);
  res.json(user);
}));
```

## Result Type Pattern

```typescript
type Result<T, E = Error> =
  | { success: true; value: T }
  | { success: false; error: E };

function parseJSON<T>(json: string): Result<T, string> {
  try {
    return { success: true, value: JSON.parse(json) };
  } catch {
    return { success: false, error: 'Invalid JSON' };
  }
}

// Usage - forces explicit error handling
const result = parseJSON<User>(data);
if (result.success) {
  console.log(result.value.name);
} else {
  console.error(result.error);
}
```

## Error Boundaries (React)

```typescript
class ErrorBoundary extends React.Component {
  state = { hasError: false };

  static getDerivedStateFromError(error: Error) {
    return { hasError: true };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    logger.error('UI Error', { error, errorInfo });
  }

  render() {
    if (this.state.hasError) {
      return <FallbackUI />;
    }
    return this.props.children;
  }
}
```

## Retry with Limits

```typescript
// ❌ Infinite retries
while (true) {
  try {
    await operation();
    break;
  } catch (error) {
    // Retry forever - exhausts resources
  }
}

// ✅ Limited retries with backoff
const maxRetries = 3;
for (let i = 0; i < maxRetries; i++) {
  try {
    await operation();
    break;
  } catch (error) {
    if (i === maxRetries - 1) throw error;
    await sleep(Math.pow(2, i) * 1000); // Exponential backoff
  }
}
```


# Error Handling Basics

## Throwing Errors

Use `throw` to signal when something goes wrong.

```pseudocode
function divide(a, b):
    if b == 0:
        throw Error("Cannot divide by zero")
    return a / b
```

## Try-Catch

Use `try-catch` to handle errors gracefully.

```pseudocode
try:
    result = divide(10, 0)
    print(result)
catch error:
    print("Error:", error.message)
    // Continue with fallback behavior
```

## Always Provide Error Messages

Make error messages clear and actionable.

```pseudocode
// ❌ Bad: Vague error
throw Error("Invalid")

// ✅ Good: Specific error
throw Error("Email must be a valid email address")

// ✅ Good: Include context
throw Error("User with ID " + userId + " not found")
```

## Async Error Handling

Always use try-catch with async operations.

```pseudocode
async function loadUser(id):
    try:
        user = await fetchUser(id)
        return user
    catch error:
        log("Failed to load user:", error)
        throw error  // Re-throw if caller should know
```

## When to Catch Errors

### Catch When You Can Handle It

```pseudocode
// ✅ Good: Can provide fallback
async function getUserName(id):
    try:
        user = await fetchUser(id)
        return user.name
    catch error:
        return "Unknown User"  // Fallback value
```

### Don't Catch If You Can't Handle

```pseudocode
// ❌ Bad: Catching but doing nothing
try:
    await criticalOperation()
catch error:
    // Empty catch - error lost!

// ✅ Good: Let it propagate
await criticalOperation()  // Caller will handle
```

## Validate Input Early

Check for problems before they cause errors.

```pseudocode
function createUser(email, age):
    // Validate inputs first
    if email is empty:
        throw Error("Email is required")

    if not email.contains("@"):
        throw Error("Email must be valid")

    if age < 0:
        throw Error("Age cannot be negative")

    // Now proceed with creation
    return { email: email, age: age }
```

## Logging Errors

Always log errors for debugging.

```pseudocode
try:
    await processPayment(orderId)
catch error:
    // Log with context
    log("Payment processing failed:", {
        orderId: orderId,
        error: error.message,
        timestamp: currentTime()
    })
    throw error
```

## Error Handling Patterns

### Return Error Status

```pseudocode
function parseNumber(input):
    num = parseInt(input)
    if isNaN(num):
        return null  // Indicate failure without throwing
    return num

// Usage
result = parseNumber(userInput)
if result is null:
    print("Invalid number")
else:
    print("Number:", result)
```

### Return Success/Error Object

```pseudocode
function safeDivide(a, b):
    if b == 0:
        return { success: false, error: "Cannot divide by zero" }
    return { success: true, data: a / b }

// Usage
result = safeDivide(10, 2)
if result.success:
    print("Result:", result.data)
else:
    print("Error:", result.error)
```

## Common Mistakes

### Don't Swallow Errors

```pseudocode
// ❌ Bad: Error disappears
try:
    await importantOperation()
catch error:
    // Nothing here - error lost!

// ✅ Good: Log at minimum
try:
    await importantOperation()
catch error:
    log("Operation failed:", error)
    throw error  // Or handle appropriately
```

### Don't Use Errors for Flow Control

```pseudocode
// ❌ Bad: Using errors for normal logic
try:
    user = findUser(id)
    // ...
catch error:
    // User not found - this is expected, not an error!

// ✅ Good: Return null for expected cases
user = findUser(id)
if user is null:
    print("User not found")
    return
```

### Don't Throw Non-Error Objects

```pseudocode
// ❌ Bad
throw "Something went wrong"  // String
throw { code: 500 }           // Plain object

// ✅ Good
throw Error("Something went wrong")
```

## Best Practices

1. **Fail fast** - Validate input early and throw immediately
2. **Be specific** - Provide detailed, actionable error messages
3. **Log errors** - Always log for debugging
4. **Don't hide errors** - Let them propagate if you can't handle them
5. **Clean up resources** - Close connections, files in finally blocks

```pseudocode
file = null
try:
    file = await openFile("data.txt")
    await processFile(file)
catch error:
    log("File processing failed:", error)
    throw error
finally:
    // Always runs, even if error thrown
    if file is not null:
        await file.close()
```


---


## Architecture

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


# Layered Architecture

## Layer Structure

```
┌─────────────────────────────────────┐
│        Presentation Layer           │
│    (Controllers, Views, APIs)       │
└───────────────┬─────────────────────┘
                │
┌───────────────▼─────────────────────┐
│          Domain Layer               │
│    (Business Logic, Services)       │
└───────────────┬─────────────────────┘
                │
┌───────────────▼─────────────────────┐
│       Data Access Layer             │
│    (Repositories, ORM, DAOs)        │
└─────────────────────────────────────┘
```

## Presentation Layer

Handles user interaction and HTTP requests.

```typescript
class OrderController {
  constructor(private orderService: OrderService) {}

  async createOrder(req: Request, res: Response): Promise<void> {
    const dto = req.body as CreateOrderDTO;
    const result = await this.orderService.createOrder(dto);
    res.status(201).json(result);
  }
}
```

## Domain Layer

Contains business logic and rules.

```typescript
class OrderService {
  constructor(
    private orderRepository: OrderRepository,
    private productRepository: ProductRepository
  ) {}

  async createOrder(dto: CreateOrderDTO): Promise<Order> {
    const products = await this.productRepository.findByIds(dto.productIds);

    if (products.length !== dto.productIds.length) {
      throw new ProductNotFoundError();
    }

    const order = new Order(dto.customerId, products);
    order.calculateTotal();

    await this.orderRepository.save(order);
    return order;
  }
}
```

## Data Access Layer

Handles persistence operations.

```typescript
class OrderRepository {
  constructor(private db: Database) {}

  async save(order: Order): Promise<void> {
    await this.db.query(
      'INSERT INTO orders (id, customer_id, total) VALUES ($1, $2, $3)',
      [order.id, order.customerId, order.total]
    );
  }

  async findById(id: string): Promise<Order | null> {
    const row = await this.db.queryOne('SELECT * FROM orders WHERE id = $1', [id]);
    return row ? this.mapToOrder(row) : null;
  }
}
```

## Layer Rules

1. Upper layers depend on lower layers
2. Never skip layers
3. Each layer exposes interfaces to the layer above
4. Domain layer should not depend on data access implementation

## Best Practices

- Keep layers focused on their responsibility
- Use DTOs to transfer data between layers
- Define interfaces in domain layer, implement in data access
- Avoid business logic in presentation or data access layers
- Consider dependency inversion for testability


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


---


## DevOps

# CI/CD Practices

## Continuous Integration

Run on every commit:

```yaml
# .github/workflows/ci.yml
name: CI
on: [push, pull_request]

jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'npm'
      - run: npm ci
      - run: npm run lint
      - run: npm run typecheck
      - run: npm test
      - run: npm run build
```

## Continuous Deployment

Deploy automatically after CI passes:

```yaml
deploy:
  needs: build
  if: github.ref == 'refs/heads/main'
  runs-on: ubuntu-latest
  steps:
    - uses: actions/checkout@v4
    - run: npm ci
    - run: npm run build
    - run: npm run deploy
      env:
        DEPLOY_TOKEN: ${{ secrets.DEPLOY_TOKEN }}
```

## Deployment Strategies

### Blue-Green Deployment
Run two identical environments, switch traffic instantly.

### Canary Releases
Route small percentage of traffic to new version first.

### Rolling Updates
Gradually replace instances with new version.

## Best Practices

- Run fast tests first, slow tests later
- Cache dependencies between runs
- Use matrix builds for multiple versions/platforms
- Keep secrets in secure storage
- Automate database migrations
- Include rollback procedures
- Monitor deployments with health checks
- Use feature flags for safer releases


# Observability

## Overview

Observability is the ability to understand the internal state of a system by examining its outputs. In modern distributed systems, it goes beyond simple monitoring to include logging, metrics, and tracing.

## Three Pillars

### 1. Structured Logging

Logs should be machine-readable (JSON) and contain context.

```json
// ✅ Good: Structured JSON logging
{
  "level": "info",
  "message": "Order processed",
  "orderId": "ord_123",
  "userId": "user_456",
  "amount": 99.99,
  "durationMs": 145,
  "status": "success"
}
```
```text
// ❌ Bad: Unstructured text
"Order processed: ord_123 for user_456"
```

### 2. Metrics

Aggregatable data points for identifying trends and health.

- **Counters**: Total requests, error counts (`http_requests_total`)
- **Gauges**: Queue depth, memory usage (`memory_usage_bytes`)
- **Histograms**: Request latency distribution (`http_request_duration_seconds`)

### 3. Distributed Tracing

Tracking requests as they propagate through services.

- **Trace ID**: Unique ID for the entire request chain
- **Span ID**: Unique ID for a specific operation
- **Context Propagation**: Passing IDs between services (e.g., W3C Trace Context)

## Implementation Strategy

### OpenTelemetry (OTel)

Use OpenTelemetry as the vendor-neutral standard for collecting telemetry data.

```text
# Initialize OpenTelemetry SDK
SDK.Configure({
  TraceExporter: Console/OTLP,
  Instrumentations: [Http, Database, Grpc]
})
SDK.Start()
```

### Health Checks

Expose standard health endpoints:

- `/health/live`: Is the process running? (Liveness)
- `/health/ready`: Can it accept traffic? (Readiness)
- `/health/startup`: Has it finished initializing? (Startup)

## Alerting Best Practices

- **Alert on Symptoms, not Causes**: "High Error Rate" (Symptom) vs "CPU High" (Cause).
- **Golden Signals**: Latency, Traffic, Errors, Saturation.
- **Actionable**: Every alert should require a specific human action.


---


## Best Practices

# Planning Best Practices

## Plan Before Implementation

**ALWAYS design and plan before writing code:**

1. **Understand Requirements**
   - Clarify the goal and scope
   - Identify constraints and dependencies
   - Ask questions about ambiguous requirements

2. **Break Down Into Phases**
   - Divide work into logical phases
   - Define deliverables for each phase
   - Prioritize phases by value and dependencies

3. **Design First**
   - Sketch architecture and data flow
   - Identify components and interfaces
   - Consider edge cases and error scenarios

4. **Get User Approval**
   - Present the plan to stakeholders
   - Explain trade-offs and alternatives
   - Wait for approval before implementation

## Never Make Assumptions

**CRITICAL: When in doubt, ASK:**

```typescript
// ❌ BAD: Assuming what user wants
async function processOrder(orderId: string) {
  // Assuming we should send email, but maybe not?
  await sendConfirmationEmail(orderId);
  // Assuming payment is already captured?
  await fulfillOrder(orderId);
}

// ✅ GOOD: Clarify requirements first
// Q: Should we send confirmation email at this stage?
// Q: Is payment already captured or should we capture it here?
// Q: What happens if fulfillment fails?
```

**Ask about:**
- Expected behavior in edge cases
- Error handling strategy
- Performance requirements
- Security considerations
- User experience preferences

## Plan in Phases

**Structure work into clear phases:**

### Phase 1: Foundation
- Set up project structure
- Configure tooling and dependencies
- Create basic types and interfaces

### Phase 2: Core Implementation
- Implement main business logic
- Add error handling
- Write unit tests

### Phase 3: Integration
- Connect components
- Add integration tests
- Handle edge cases

### Phase 4: Polish
- Performance optimization
- Documentation
- Final review

**Checkpoint after each phase:**
- Demo functionality
- Get feedback
- Adjust plan if needed

## Planning Template

```markdown
## Goal
[What are we building and why?]

## Requirements
- [ ] Requirement 1
- [ ] Requirement 2
- [ ] Requirement 3

## Questions for Clarification
1. [Question about requirement X]
2. [Question about edge case Y]
3. [Question about preferred approach for Z]

## Proposed Approach
[Describe the solution]

## Phases
1. **Phase 1**: [Description]
   - Task 1
   - Task 2

2. **Phase 2**: [Description]
   - Task 1
   - Task 2

## Risks & Mitigation
- **Risk**: [Description]
  **Mitigation**: [How to handle]

## Alternatives Considered
- **Option A**: [Pros/Cons]
- **Option B**: [Pros/Cons]
- **Chosen**: Option A because [reason]
```

## Communication Principles

1. **Ask Early**: Don't wait until you're stuck
2. **Be Specific**: "Should error X retry or fail immediately?"
3. **Propose Options**: "Would you prefer A or B?"
4. **Explain Trade-offs**: "Fast but risky vs. Slow but safe"
5. **Document Decisions**: Record what was decided and why

## Anti-Patterns

❌ **Don't:**
- Start coding without understanding requirements
- Assume you know what the user wants
- Skip the planning phase to "save time"
- Make architectural decisions without discussion
- Proceed with unclear requirements

✅ **Do:**
- Ask questions when requirements are vague
- Create a plan and get it approved
- Break work into reviewable phases
- Document decisions and reasoning
- Communicate early and often


# Documentation Organization

## Keep Root Clean

**RULE: Documentation must NOT clutter the project root.**

```
❌ BAD: Root folder mess
project/
├── README.md
├── ARCHITECTURE.md
├── API_DOCS.md
├── DEPLOYMENT.md
├── TROUBLESHOOTING.md
├── USER_GUIDE.md
├── DATABASE_SCHEMA.md
├── TESTING_GUIDE.md
└── ... (20 more .md files)

✅ GOOD: Organized structure
project/
├── README.md              (overview only)
├── docs/
│   ├── architecture/
│   ├── api/
│   ├── deployment/
│   └── guides/
└── src/
```

## Documentation Structure

**Standard documentation folder:**

```
docs/
├── architecture/
│   ├── overview.md
│   ├── decisions/         # Architecture Decision Records
│   │   ├── 001-database-choice.md
│   │   └── 002-api-design.md
│   └── diagrams/
│
├── api/
│   ├── endpoints.md
│   ├── authentication.md
│   └── examples/
│
├── guides/
│   ├── getting-started.md
│   ├── development.md
│   ├── deployment.md
│   └── troubleshooting.md
│
├── features/              # Organize by feature
│   ├── user-auth/
│   │   ├── overview.md
│   │   ├── implementation.md
│   │   └── testing.md
│   ├── payments/
│   └── notifications/
│
└── planning/              # Active work planning
    ├── memory-lane.md     # Context preservation
    ├── current-phase.md   # Active work
    └── next-steps.md      # Backlog
```

## Memory Lane Document

**CRITICAL: Maintain context across sessions**

### Purpose
When AI context limit is reached, reload from memory lane to restore working context.

### Structure

```markdown
# Memory Lane - Project Context

## Last Updated
2024-12-10 15:30

## Current Objective
Implementing user authentication system with OAuth2 support

## Recent Progress
- ✅ Set up database schema (2024-12-08)
- ✅ Implemented user registration (2024-12-09)
- 🔄 Working on: OAuth2 integration (2024-12-10)
- ⏳ Next: Session management

## Key Decisions
1. **Database**: PostgreSQL chosen for ACID compliance
2. **Auth Strategy**: OAuth2 + JWT tokens
3. **Session Store**: Redis for performance

## Important Files
- `src/auth/oauth.ts` - OAuth2 implementation (IN PROGRESS)
- `src/models/user.ts` - User model and validation
- `docs/architecture/decisions/003-auth-system.md` - Full context

## Active Questions
1. Should we support refresh tokens? (Pending user decision)
2. Token expiry: 1h or 24h? (Pending user decision)

## Technical Context
- Using Passport.js for OAuth
- Google and GitHub providers configured
- Callback URLs: /auth/google/callback, /auth/github/callback

## Known Issues
- OAuth redirect not working in development (investigating)
- Need to add rate limiting to prevent abuse

## Next Session
1. Fix OAuth redirect issue
2. Implement refresh token rotation
3. Add comprehensive auth tests
```

### Update Frequency
- Update after each significant milestone
- Update before context limit is reached
- Update when switching between features

## Context Reload Strategy

**For AI Tools with Hooks:**

Create a hook to reload memory lane on startup:

```json
{
  "hooks": {
    "startup": {
      "command": "cat docs/planning/memory-lane.md"
    }
  }
}
```

**For AI Tools with Agents:**

Create a context restoration agent:

```markdown
# Context Restoration Agent

Task: Read and summarize current project state

Sources:
1. docs/planning/memory-lane.md
2. docs/architecture/decisions/ (recent ADRs)
3. git log --oneline -10 (recent commits)

Output: Concise summary of where we are and what's next
```

## Feature Documentation

**Organize by feature/scope, not by type:**

```
❌ BAD: Organized by document type
docs/
├── specifications/
│   ├── auth.md
│   ├── payments.md
│   └── notifications.md
├── implementations/
│   ├── auth.md
│   ├── payments.md
│   └── notifications.md
└── tests/
    ├── auth.md
    └── payments.md

✅ GOOD: Organized by feature
docs/features/
├── auth/
│   ├── specification.md
│   ├── implementation.md
│   ├── api.md
│   └── testing.md
├── payments/
│   ├── specification.md
│   ├── implementation.md
│   └── providers.md
└── notifications/
    ├── specification.md
    └── channels.md
```

**Benefits:**
- All related docs in one place
- Easy to find feature-specific information
- Natural scope boundaries
- Easier to maintain

## Planning Documents

**Active planning should be in docs/planning/:**

```
docs/planning/
├── memory-lane.md         # Context preservation
├── current-sprint.md      # Active work
├── backlog.md             # Future work
└── spike-results/         # Research findings
    ├── database-options.md
    └── auth-libraries.md
```

## Documentation Principles

1. **Separate folder**: All docs in `docs/` directory
2. **Organize by scope**: Group by feature, not document type
3. **Keep root clean**: Only README.md in project root
4. **Maintain memory lane**: Update regularly for context preservation
5. **Link related docs**: Use relative links between related documents

## README Guidelines

**Root README should be concise:**

```markdown
# Project Name

Brief description

## Quick Start
[Link to docs/guides/getting-started.md]

## Documentation
- [Architecture](docs/architecture/overview.md)
- [API Docs](docs/api/endpoints.md)
- [Development Guide](docs/guides/development.md)

## Contributing
[Link to CONTRIBUTING.md or docs/guides/contributing.md]
```

**Keep it short, link to detailed docs.**

## Anti-Patterns

❌ **Don't:**
- Put 10+ markdown files in project root
- Mix documentation types in same folder
- Forget to update memory lane before context expires
- Create documentation without clear organization
- Duplicate information across multiple docs

✅ **Do:**
- Use `docs/` directory for all documentation
- Organize by feature/scope
- Maintain memory lane for context preservation
- Link related documents together
- Update docs as code evolves


# Code Review Practices

## Review Checklist

- [ ] Code follows project style guidelines
- [ ] No obvious bugs or logic errors
- [ ] Error handling is appropriate
- [ ] Tests cover new functionality
- [ ] No security vulnerabilities introduced
- [ ] Performance implications considered
- [ ] Documentation updated if needed

## Giving Feedback

**Good:**
```
Consider using `Array.find()` here instead of `filter()[0]` -
it's more readable and stops at the first match.
```

**Bad:**
```
This is wrong.
```

## PR Description Template

```markdown
## Summary
Brief description of changes

## Changes
- Added X feature
- Fixed Y bug
- Refactored Z

## Testing
- [ ] Unit tests added
- [ ] Manual testing performed

## Screenshots (if UI changes)
```

## Best Practices

- Review promptly (within 24 hours)
- Focus on logic and design, not style (use linters)
- Ask questions rather than make demands
- Praise good solutions
- Keep PRs small and focused
- Use "nitpick:" prefix for minor suggestions
- Approve with minor comments when appropriate


# Refactoring Patterns

## Common Code Smells

### Long Method
Split into smaller, focused functions.

```typescript
// Before
function processOrder(order: Order) {
  // 100 lines of code...
}

// After
function processOrder(order: Order) {
  validateOrder(order);
  calculateTotals(order);
  applyDiscounts(order);
  saveOrder(order);
}
```

### Duplicate Code
Extract common logic.

```typescript
// Before
function getAdminUsers() {
  return users.filter(u => u.role === 'admin' && u.active);
}
function getModeratorUsers() {
  return users.filter(u => u.role === 'moderator' && u.active);
}

// After
function getActiveUsersByRole(role: string) {
  return users.filter(u => u.role === role && u.active);
}
```

### Primitive Obsession
Use value objects.

```typescript
// Before
function sendEmail(email: string) { /* ... */ }

// After
class Email {
  constructor(private value: string) {
    if (!this.isValid(value)) throw new Error('Invalid email');
  }
}
function sendEmail(email: Email) { /* ... */ }
```

### Feature Envy
Move method to class it uses most.

```typescript
// Before - Order is accessing customer too much
class Order {
  getDiscount() {
    return this.customer.isPremium() ?
      this.customer.premiumDiscount :
      this.customer.regularDiscount;
  }
}

// After
class Customer {
  getDiscount(): number {
    return this.isPremium() ? this.premiumDiscount : this.regularDiscount;
  }
}
```

## Safe Refactoring Steps

1. Ensure tests pass before refactoring
2. Make one small change at a time
3. Run tests after each change
4. Commit frequently
5. Refactor in separate commits from feature work

## Best Practices

- Refactor when adding features, not separately
- Keep refactoring commits separate
- Use IDE refactoring tools when available
- Write tests before refactoring if missing


# Version Control Patterns

## Branching Strategies

### GitHub Flow
Simple: main + feature branches.

```
main ─────●─────●─────●─────●─────
           \         /
feature     ●───●───●
```

### Git Flow
For scheduled releases: main, develop, feature, release, hotfix.

```
main    ─────●─────────────●─────
              \           /
release        ●─────────●
                \       /
develop  ●───●───●───●───●───●───
          \     /
feature    ●───●
```

## Commit Messages

```
feat: add user authentication

- Implement JWT-based auth
- Add login/logout endpoints
- Include password hashing

Closes #123
```

**Prefixes:**
- `feat:` - New feature
- `fix:` - Bug fix
- `refactor:` - Code change that doesn't fix bug or add feature
- `docs:` - Documentation only
- `test:` - Adding tests
- `chore:` - Maintenance tasks

## Best Practices

- Keep commits atomic and focused
- Write descriptive commit messages
- Pull/rebase before pushing
- Never force push to shared branches
- Use pull requests for code review
- Delete merged branches
- Tag releases with semantic versions


---


## Design Patterns

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


---


---
*Generated by aicgen*
