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
