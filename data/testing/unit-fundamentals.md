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
