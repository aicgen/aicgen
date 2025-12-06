# Clean Code & Style Guide

## Code as Documentation

### Self-Explanatory Code

```
❌ Redundant comments (stating the obvious)
// Increment counter by 1
counter++

// Create new user object
user = new User()

// Loop through all items
for item in items:
    // Process each item
    process(item)

✅ Code explains itself
activeUsers = users.filter(u => u.isActive)
totalRevenue = orders.sum(order => order.total)
```

### When to Comment (WHY, not WHAT)

```
❌ Comments describing WHAT the code does
// Get the user from the database
user = database.findUser(userId)

// Check if user is admin
if user.role == 'admin':
    // Allow access
    return true

✅ Comments explaining WHY (business logic, edge cases)
// Skip validation for legacy users migrated before 2020
// These users have inconsistent data formats that would fail validation
if user.createdAt < Date('2020-01-01'):
    return processLegacyUser(user)

// Use exponential backoff to avoid overwhelming the payment gateway
// after it returns 429 rate limit errors
retryWithBackoff(chargePayment, maxAttempts=3, baseDelay=1000)

// Temporary workaround for bug in third-party library v2.3.1
// TODO: Remove when upgrading to v2.4.0 (fixes issue #1234)
sanitizedData = data.replace('\u0000', '')
```

### Comment Types That Add Value

```
1. Complex algorithms or business logic
/**
 * Calculates shipping cost using zone-based pricing with volume discounts.
 *
 * Zone 1 (local):     $5 base + $0.50/lb
 * Zone 2 (regional):  $10 base + $1.00/lb
 * Zone 3 (national):  $15 base + $1.50/lb
 *
 * Volume discounts applied for orders over 20 lbs:
 * - 10% discount for 20-50 lbs
 * - 15% discount for 50+ lbs
 */
function calculateShippingCost(weight, zone):
    // Implementation

2. Non-obvious constraints or requirements
// Phone numbers must be stored in E.164 format to ensure
// compatibility with our SMS provider's API
phoneRegex = /^\+[1-9]\d{1,14}$/

3. Performance considerations
// Using HashMap instead of linear search for O(1) lookups
// This dataset can contain 100,000+ items
userMap = new HashMap(users.map(u => [u.id, u]))

4. Security considerations
// Sanitize HTML to prevent XSS attacks
// Even though input is validated, defense in depth requires output encoding
sanitized = sanitizeHTML(userInput)

5. Deprecation warnings
/**
 * @deprecated Use createUserV2() instead. Will be removed in v3.0.0
 * Reason: Does not support new authentication flow
 */
function createUser(data):
    // Legacy implementation
```

### Avoid Commented-Out Code

```
❌ Dead code in comments
function processOrder(order):
    # tax = calculateTax(order)
    # shipping = calculateShipping(order)
    # return order.total + tax + shipping

    return order.total  # Which calculation is correct?

✅ Remove dead code, use version control
function processOrder(order):
    return order.total

# If you need to reference old implementation:
# See commit abc123 for previous tax calculation approach
```

## Naming Conventions

### Variables and Functions

```
Use descriptive names in your language's convention:
- camelCase (JavaScript, Java, C#)
- snake_case (Python, Ruby, Rust)
- PascalCase for types/classes

❌ Bad names
d = Date.now()           # What is 'd'?
tmp = user.name          # Temporary what?
data = fetchData()       # What data?
flag = true              # What flag?

✅ Descriptive names
currentDate = Date.now()
originalUserName = user.name
customerOrders = fetchCustomerOrders()
isEmailVerified = true

Boolean variables: use is/has/can/should prefix
isValid = validate(input)
hasPermission = checkPermission(user, resource)
canEdit = user.role == 'admin'
shouldRetry = error.code == 'TIMEOUT'

Collections: use plural names
users = getUsers()
activeOrders = orders.filter(o => o.status == 'active')
```

### Constants

```
Use UPPER_SNAKE_CASE for constants (most languages)

MAX_RETRY_ATTEMPTS = 3
DEFAULT_TIMEOUT_MS = 5000
API_BASE_URL = 'https://api.example.com'

Enum-like constants (structure depends on language)
ORDER_STATUS = {
    PENDING: 'pending',
    PROCESSING: 'processing',
    SHIPPED: 'shipped',
    DELIVERED: 'delivered',
    CANCELLED: 'cancelled'
}

HTTP_STATUS = {
    OK: 200,
    CREATED: 201,
    BAD_REQUEST: 400,
    UNAUTHORIZED: 401,
    NOT_FOUND: 404,
    INTERNAL_ERROR: 500
}
```

### Classes and Types

```
Use PascalCase for classes and types (most languages)

class UserService:
    def __init__(self, userRepository):
        self.userRepository = userRepository

class User:
    id: String
    name: String
    email: String

Avoid unnecessary prefixes
❌ IUser, CUser, TUser
✅ User
```

### Files and Modules

```
Match your language's convention:
- kebab-case: user-service.js, order-repository.py
- snake_case: user_service.py, order_repository.rb
- PascalCase: UserService.cs, OrderRepository.java

Match file name to primary export:
user_service.py exports UserService class
order_repository.rb exports OrderRepository class
```

## Code Structure

### Function Length

```
❌ Function too long (>50 lines)
function processOrder(orderId):
    # 200 lines of code doing validation, payment, inventory, shipping...

✅ Extract into smaller, focused functions
function processOrder(orderId):
    order = fetchOrder(orderId)

    validateOrder(order)
    reserveInventory(order.items)
    processPayment(order)
    scheduleShipping(order)
    sendConfirmation(order.customer.email)

    return order

Keep functions under 50 lines
If longer, extract logic into helper functions
```

### Nesting Depth

```
❌ Too much nesting (>3 levels)
if user:
    if user.isActive:
        if user.hasPermission('edit'):
            if resource.isAvailable:
                # Deep nesting is hard to follow

✅ Guard clauses to reduce nesting
if not user:
    return
if not user.isActive:
    return
if not user.hasPermission('edit'):
    return
if not resource.isAvailable:
    return

# Clear logic flow at top level

✅ Extract complex conditions
function canEditResource(user, resource):
    return user and \
           user.isActive and \
           user.hasPermission('edit') and \
           resource.isAvailable

if canEditResource(user, resource):
    # Single level of nesting
```

### File Length

```
❌ God file (1000+ lines)
# user_service.py
class UserService:
    # 50 methods handling users, auth, permissions, notifications...

✅ Split into focused modules
# user_service.py (~200 lines)
class UserService:
    def createUser(self):
        pass
    def updateUser(self):
        pass
    def deleteUser(self):
        pass

# auth_service.py (~150 lines)
class AuthService:
    def login(self):
        pass
    def logout(self):
        pass

# permission_service.py (~100 lines)
class PermissionService:
    def checkPermission(self):
        pass

Keep files under 300 lines
One class per file (except closely related types)
```

### File Organization

```
Consistent structure within files:

1. Imports/includes (grouped and ordered)
   - Standard library
   - External dependencies
   - Internal modules

2. Constants and type definitions

3. Helper functions (if needed)

4. Main exports/classes

5. Module initialization (if applicable)
```

## Logging Best Practices

### Structured Logging

```
✅ Include relevant context
log.info("User login successful", {
    userId: user.id,
    email: user.email,
    ipAddress: request.ip,
    userAgent: request.userAgent,
    timestamp: currentTime()
})

log.error("Payment processing failed", {
    orderId: order.id,
    userId: order.userId,
    amount: order.total,
    error: error.message,
    stackTrace: error.stack,
    paymentGateway: 'stripe'
})

❌ Unstructured logging
print("User logged in")              # No context
print("Error: " + error.toString())  # Limited info
```

### Log Levels

```
Use appropriate log levels:

ERROR: Application errors requiring attention
log.error("Database connection failed", {
    error: error.message,
    host: dbConfig.host,
    retryCount: 3
})

WARN: Potentially harmful situations
log.warn("API rate limit approaching", {
    currentRate: 950,
    limit: 1000,
    userId: user.id
})

INFO: Important business events
log.info("Order placed", {
    orderId: order.id,
    userId: user.id,
    total: order.total
})

DEBUG: Detailed diagnostic information (development only)
log.debug("Cache hit", {
    key: cacheKey,
    ttl: 3600
})

❌ Don't use print/console in production
print("User created")  # Use proper logger instead
```

### What to Log

```
✅ Log these events
log.info("User authentication", {userId: id, method: 'oauth'})
log.info("Payment processed", {orderId: id, amount: amt})
log.info("File uploaded", {userId: id, filename: name, size: bytes})
log.error("External API call failed", {service: svc, error: err})

❌ Don't log sensitive data
log.info("User login", {
    email: user.email,
    password: user.password  # NEVER log passwords!
})

log.debug("API request", {
    headers: request.headers  # May contain auth tokens
})

log.info("Payment details", {
    cardNumber: card.number  # NEVER log PII/PCI data
})

✅ Redact sensitive data
log.info("User login attempt", {
    email: user.email,
    password: '[REDACTED]'
})

log.info("Payment processed", {
    cardLast4: card.last4,  # Only last 4 digits
    amount: payment.amount
})
```

### Log Performance Impact

```
❌ Expensive operations in logs
log.debug("Processing items", {
    items: items.map(i => ({...i, details: getDetails(i)}))  # N database calls!
})

✅ Log only necessary data
log.debug("Processing items", {
    itemCount: items.length,
    itemIds: items.map(i => i.id).take(10)  # Sample only
})

✅ Use log levels to control verbosity
if logger.isDebugEnabled():
    # Only compute expensive logs when needed
    debugInfo = computeExpensiveDebugInfo()
    log.debug("Detailed info", debugInfo)
```

## Code Organization Patterns

### Single Responsibility

```
❌ Class doing too much
class UserManager:
    def createUser(self):
        pass
    def updateUser(self):
        pass
    def sendEmail(self):
        pass
    def hashPassword(self):
        pass
    def generateToken(self):
        pass

✅ Split by responsibility
class UserRepository:
    def create(self, user):
        pass
    def update(self, id, data):
        pass
    def delete(self, id):
        pass

class EmailService:
    def send(self, to, template, data):
        pass

class PasswordService:
    def hash(self, password):
        pass
    def verify(self, password, hash):
        pass

class AuthService:
    def generateToken(self, userId):
        pass
    def validateToken(self, token):
        pass
```

### DRY (Don't Repeat Yourself)

```
❌ Duplicated logic
function processUserOrder(order):
    total = sum(item.price * item.quantity for item in order.items)
    tax = total * 0.08
    return total + tax

function processGuestOrder(order):
    total = sum(item.price * item.quantity for item in order.items)
    tax = total * 0.08
    return total + tax

✅ Extract common logic
function calculateOrderTotal(items):
    subtotal = sum(item.price * item.quantity for item in items)
    tax = subtotal * 0.08
    return subtotal + tax

function processUserOrder(order):
    return calculateOrderTotal(order.items)

function processGuestOrder(order):
    return calculateOrderTotal(order.items)
```

### Avoid Premature Abstraction

```
❌ Over-engineered for simple case
abstract class AbstractUserFactory:
    abstract method createUser(type)

class ConcreteUserFactory extends AbstractUserFactory:
    method createUser(type):
        if type == 'regular':
            return new RegularUser()
        if type == 'admin':
            return new AdminUser()

✅ Simple is better when you only have 2 types
function createUser(type, data):
    if type == 'admin':
        return new AdminUser(data)
    return new RegularUser(data)

# Add abstraction when you have 5+ types and complexity justifies it
```

## Code Quality Rules

### Avoid Magic Numbers

```
❌ Magic numbers
if user.age >= 18:
    pass
if len(items) > 100:
    pass
setTimeout(callback, 5000)

✅ Named constants
LEGAL_AGE = 18
MAX_BATCH_SIZE = 100
DEFAULT_TIMEOUT_MS = 5000

if user.age >= LEGAL_AGE:
    pass
if len(items) > MAX_BATCH_SIZE:
    pass
setTimeout(callback, DEFAULT_TIMEOUT_MS)
```

### Positive Conditionals

```
❌ Double negatives are hard to read
if not user.isNotActive:
    # What does this mean?

✅ Positive conditions
if user.isActive:
    # Clear

❌ Negative variable names
isNotValid = not validate(input)
if isNotValid:
    pass

✅ Positive variable names
isValid = validate(input)
if not isValid:
    pass
```

### Explicit Over Implicit

```
❌ Implicit checks
if user:         # What if user is empty object?
    pass
if count:        # 0 is falsy but might be valid
    pass

✅ Explicit checks
if user is not None:
    pass
if count > 0:
    pass

❌ Implicit returns
function getUser(id):
    user = db.find(id)
    # Returns None/null if not found (implicit)

✅ Explicit returns
function getUser(id):
    user = db.find(id)
    return user if user else None  # Explicit null return
```

## General Guidelines

### Type Safety (if language supports)

```
✅ Use type annotations where available
function calculateTotal(items: List[Item]) -> float:
    return sum(item.price for item in items)

✅ Avoid dynamic/any types when possible
❌ data: any
✅ data: UserResponse

✅ Use generics for reusable code
class Repository<T>:
    def find(id: string) -> T:
        pass
```

### Error Handling

```
✅ Handle errors explicitly
try:
    result = dangerousOperation()
except SpecificError as e:
    logger.error("Operation failed", {error: e})
    raise CustomError("Failed to process", cause=e)

❌ Silent failures
try:
    dangerousOperation()
except:
    pass  # Error swallowed - dangerous!

❌ Generic errors
raise Exception("Something went wrong")

✅ Specific errors
raise ValidationError("Email must be valid", field='email')
```

### Immutability When Possible

```
✅ Prefer immutable data
CONST MAX_SIZE = 100        # Cannot be changed
user = {name: "John"}       # Create new object instead of mutating

❌ Mutating shared state
global_counter += 1         # Race conditions
user.name = "Jane"          # Side effects

✅ Return new values
function updateUser(user, newName):
    return {...user, name: newName}  # New object
```

## Code Formatting

### Automate Formatting

Use language-specific formatters:
- **Python**: Black, autopep8
- **JavaScript/TypeScript**: Prettier, ESLint
- **Java**: Google Java Format
- **Go**: gofmt (built-in)
- **Rust**: rustfmt (built-in)
- **C#**: dotnet format
- **Ruby**: RuboCop

```
Don't debate formatting in code reviews
Configure formatter, commit config to repo
Run automatically on save/commit
Focus reviews on logic, not style
```

### Consistent Indentation

```
Use your language's convention:
- 2 spaces: JavaScript, Ruby, YAML
- 4 spaces: Python, Java, C#
- Tabs: Go, Makefiles

Configure editor to match team standard
Never mix tabs and spaces
```

### Line Length

```
Keep lines under 80-120 characters
Break long lines at logical points

❌ Too long
result = calculateTotal(order.items) + calculateTax(order.items, order.location) + calculateShipping(order.items, order.destination)

✅ Logical breaks
result = (
    calculateTotal(order.items) +
    calculateTax(order.items, order.location) +
    calculateShipping(order.items, order.destination)
)
```

## Summary

**Core Principles:**
1. Code is read 10x more than written - optimize for readability
2. Comment WHY, not WHAT - code explains what
3. No redundant comments - self-documenting code
4. Functions < 50 lines, files < 300 lines
5. Nesting depth ≤ 3 levels
6. Descriptive names over comments
7. Extract, don't duplicate (DRY)
8. Simple solutions over clever ones
9. Explicit over implicit
10. Automate formatting - don't debate style

**Logging:**
- Use structured logging with context
- Appropriate log levels (ERROR, WARN, INFO, DEBUG)
- Never log passwords, tokens, or sensitive data
- Log business events, not debug statements in production

**Quality:**
- One responsibility per class/module
- No magic numbers - use named constants
- Positive conditionals over double negatives
- Type safety when language supports it
- Explicit error handling - no silent failures

## References

- [Clean Code by Robert C. Martin](https://www.amazon.com/Clean-Code-Handbook-Software-Craftsmanship/dp/0132350882)
- [Code Complete by Steve McConnell](https://www.amazon.com/Code-Complete-Practical-Handbook-Construction/dp/0735619670)
- [The Art of Readable Code](https://www.amazon.com/Art-Readable-Code-Practical-Techniques/dp/0596802293)
- [The Pragmatic Programmer](https://pragprog.com/titles/tpp20/the-pragmatic-programmer-20th-anniversary-edition/)
