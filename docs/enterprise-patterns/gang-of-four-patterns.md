# Gang of Four Design Patterns

## Overview

Classic design patterns from "Design Patterns: Elements of Reusable Object-Oriented Software" by Gang of Four (GoF). These patterns solve common object-oriented design problems.

## Pattern Categories

- **Creational:** Object creation mechanisms
- **Structural:** Object composition and relationships
- **Behavioral:** Communication between objects

---

# Creational Patterns

## Singleton

### Definition

**Ensure a class has only one instance and provide a global access point to it.**

### When to Use

✅ **Good For:**
- Configuration management
- Connection pools
- Logging
- Caching

❌ **Avoid When:**
- Testing is important (hard to mock)
- Multiple instances might be needed later
- State management is complex

### Example

```typescript
class Database {
  private static instance: Database;
  private connection: any;

  private constructor() {
    this.connection = this.createConnection();
  }

  static getInstance(): Database {
    if (!Database.instance) {
      Database.instance = new Database();
    }
    return Database.instance;
  }

  query(sql: string): any {
    return this.connection.execute(sql);
  }

  private createConnection(): any {
    return { /* connection logic */ };
  }
}

// Usage
const db = Database.getInstance();
db.query('SELECT * FROM users');
```

### Better Alternative (Dependency Injection)

```typescript
// Instead of singleton, use DI container
class Database {
  constructor(private config: DatabaseConfig) {
    this.connection = this.createConnection(config);
  }
}

// DI container ensures single instance
container.registerSingleton('database', () => new Database(config));
```

---

## Factory Method

### Definition

**Define an interface for creating an object, but let subclasses decide which class to instantiate.**

### When to Use

✅ **Good For:**
- When class can't anticipate object types to create
- Subclasses specify objects to create
- Delegating responsibility to helper subclasses

### Example

```typescript
interface Logger {
  log(message: string): void;
}

class ConsoleLogger implements Logger {
  log(message: string): void {
    console.log(message);
  }
}

class FileLogger implements Logger {
  log(message: string): void {
    // Write to file
  }
}

abstract class Application {
  abstract createLogger(): Logger;

  run(): void {
    const logger = this.createLogger();
    logger.log('Application started');
  }
}

class DevelopmentApp extends Application {
  createLogger(): Logger {
    return new ConsoleLogger();
  }
}

class ProductionApp extends Application {
  createLogger(): Logger {
    return new FileLogger();
  }
}
```

---

## Abstract Factory

### Definition

**Provide an interface for creating families of related or dependent objects without specifying their concrete classes.**

### When to Use

✅ **Good For:**
- Systems with multiple product families
- Need to enforce product family constraints
- Hide concrete implementations

### Example

```typescript
interface Button {
  render(): void;
}

interface Checkbox {
  render(): void;
}

interface GUIFactory {
  createButton(): Button;
  createCheckbox(): Checkbox;
}

class WindowsButton implements Button {
  render(): void {
    console.log('Rendering Windows button');
  }
}

class MacButton implements Button {
  render(): void {
    console.log('Rendering Mac button');
  }
}

class WindowsFactory implements GUIFactory {
  createButton(): Button {
    return new WindowsButton();
  }

  createCheckbox(): Checkbox {
    return new WindowsCheckbox();
  }
}

class MacFactory implements GUIFactory {
  createButton(): Button {
    return new MacButton();
  }

  createCheckbox(): Checkbox {
    return new MacCheckbox();
  }
}

// Usage
function renderUI(factory: GUIFactory) {
  const button = factory.createButton();
  const checkbox = factory.createCheckbox();

  button.render();
  checkbox.render();
}

const os = getOS();
const factory = os === 'windows' ? new WindowsFactory() : new MacFactory();
renderUI(factory);
```

---

## Builder

### Definition

**Separate construction of a complex object from its representation, allowing same construction process to create different representations.**

### When to Use

✅ **Good For:**
- Objects with many optional parameters
- Step-by-step construction
- Immutable objects
- Complex initialization logic

### Example

```typescript
class Query {
  constructor(
    public table: string,
    public columns: string[],
    public where?: string,
    public orderBy?: string,
    public limit?: number
  ) {}

  toString(): string {
    let sql = `SELECT ${this.columns.join(', ')} FROM ${this.table}`;
    if (this.where) sql += ` WHERE ${this.where}`;
    if (this.orderBy) sql += ` ORDER BY ${this.orderBy}`;
    if (this.limit) sql += ` LIMIT ${this.limit}`;
    return sql;
  }
}

class QueryBuilder {
  private table: string = '';
  private columns: string[] = ['*'];
  private where?: string;
  private orderBy?: string;
  private limit?: number;

  from(table: string): this {
    this.table = table;
    return this;
  }

  select(...columns: string[]): this {
    this.columns = columns;
    return this;
  }

  whereClause(condition: string): this {
    this.where = condition;
    return this;
  }

  order(column: string): this {
    this.orderBy = column;
    return this;
  }

  take(count: number): this {
    this.limit = count;
    return this;
  }

  build(): Query {
    if (!this.table) {
      throw new Error('Table is required');
    }
    return new Query(
      this.table,
      this.columns,
      this.where,
      this.orderBy,
      this.limit
    );
  }
}

// Usage
const query = new QueryBuilder()
  .from('users')
  .select('id', 'name', 'email')
  .whereClause('age > 18')
  .order('name')
  .take(10)
  .build();

console.log(query.toString());
// SELECT id, name, email FROM users WHERE age > 18 ORDER BY name LIMIT 10
```

---

## Prototype

### Definition

**Specify kinds of objects to create using a prototypical instance, and create new objects by copying this prototype.**

### When to Use

✅ **Good For:**
- Avoiding expensive initialization
- Creating objects similar to existing ones
- Runtime object specification

### Example

```typescript
interface Cloneable<T> {
  clone(): T;
}

class Configuration implements Cloneable<Configuration> {
  constructor(
    public database: string,
    public port: number,
    public settings: Map<string, any>
  ) {}

  clone(): Configuration {
    return new Configuration(
      this.database,
      this.port,
      new Map(this.settings)
    );
  }
}

// Usage
const defaultConfig = new Configuration(
  'postgres://localhost',
  5432,
  new Map([['timeout', 3000]])
);

const testConfig = defaultConfig.clone();
testConfig.database = 'postgres://test-db';
testConfig.settings.set('timeout', 5000);
```

---

# Structural Patterns

## Adapter

### Definition

**Convert interface of a class into another interface clients expect, allowing incompatible interfaces to work together.**

### When to Use

✅ **Good For:**
- Integrating third-party libraries
- Working with legacy code
- Creating reusable components

### Example

```typescript
// Third-party library we can't modify
class OldPaymentSystem {
  makePayment(accountNumber: string, amount: number): boolean {
    console.log(`Old system: Paid ${amount} from account ${accountNumber}`);
    return true;
  }
}

// Our application interface
interface PaymentProcessor {
  processPayment(userId: string, amount: number): Promise<boolean>;
}

// Adapter
class PaymentAdapter implements PaymentProcessor {
  constructor(private oldSystem: OldPaymentSystem) {}

  async processPayment(userId: string, amount: number): Promise<boolean> {
    // Adapt new interface to old
    const accountNumber = await this.getUserAccountNumber(userId);
    return this.oldSystem.makePayment(accountNumber, amount);
  }

  private async getUserAccountNumber(userId: string): Promise<string> {
    // Convert user ID to account number
    return `ACC-${userId}`;
  }
}

// Usage
const oldSystem = new OldPaymentSystem();
const processor: PaymentProcessor = new PaymentAdapter(oldSystem);
await processor.processPayment('user-123', 100.00);
```

---

## Decorator

### Definition

**Attach additional responsibilities to an object dynamically, providing flexible alternative to subclassing for extending functionality.**

### When to Use

✅ **Good For:**
- Adding features to individual objects
- Composable behaviors
- Open/Closed Principle
- Avoiding feature explosion through inheritance

### Example

```typescript
interface Coffee {
  cost(): number;
  description(): string;
}

class SimpleCoffee implements Coffee {
  cost(): number {
    return 5;
  }

  description(): string {
    return 'Simple coffee';
  }
}

abstract class CoffeeDecorator implements Coffee {
  constructor(protected coffee: Coffee) {}

  cost(): number {
    return this.coffee.cost();
  }

  description(): string {
    return this.coffee.description();
  }
}

class MilkDecorator extends CoffeeDecorator {
  cost(): number {
    return this.coffee.cost() + 2;
  }

  description(): string {
    return this.coffee.description() + ', milk';
  }
}

class SugarDecorator extends CoffeeDecorator {
  cost(): number {
    return this.coffee.cost() + 1;
  }

  description(): string {
    return this.coffee.description() + ', sugar';
  }
}

// Usage
let coffee: Coffee = new SimpleCoffee();
console.log(`${coffee.description()}: $${coffee.cost()}`);
// Simple coffee: $5

coffee = new MilkDecorator(coffee);
coffee = new SugarDecorator(coffee);
console.log(`${coffee.description()}: $${coffee.cost()}`);
// Simple coffee, milk, sugar: $8
```

---

## Facade

### Definition

**Provide a unified interface to a set of interfaces in a subsystem, making the subsystem easier to use.**

### When to Use

✅ **Good For:**
- Simplifying complex systems
- Providing high-level interface
- Decoupling clients from subsystems
- Layered architecture

### Example

```typescript
// Complex subsystem
class CPU {
  freeze(): void { console.log('CPU frozen'); }
  jump(position: number): void { console.log(`CPU jumped to ${position}`); }
  execute(): void { console.log('CPU executing'); }
}

class Memory {
  load(position: number, data: string): void {
    console.log(`Memory loaded ${data} at ${position}`);
  }
}

class HardDrive {
  read(lba: number, size: number): string {
    console.log(`HardDrive read ${size} bytes from ${lba}`);
    return 'boot data';
  }
}

// Facade
class ComputerFacade {
  constructor(
    private cpu: CPU,
    private memory: Memory,
    private hardDrive: HardDrive
  ) {}

  start(): void {
    this.cpu.freeze();
    const bootData = this.hardDrive.read(0, 1024);
    this.memory.load(0, bootData);
    this.cpu.jump(0);
    this.cpu.execute();
  }
}

// Usage
const computer = new ComputerFacade(
  new CPU(),
  new Memory(),
  new HardDrive()
);

computer.start(); // Simple interface for complex operation
```

---

## Proxy

### Definition

**Provide a surrogate or placeholder for another object to control access to it.**

### Types

1. **Remote Proxy:** Represents object in different address space
2. **Virtual Proxy:** Lazy initialization
3. **Protection Proxy:** Access control
4. **Smart Proxy:** Additional actions when accessing

### Example

```typescript
interface Image {
  display(): void;
}

class RealImage implements Image {
  constructor(private filename: string) {
    this.loadFromDisk();
  }

  private loadFromDisk(): void {
    console.log(`Loading ${this.filename} from disk...`);
  }

  display(): void {
    console.log(`Displaying ${this.filename}`);
  }
}

class ImageProxy implements Image {
  private realImage?: RealImage;

  constructor(private filename: string) {}

  display(): void {
    if (!this.realImage) {
      this.realImage = new RealImage(this.filename); // Lazy load
    }
    this.realImage.display();
  }
}

// Usage
const image: Image = new ImageProxy('photo.jpg');
// Image not loaded yet

image.display(); // Loads and displays
// Loading photo.jpg from disk...
// Displaying photo.jpg

image.display(); // Just displays (already loaded)
// Displaying photo.jpg
```

---

# Behavioral Patterns

## Strategy

### Definition

**Define a family of algorithms, encapsulate each one, and make them interchangeable.**

### When to Use

✅ **Good For:**
- Multiple algorithms for same purpose
- Avoiding conditional logic
- Runtime algorithm selection
- Open/Closed Principle

### Example

```typescript
interface SortStrategy {
  sort(data: number[]): number[];
}

class QuickSort implements SortStrategy {
  sort(data: number[]): number[] {
    console.log('Using QuickSort');
    // QuickSort implementation
    return data.sort((a, b) => a - b);
  }
}

class MergeSort implements SortStrategy {
  sort(data: number[]): number[] {
    console.log('Using MergeSort');
    // MergeSort implementation
    return data.sort((a, b) => a - b);
  }
}

class Sorter {
  constructor(private strategy: SortStrategy) {}

  setStrategy(strategy: SortStrategy): void {
    this.strategy = strategy;
  }

  sort(data: number[]): number[] {
    return this.strategy.sort(data);
  }
}

// Usage
const sorter = new Sorter(new QuickSort());
sorter.sort([3, 1, 4, 1, 5, 9]);

sorter.setStrategy(new MergeSort());
sorter.sort([2, 7, 1, 8, 2, 8]);
```

---

## Observer

### Definition

**Define one-to-many dependency so when one object changes state, all dependents are notified automatically.**

### When to Use

✅ **Good For:**
- Event handling systems
- MVC/MVVM patterns
- Reactive programming
- Loosely coupled systems

### Example

```typescript
interface Observer {
  update(subject: Subject): void;
}

interface Subject {
  attach(observer: Observer): void;
  detach(observer: Observer): void;
  notify(): void;
}

class Stock implements Subject {
  private observers: Observer[] = [];
  private price: number = 0;

  attach(observer: Observer): void {
    this.observers.push(observer);
  }

  detach(observer: Observer): void {
    const index = this.observers.indexOf(observer);
    if (index > -1) {
      this.observers.splice(index, 1);
    }
  }

  notify(): void {
    for (const observer of this.observers) {
      observer.update(this);
    }
  }

  setPrice(price: number): void {
    this.price = price;
    this.notify();
  }

  getPrice(): number {
    return this.price;
  }
}

class StockDisplay implements Observer {
  constructor(private name: string) {}

  update(subject: Subject): void {
    if (subject instanceof Stock) {
      console.log(`${this.name}: Stock price changed to $${subject.getPrice()}`);
    }
  }
}

// Usage
const stock = new Stock();
const display1 = new StockDisplay('Display 1');
const display2 = new StockDisplay('Display 2');

stock.attach(display1);
stock.attach(display2);

stock.setPrice(100);
// Display 1: Stock price changed to $100
// Display 2: Stock price changed to $100
```

---

## Command

### Definition

**Encapsulate a request as an object, allowing parameterization and queuing of requests.**

### When to Use

✅ **Good For:**
- Undo/redo functionality
- Queuing operations
- Logging changes
- Transaction systems

### Example

```typescript
interface Command {
  execute(): void;
  undo(): void;
}

class TextEditor {
  private text: string = '';

  append(text: string): void {
    this.text += text;
  }

  delete(length: number): void {
    this.text = this.text.slice(0, -length);
  }

  getText(): string {
    return this.text;
  }
}

class AppendCommand implements Command {
  constructor(
    private editor: TextEditor,
    private text: string
  ) {}

  execute(): void {
    this.editor.append(this.text);
  }

  undo(): void {
    this.editor.delete(this.text.length);
  }
}

class CommandHistory {
  private history: Command[] = [];
  private current: number = -1;

  execute(command: Command): void {
    // Remove any commands after current position
    this.history = this.history.slice(0, this.current + 1);

    command.execute();
    this.history.push(command);
    this.current++;
  }

  undo(): void {
    if (this.current >= 0) {
      this.history[this.current].undo();
      this.current--;
    }
  }

  redo(): void {
    if (this.current < this.history.length - 1) {
      this.current++;
      this.history[this.current].execute();
    }
  }
}

// Usage
const editor = new TextEditor();
const history = new CommandHistory();

history.execute(new AppendCommand(editor, 'Hello '));
history.execute(new AppendCommand(editor, 'World'));
console.log(editor.getText()); // Hello World

history.undo();
console.log(editor.getText()); // Hello

history.redo();
console.log(editor.getText()); // Hello World
```

---

## Template Method

### Definition

**Define skeleton of algorithm in operation, deferring some steps to subclasses.**

### When to Use

✅ **Good For:**
- Common algorithm structure with variations
- Enforcing algorithm steps
- Avoiding code duplication

### Example

```typescript
abstract class DataProcessor {
  process(): void {
    this.readData();
    this.processData();
    this.writeData();
  }

  abstract readData(): void;
  abstract processData(): void;
  abstract writeData(): void;
}

class CSVProcessor extends DataProcessor {
  private data: string[] = [];

  readData(): void {
    console.log('Reading CSV file');
    this.data = ['row1', 'row2', 'row3'];
  }

  processData(): void {
    console.log('Processing CSV data');
    this.data = this.data.map(row => row.toUpperCase());
  }

  writeData(): void {
    console.log('Writing CSV file');
    console.log(this.data);
  }
}

class JSONProcessor extends DataProcessor {
  private data: any;

  readData(): void {
    console.log('Reading JSON file');
    this.data = { items: [1, 2, 3] };
  }

  processData(): void {
    console.log('Processing JSON data');
    this.data.items = this.data.items.map((x: number) => x * 2);
  }

  writeData(): void {
    console.log('Writing JSON file');
    console.log(this.data);
  }
}

// Usage
const csvProcessor = new CSVProcessor();
csvProcessor.process();

const jsonProcessor = new JSONProcessor();
jsonProcessor.process();
```

---

## Chain of Responsibility

### Definition

**Pass request along chain of handlers where each handler decides to process or pass to next handler.**

### When to Use

✅ **Good For:**
- Request processing pipelines
- Middleware systems
- Event bubbling
- Multiple handlers for single request

### Example

```typescript
interface Handler {
  setNext(handler: Handler): Handler;
  handle(request: string): string | null;
}

abstract class AbstractHandler implements Handler {
  private nextHandler?: Handler;

  setNext(handler: Handler): Handler {
    this.nextHandler = handler;
    return handler;
  }

  handle(request: string): string | null {
    if (this.nextHandler) {
      return this.nextHandler.handle(request);
    }
    return null;
  }
}

class AuthHandler extends AbstractHandler {
  handle(request: string): string | null {
    if (request.includes('auth')) {
      return 'AuthHandler: Request authenticated';
    }
    return super.handle(request);
  }
}

class LoggingHandler extends AbstractHandler {
  handle(request: string): string | null {
    console.log(`LoggingHandler: Logging request - ${request}`);
    return super.handle(request);
  }
}

class ValidationHandler extends AbstractHandler {
  handle(request: string): string | null {
    if (request.length > 0) {
      console.log('ValidationHandler: Request valid');
      return super.handle(request);
    }
    return 'ValidationHandler: Invalid request';
  }
}

// Usage
const auth = new AuthHandler();
const logging = new LoggingHandler();
const validation = new ValidationHandler();

auth.setNext(logging).setNext(validation);

console.log(auth.handle('auth request'));
// LoggingHandler: Logging request - auth request
// AuthHandler: Request authenticated
```

---

## Common Pattern Combinations

### Strategy + Factory

```typescript
interface PaymentStrategy {
  pay(amount: number): void;
}

class PaymentStrategyFactory {
  static create(type: string): PaymentStrategy {
    switch (type) {
      case 'credit': return new CreditCardStrategy();
      case 'paypal': return new PayPalStrategy();
      default: throw new Error('Unknown payment type');
    }
  }
}
```

### Observer + Singleton

```typescript
class EventBus {
  private static instance: EventBus;
  private observers = new Map<string, Observer[]>();

  static getInstance(): EventBus {
    if (!EventBus.instance) {
      EventBus.instance = new EventBus();
    }
    return EventBus.instance;
  }

  subscribe(event: string, observer: Observer): void {
    // Observer pattern implementation
  }
}
```

## Key Takeaways

**Creational:**
- Singleton: One instance
- Factory: Create objects without specifying class
- Builder: Construct complex objects step-by-step

**Structural:**
- Adapter: Make incompatible interfaces work
- Decorator: Add behavior dynamically
- Facade: Simplify complex systems

**Behavioral:**
- Strategy: Interchangeable algorithms
- Observer: Notify dependents of changes
- Command: Encapsulate requests as objects
