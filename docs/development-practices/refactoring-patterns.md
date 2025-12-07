# Refactoring Patterns & Best Practices

## When to Refactor

### Opportunistic Refactoring

**Camp Site Rule**: Always leave code cleaner than you found it.

```typescript
// When you see this while adding a feature
const processOrder = (order) => {
  if (order.type === 'standard') {
    const total = order.items.reduce((sum, item) => sum + item.price, 0);
    if (total > 100) {
      return total * 0.9;
    }
    return total;
  } else if (order.type === 'premium') {
    const total = order.items.reduce((sum, item) => sum + item.price, 0);
    return total * 0.85;
  }
  // ...
};

// Refactor before adding your feature
const calculateTotal = (items: OrderItem[]): number => {
  return items.reduce((sum, item) => sum + item.price, 0);
};

const applyDiscount = (total: number, orderType: string): number => {
  const discounts = {
    standard: total > 100 ? 0.9 : 1.0,
    premium: 0.85
  };
  return total * (discounts[orderType] || 1.0);
};

const processOrder = (order: Order): number => {
  const total = calculateTotal(order.items);
  return applyDiscount(total, order.type);
};
```

### Preparatory Refactoring

Refactor to make the next change easier.

```typescript
// Current code
class ReportGenerator {
  generate(data: any[]) {
    const html = '<html><body>';
    data.forEach(item => {
      html += `<p>${item.name}: ${item.value}</p>`;
    });
    html += '</body></html>';
    return html;
  }
}

// You need to add PDF export...
// First refactor to separate formatting from generation
class ReportGenerator {
  private formatAsHTML(data: any[]): string {
    let html = '<html><body>';
    data.forEach(item => {
      html += `<p>${item.name}: ${item.value}</p>`;
    });
    html += '</body></html>';
    return html;
  }

  generate(data: any[], format: 'html' | 'pdf'): string {
    if (format === 'html') {
      return this.formatAsHTML(data);
    }
    // Now adding PDF is easy
    return this.formatAsPDF(data);
  }
}
```

## Code Smells

### Long Method

```typescript
// ❌ Long method (hard to understand)
const processUserRegistration = async (userData: any) => {
  // Validation
  if (!userData.email) throw new Error('Email required');
  if (!userData.email.includes('@')) throw new Error('Invalid email');
  if (!userData.password) throw new Error('Password required');
  if (userData.password.length < 8) throw new Error('Password too short');

  // Check existing user
  const existing = await db.query('SELECT * FROM users WHERE email = ?', [userData.email]);
  if (existing.length > 0) throw new Error('Email already exists');

  // Hash password
  const salt = await bcrypt.genSalt(10);
  const hash = await bcrypt.hash(userData.password, salt);

  // Create user
  const user = await db.query('INSERT INTO users (email, password) VALUES (?, ?)', [
    userData.email,
    hash
  ]);

  // Send email
  const transporter = nodemailer.createTransport({ /* config */ });
  await transporter.sendMail({
    to: userData.email,
    subject: 'Welcome',
    html: '<h1>Welcome!</h1>'
  });

  return user;
};

// ✅ Extract Method refactoring
const validateUserData = (userData: UserData): void => {
  if (!userData.email) throw new Error('Email required');
  if (!userData.email.includes('@')) throw new Error('Invalid email');
  if (!userData.password) throw new Error('Password required');
  if (userData.password.length < 8) throw new Error('Password too short');
};

const checkEmailAvailability = async (email: string): Promise<void> => {
  const existing = await db.query('SELECT * FROM users WHERE email = ?', [email]);
  if (existing.length > 0) throw new Error('Email already exists');
};

const hashPassword = async (password: string): Promise<string> => {
  const salt = await bcrypt.genSalt(10);
  return bcrypt.hash(password, salt);
};

const sendWelcomeEmail = async (email: string): Promise<void> => {
  const transporter = nodemailer.createTransport({ /* config */ });
  await transporter.sendMail({
    to: email,
    subject: 'Welcome',
    html: '<h1>Welcome!</h1>'
  });
};

const processUserRegistration = async (userData: UserData) => {
  validateUserData(userData);
  await checkEmailAvailability(userData.email);

  const passwordHash = await hashPassword(userData.password);
  const user = await db.query('INSERT INTO users (email, password) VALUES (?, ?)', [
    userData.email,
    passwordHash
  ]);

  await sendWelcomeEmail(userData.email);

  return user;
};
```

### Large Class

```typescript
// ❌ God object doing everything
class UserManager {
  createUser(data: any) { /* ... */ }
  updateUser(id: string, data: any) { /* ... */ }
  deleteUser(id: string) { /* ... */ }
  validateEmail(email: string) { /* ... */ }
  hashPassword(password: string) { /* ... */ }
  sendWelcomeEmail(email: string) { /* ... */ }
  sendPasswordResetEmail(email: string) { /* ... */ }
  generateToken(userId: string) { /* ... */ }
  verifyToken(token: string) { /* ... */ }
  logActivity(userId: string, action: string) { /* ... */ }
  checkPermissions(userId: string, action: string) { /* ... */ }
  // 50 more methods...
}

// ✅ Extract Class refactoring
class UserRepository {
  create(data: UserData) { /* ... */ }
  update(id: string, data: Partial<UserData>) { /* ... */ }
  delete(id: string) { /* ... */ }
  findById(id: string) { /* ... */ }
}

class UserValidator {
  validateEmail(email: string) { /* ... */ }
  validatePassword(password: string) { /* ... */ }
}

class PasswordService {
  hash(password: string) { /* ... */ }
  verify(password: string, hash: string) { /* ... */ }
}

class EmailService {
  sendWelcome(email: string) { /* ... */ }
  sendPasswordReset(email: string) { /* ... */ }
}

class AuthService {
  generateToken(userId: string) { /* ... */ }
  verifyToken(token: string) { /* ... */ }
}

class PermissionService {
  check(userId: string, action: string) { /* ... */ }
}

// Coordinating service
class UserService {
  constructor(
    private userRepo: UserRepository,
    private validator: UserValidator,
    private passwordService: PasswordService,
    private emailService: EmailService
  ) {}

  async register(data: UserData) {
    this.validator.validateEmail(data.email);
    this.validator.validatePassword(data.password);

    const hash = await this.passwordService.hash(data.password);
    const user = await this.userRepo.create({ ...data, password: hash });

    await this.emailService.sendWelcome(user.email);

    return user;
  }
}
```

### Duplicate Code

```typescript
// ❌ Duplicated logic
const calculateOrderTotal = (order: Order) => {
  let total = 0;
  order.items.forEach(item => {
    total += item.price * item.quantity;
  });
  return total;
};

const calculateCartTotal = (cart: Cart) => {
  let total = 0;
  cart.items.forEach(item => {
    total += item.price * item.quantity;
  });
  return total;
};

const calculateInvoiceTotal = (invoice: Invoice) => {
  let total = 0;
  invoice.items.forEach(item => {
    total += item.price * item.quantity;
  });
  return total;
};

// ✅ Extract common function
const calculateItemsTotal = (items: LineItem[]): number => {
  return items.reduce((total, item) => total + item.price * item.quantity, 0);
};

const calculateOrderTotal = (order: Order) => calculateItemsTotal(order.items);
const calculateCartTotal = (cart: Cart) => calculateItemsTotal(cart.items);
const calculateInvoiceTotal = (invoice: Invoice) => calculateItemsTotal(invoice.items);
```

### Data Clumps

```typescript
// ❌ Data clumps (parameters always together)
const createUser = (
  firstName: string,
  lastName: string,
  street: string,
  city: string,
  state: string,
  zipCode: string
) => {
  // ...
};

const updateAddress = (
  userId: string,
  street: string,
  city: string,
  state: string,
  zipCode: string
) => {
  // ...
};

// ✅ Introduce Parameter Object
interface Address {
  street: string;
  city: string;
  state: string;
  zipCode: string;
}

interface UserName {
  firstName: string;
  lastName: string;
}

const createUser = (name: UserName, address: Address) => {
  // ...
};

const updateAddress = (userId: string, address: Address) => {
  // ...
};
```

### Primitive Obsession

```typescript
// ❌ Using primitives for domain concepts
const sendEmail = (to: string, subject: string, body: string) => {
  // What if 'to' is invalid? Type system doesn't help
};

const chargeCard = (amount: number, currency: string) => {
  // What if currency and amount don't match?
};

// ✅ Introduce Value Objects
class Email {
  private constructor(private readonly value: string) {
    if (!value.includes('@')) {
      throw new Error('Invalid email');
    }
  }

  static create(value: string): Email {
    return new Email(value);
  }

  toString(): string {
    return this.value;
  }
}

class Money {
  private constructor(
    private readonly amount: number,
    private readonly currency: string
  ) {
    if (amount < 0) throw new Error('Amount cannot be negative');
  }

  static create(amount: number, currency: string): Money {
    return new Money(amount, currency);
  }

  add(other: Money): Money {
    if (this.currency !== other.currency) {
      throw new Error('Cannot add different currencies');
    }
    return new Money(this.amount + other.amount, this.currency);
  }

  getAmount(): number {
    return this.amount;
  }

  getCurrency(): string {
    return this.currency;
  }
}

const sendEmail = (to: Email, subject: string, body: string) => {
  // Type safety enforced
};

const chargeCard = (amount: Money) => {
  // Currency mismatch caught at compile time
};
```

### Long Parameter List

```typescript
// ❌ Long parameter list
const createOrder = (
  userId: string,
  items: Item[],
  shippingAddress: Address,
  billingAddress: Address,
  paymentMethod: string,
  shippingMethod: string,
  discountCode: string,
  giftWrap: boolean,
  giftMessage: string,
  priority: boolean
) => {
  // Hard to remember parameter order
};

// ✅ Introduce Parameter Object
interface CreateOrderParams {
  userId: string;
  items: Item[];
  shippingAddress: Address;
  billingAddress: Address;
  paymentMethod: string;
  shippingMethod: string;
  discountCode?: string;
  gift?: {
    wrap: boolean;
    message: string;
  };
  priority?: boolean;
}

const createOrder = (params: CreateOrderParams) => {
  // Clear, self-documenting
};

// Usage
createOrder({
  userId: '123',
  items: [...],
  shippingAddress: {...},
  billingAddress: {...},
  paymentMethod: 'credit_card',
  shippingMethod: 'express',
  priority: true
});
```

## Refactoring Techniques

### Extract Function

```typescript
// Before
const printOwing = (invoice: Invoice) => {
  let outstanding = 0;

  console.log('***********************');
  console.log('**** Customer Owes ****');
  console.log('***********************');

  for (const order of invoice.orders) {
    outstanding += order.amount;
  }

  console.log(`Name: ${invoice.customer}`);
  console.log(`Amount: ${outstanding}`);
};

// After
const printBanner = () => {
  console.log('***********************');
  console.log('**** Customer Owes ****');
  console.log('***********************');
};

const calculateOutstanding = (orders: Order[]): number => {
  return orders.reduce((sum, order) => sum + order.amount, 0);
};

const printDetails = (customer: string, outstanding: number) => {
  console.log(`Name: ${customer}`);
  console.log(`Amount: ${outstanding}`);
};

const printOwing = (invoice: Invoice) => {
  printBanner();
  const outstanding = calculateOutstanding(invoice.orders);
  printDetails(invoice.customer, outstanding);
};
```

### Inline Function

```typescript
// Before (unnecessary indirection)
const getRating = (driver: Driver): number => {
  return moreThanFiveLateDeliveries(driver) ? 2 : 1;
};

const moreThanFiveLateDeliveries = (driver: Driver): boolean => {
  return driver.numberOfLateDeliveries > 5;
};

// After
const getRating = (driver: Driver): number => {
  return driver.numberOfLateDeliveries > 5 ? 2 : 1;
};
```

### Replace Conditional with Polymorphism

```typescript
// ❌ Type switching
class Bird {
  constructor(public type: string, public numberOfCoconuts: number, public voltage: number) {}

  get speed(): number {
    switch (this.type) {
      case 'European':
        return this.baseSpeed;
      case 'African':
        return this.baseSpeed - this.loadFactor * this.numberOfCoconuts;
      case 'Norwegian':
        return this.isNailed ? 0 : this.baseSpeed * this.voltage;
    }
  }

  get baseSpeed() {
    return 10;
  }

  get loadFactor() {
    return 2;
  }

  get isNailed() {
    return this.voltage > 100;
  }
}

// ✅ Polymorphism
abstract class Bird {
  abstract get speed(): number;
  protected get baseSpeed() {
    return 10;
  }
}

class EuropeanBird extends Bird {
  get speed(): number {
    return this.baseSpeed;
  }
}

class AfricanBird extends Bird {
  constructor(private numberOfCoconuts: number) {
    super();
  }

  get speed(): number {
    return this.baseSpeed - this.loadFactor * this.numberOfCoconuts;
  }

  private get loadFactor() {
    return 2;
  }
}

class NorwegianBird extends Bird {
  constructor(private voltage: number) {
    super();
  }

  get speed(): number {
    return this.isNailed ? 0 : this.baseSpeed * this.voltage;
  }

  private get isNailed() {
    return this.voltage > 100;
  }
}
```

### Replace Loop with Pipeline

```typescript
// Before
const names: string[] = [];
for (const person of people) {
  if (person.age >= 18) {
    names.push(person.name);
  }
}

// After
const names = people
  .filter(person => person.age >= 18)
  .map(person => person.name);

// More complex example
// Before
const result = [];
for (const order of orders) {
  if (order.status === 'completed') {
    let total = 0;
    for (const item of order.items) {
      total += item.price * item.quantity;
    }
    if (total > 100) {
      result.push({
        orderId: order.id,
        total: total
      });
    }
  }
}

// After
const result = orders
  .filter(order => order.status === 'completed')
  .map(order => ({
    orderId: order.id,
    total: order.items.reduce((sum, item) => sum + item.price * item.quantity, 0)
  }))
  .filter(order => order.total > 100);
```

### Decompose Conditional

```typescript
// Before
if (date.before(SUMMER_START) || date.after(SUMMER_END)) {
  charge = quantity * winterRate + winterServiceCharge;
} else {
  charge = quantity * summerRate;
}

// After
const isWinter = (date: Date): boolean => {
  return date.before(SUMMER_START) || date.after(SUMMER_END);
};

const winterCharge = (quantity: number): number => {
  return quantity * winterRate + winterServiceCharge;
};

const summerCharge = (quantity: number): number => {
  return quantity * summerRate;
};

const charge = isWinter(date)
  ? winterCharge(quantity)
  : summerCharge(quantity);
```

### Move Function

```typescript
// Before (function in wrong class)
class Account {
  overdraftCharge(): number {
    if (this.type === 'Premium') {
      return 10;
    } else {
      return 25;
    }
  }
}

// After (function moved to appropriate class)
class AccountType {
  overdraftCharge(): number {
    return this.isPremium ? 10 : 25;
  }
}

class Account {
  constructor(private accountType: AccountType) {}

  overdraftCharge(): number {
    return this.accountType.overdraftCharge();
  }
}
```

### Replace Magic Number with Named Constant

```typescript
// Before
const potentialEnergy = (mass: number, height: number): number => {
  return mass * 9.81 * height;
};

if (user.age < 18) {
  // Can't purchase
}

// After
const GRAVITATIONAL_CONSTANT = 9.81;
const MINIMUM_AGE = 18;

const potentialEnergy = (mass: number, height: number): number => {
  return mass * GRAVITATIONAL_CONSTANT * height;
};

if (user.age < MINIMUM_AGE) {
  // Can't purchase
}
```

### Encapsulate Collection

```typescript
// ❌ Direct access to collection
class Course {
  constructor(public students: Student[]) {}
}

const course = new Course([]);
course.students.push(new Student()); // Direct manipulation

// ✅ Encapsulated collection
class Course {
  private students: Student[] = [];

  addStudent(student: Student): void {
    this.students.push(student);
  }

  removeStudent(student: Student): void {
    const index = this.students.indexOf(student);
    if (index !== -1) {
      this.students.splice(index, 1);
    }
  }

  getStudents(): readonly Student[] {
    return Object.freeze([...this.students]); // Return copy
  }

  get numberOfStudents(): number {
    return this.students.length;
  }
}
```

## Refactoring Best Practices

### Small Steps

```typescript
// ✅ Refactor in tiny, testable increments
// Step 1: Extract variable
const price = order.quantity * order.itemPrice;
const discount = Math.max(0, order.quantity - 500) * order.itemPrice * 0.05;
const shipping = Math.min(price * 0.1, 100);
return price - discount + shipping;

// Step 2: Extract functions
const basePrice = (order) => order.quantity * order.itemPrice;
const quantityDiscount = (order) => Math.max(0, order.quantity - 500) * order.itemPrice * 0.05;
const shipping = (order) => Math.min(basePrice(order) * 0.1, 100);

return basePrice(order) - quantityDiscount(order) + shipping(order);

// Step 3: Create class
class PriceCalculator {
  constructor(private order: Order) {}

  get basePrice() {
    return this.order.quantity * this.order.itemPrice;
  }

  get quantityDiscount() {
    return Math.max(0, this.order.quantity - 500) * this.order.itemPrice * 0.05;
  }

  get shipping() {
    return Math.min(this.basePrice * 0.1, 100);
  }

  get total() {
    return this.basePrice - this.quantityDiscount + this.shipping;
  }
}
```

### Test Before and After

```typescript
// Always have tests before refactoring
describe('PriceCalculator', () => {
  it('should calculate correct total', () => {
    const order = { quantity: 600, itemPrice: 10 };
    const calculator = new PriceCalculator(order);

    expect(calculator.total).toBe(6050); // 6000 - 50 + 100
  });

  it('should apply no discount for small orders', () => {
    const order = { quantity: 100, itemPrice: 10 };
    const calculator = new PriceCalculator(order);

    expect(calculator.quantityDiscount).toBe(0);
  });
});

// Run tests: All pass ✓
// Refactor
// Run tests again: All pass ✓
```

### Separate Structural from Behavioral Changes

```bash
# ✅ Good commit history
commit abc123: Move calculatePrice to PriceService (structural)
commit def456: Add tax calculation to price (behavioral)

# ❌ Bad commit history
commit xyz789: Move calculatePrice and fix tax bug
# Can't tell what broke if this commit causes issues
```

### Don't Refactor and Add Features Simultaneously

```typescript
// ❌ Mixing refactoring with feature addition
const processOrder = (order: Order) => {
  // Refactoring old code
  const total = calculateTotal(order.items);

  // Adding new feature
  if (order.hasLoyaltyCard) {
    total = applyLoyaltyDiscount(total);
  }

  return total;
};

// ✅ Separate commits
// Commit 1: Refactor processOrder to use calculateTotal
// Commit 2: Add loyalty card discount feature
```

## When Not to Refactor

### Code You Don't Need to Modify

If code works and you're not changing it, leave it alone unless it's actively causing problems.

### Code You're About to Delete

Don't refactor code that's scheduled for removal.

### When You Don't Understand the Domain

Refactoring requires understanding why code exists. Learn first, refactor second.

### When Tests Are Missing

Add tests first, then refactor with confidence.

## References

- [Refactoring Catalog](https://refactoring.com/catalog/)
- [Code Smell](https://martinfowler.com/bliki/CodeSmell.html)
- [Opportunistic Refactoring](https://martinfowler.com/bliki/OpportunisticRefactoring.html)
- [Refactoring: This Class is Too Large](https://martinfowler.com/articles/class-too-large.html)
- [Parallel Change](https://martinfowler.com/bliki/ParallelChange.html)
