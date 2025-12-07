# TypeScript Generics

## Basic Generic Functions

```typescript
// ✅ Generic function for type-safe operations
function first<T>(array: T[]): T | undefined {
  return array[0];
}

const numbers = [1, 2, 3];
const firstNumber = first(numbers); // Type: number | undefined

const users = [{ name: 'John' }];
const firstUser = first(users); // Type: { name: string } | undefined
```

## Generic Interfaces

```typescript
// ✅ Generic repository pattern
interface Repository<T> {
  findById(id: string): Promise<T | null>;
  findAll(): Promise<T[]>;
  create(entity: Omit<T, 'id'>): Promise<T>;
  update(id: string, data: Partial<T>): Promise<T>;
  delete(id: string): Promise<void>;
}

class UserRepository implements Repository<User> {
  async findById(id: string): Promise<User | null> {
    return this.db.users.findUnique({ where: { id } });
  }
  // ... other methods
}
```

## Generic Constraints

```typescript
// ✅ Constrain generic types
interface HasId {
  id: string;
}

function getById<T extends HasId>(items: T[], id: string): T | undefined {
  return items.find(item => item.id === id);
}

// Works with any type that has an id
getById(users, '123');
getById(products, '456');
```

## Mapped Types

```typescript
// ✅ Create transformed types
type Nullable<T> = {
  [K in keyof T]: T[K] | null;
};

type NullableUser = Nullable<User>;
// { id: string | null; name: string | null; ... }

// ✅ Conditional types
type ExtractArrayType<T> = T extends Array<infer U> ? U : never;

type StringArrayElement = ExtractArrayType<string[]>; // string
```

## Default Generic Parameters

```typescript
// ✅ Provide defaults for flexibility
interface ApiResponse<T = unknown, E = Error> {
  data?: T;
  error?: E;
  status: number;
}

// Can use with or without type parameters
const response1: ApiResponse<User> = { data: user, status: 200 };
const response2: ApiResponse = { status: 500, error: new Error('Failed') };
```
