# Distribution Patterns

## Overview

Distribution patterns handle the challenges of designing systems that communicate across process boundaries, addressing issues like network latency, data serialization, and coupling between distributed components.

## Pattern Selection Guide

| Pattern | Purpose | Network Calls | Coupling | Best For |
|---------|---------|--------------|----------|----------|
| Remote Facade | Coarse-grained interface | Minimal | Low | Reducing network overhead |
| Data Transfer Object | Data bundling | Reduced | Medium | Cross-boundary data transfer |
| Gateway | External system access | Encapsulated | Low | Third-party API integration |
| Service Stub | Testing doubles | None (mock) | Low | Testing distributed systems |

---

## Remote Facade

### Definition

**Provides a coarse-grained facade on fine-grained objects to improve efficiency over a network.**

### Purpose

Reduce network round trips by bundling multiple fine-grained operations into a single coarse-grained call.

### When to Use

✅ **Good For:**
- Distributed systems with network latency
- Microservices communication
- API design for external clients
- Reducing chattiness between layers
- Remote procedure calls (RPC, REST APIs)

❌ **Not Ideal For:**
- In-process communication
- When fine-grained control is required
- Single-deployment applications

### Example

❌ **Without Remote Facade (Chatty):**
```typescript
class CustomerService {
  async getCustomer(id: string): Promise<Customer> {
    return this.customerRepo.findById(id);
  }

  async getOrders(customerId: string): Promise<Order[]> {
    return this.orderRepo.findByCustomerId(customerId);
  }

  async getAddresses(customerId: string): Promise<Address[]> {
    return this.addressRepo.findByCustomerId(customerId);
  }
}

// Client makes 3 network calls
const customer = await api.getCustomer('123');        // Network call 1
const orders = await api.getOrders('123');            // Network call 2
const addresses = await api.getAddresses('123');      // Network call 3
```

✅ **With Remote Facade (Efficient):**
```typescript
interface CustomerDetails {
  customer: Customer;
  orders: Order[];
  addresses: Address[];
  recentActivity: Activity[];
}

class CustomerFacade {
  constructor(
    private customerRepo: CustomerRepository,
    private orderRepo: OrderRepository,
    private addressRepo: AddressRepository,
    private activityRepo: ActivityRepository
  ) {}

  async getCustomerDetails(customerId: string): Promise<CustomerDetails> {
    // Single coarse-grained operation
    const [customer, orders, addresses, recentActivity] = await Promise.all([
      this.customerRepo.findById(customerId),
      this.orderRepo.findByCustomerId(customerId),
      this.addressRepo.findByCustomerId(customerId),
      this.activityRepo.findRecentByCustomerId(customerId, 10)
    ]);

    if (!customer) {
      throw new Error('Customer not found');
    }

    return {
      customer,
      orders,
      addresses,
      recentActivity
    };
  }

  async updateCustomerProfile(
    customerId: string,
    profileData: {
      name?: string;
      email?: string;
      primaryAddress?: Address;
    }
  ): Promise<void> {
    // Bundle multiple updates into single call
    const customer = await this.customerRepo.findById(customerId);

    if (!customer) {
      throw new Error('Customer not found');
    }

    if (profileData.name) {
      customer.name = profileData.name;
    }

    if (profileData.email) {
      customer.email = profileData.email;
    }

    await this.customerRepo.save(customer);

    if (profileData.primaryAddress) {
      await this.addressRepo.setPrimary(customerId, profileData.primaryAddress);
    }
  }
}

// Client makes 1 network call instead of 3
const details = await api.getCustomerDetails('123'); // Single network call
```

### Best Practices

✅ **DO:**
- Design operations based on client use cases
- Bundle related data together
- Use DTOs for data transfer
- Keep facade stateless
- Document expected usage patterns
- Version your API

❌ **DON'T:**
- Expose fine-grained domain objects directly
- Create generic "get everything" methods
- Return more data than needed
- Make facade stateful
- Violate domain boundaries

### REST API Example

```typescript
class OrderFacadeController {
  constructor(
    private orderService: OrderService,
    private productService: ProductService,
    private customerService: CustomerService
  ) {}

  @Get('/api/orders/:id/complete-details')
  async getOrderCompleteDetails(
    @Param('id') orderId: string
  ): Promise<OrderCompleteDetailsDTO> {
    const order = await this.orderService.findById(orderId);
    const customer = await this.customerService.findById(order.customerId);
    const productIds = order.items.map(item => item.productId);
    const products = await this.productService.findByIds(productIds);

    return {
      order: {
        id: order.id,
        status: order.status,
        total: order.total,
        createdAt: order.createdAt
      },
      customer: {
        id: customer.id,
        name: customer.name,
        email: customer.email
      },
      items: order.items.map(item => ({
        product: products.find(p => p.id === item.productId),
        quantity: item.quantity,
        price: item.price
      }))
    };
  }

  @Post('/api/orders/:id/complete')
  async completeOrder(
    @Param('id') orderId: string,
    @Body() completion: OrderCompletionDTO
  ): Promise<void> {
    // Bundle multiple operations
    await this.orderService.markComplete(orderId);
    await this.orderService.sendConfirmationEmail(orderId);
    if (completion.createInvoice) {
      await this.orderService.generateInvoice(orderId);
    }
  }
}
```

---

## Data Transfer Object (DTO)

### Definition

**An object that carries data between processes, reducing the number of method calls.**

### Purpose

Bundle multiple values into a single object for transfer across process boundaries.

### When to Use

✅ **Good For:**
- Remote method calls
- API boundaries (REST, GraphQL, gRPC)
- Serialization across network
- Isolating internal models from external contracts
- Version isolation

❌ **Not Ideal For:**
- In-process communication
- When domain objects can be safely exposed
- Simple single-value transfers

### Example

```typescript
// Domain model (internal)
class Order {
  constructor(
    public id: string,
    public customer: Customer,
    public items: OrderItem[],
    public status: OrderStatus,
    public createdAt: Date,
    public updatedAt: Date
  ) {}

  calculateTotal(): Money {
    return this.items.reduce(
      (sum, item) => sum.add(item.subtotal()),
      Money.zero()
    );
  }

  canCancel(): boolean {
    return this.status === OrderStatus.Pending;
  }
}

// DTO for external API (simplified, serializable)
interface OrderDTO {
  id: string;
  customerId: string;
  customerName: string;
  items: OrderItemDTO[];
  status: string;
  total: number;
  currency: string;
  createdAt: string;
}

interface OrderItemDTO {
  productId: string;
  productName: string;
  quantity: number;
  unitPrice: number;
  subtotal: number;
}

// Mapper to convert between domain and DTO
class OrderDTOMapper {
  static toDTO(order: Order): OrderDTO {
    return {
      id: order.id,
      customerId: order.customer.id,
      customerName: order.customer.name,
      items: order.items.map(item => ({
        productId: item.product.id,
        productName: item.product.name,
        quantity: item.quantity,
        unitPrice: item.price.amount,
        subtotal: item.subtotal().amount
      })),
      status: order.status.toString(),
      total: order.calculateTotal().amount,
      currency: order.calculateTotal().currency,
      createdAt: order.createdAt.toISOString()
    };
  }

  static toDomain(dto: CreateOrderDTO, customer: Customer, products: Map<string, Product>): Order {
    const items = dto.items.map(itemDto => {
      const product = products.get(itemDto.productId);
      if (!product) {
        throw new Error(`Product ${itemDto.productId} not found`);
      }
      return new OrderItem(product, itemDto.quantity);
    });

    return new Order(
      generateId(),
      customer,
      items,
      OrderStatus.Pending,
      new Date(),
      new Date()
    );
  }
}

// API endpoint using DTO
class OrderController {
  @Post('/api/orders')
  async createOrder(@Body() dto: CreateOrderDTO): Promise<OrderDTO> {
    const customer = await this.customerService.findById(dto.customerId);
    const productIds = dto.items.map(item => item.productId);
    const products = await this.productService.findByIds(productIds);

    const order = OrderDTOMapper.toDomain(dto, customer, products);
    await this.orderService.create(order);

    return OrderDTOMapper.toDTO(order);
  }

  @Get('/api/orders/:id')
  async getOrder(@Param('id') id: string): Promise<OrderDTO> {
    const order = await this.orderService.findById(id);
    return OrderDTOMapper.toDTO(order);
  }
}
```

### DTO Variations

**1. Request DTO**
```typescript
interface CreateOrderRequest {
  customerId: string;
  items: Array<{
    productId: string;
    quantity: number;
  }>;
  shippingAddressId: string;
  paymentMethodId: string;
}
```

**2. Response DTO**
```typescript
interface OrderResponse {
  id: string;
  status: string;
  total: number;
  estimatedDelivery: string;
}
```

**3. Nested DTOs**
```typescript
interface CustomerDetailsDTO {
  customer: CustomerDTO;
  orders: OrderDTO[];
  addresses: AddressDTO[];
  paymentMethods: PaymentMethodDTO[];
}
```

**4. Versioned DTOs**
```typescript
interface OrderDTOV1 {
  id: string;
  total: number;
}

interface OrderDTOV2 {
  id: string;
  total: number;
  currency: string; // Added in v2
  tax: number;      // Added in v2
}
```

### Best Practices

✅ **DO:**
- Keep DTOs simple and serializable
- Use primitive types when possible
- Separate request and response DTOs
- Version your DTOs
- Validate DTO data
- Use mappers to convert domain ↔ DTO

❌ **DON'T:**
- Put business logic in DTOs
- Expose domain objects as DTOs
- Create one DTO per domain object automatically
- Include circular references
- Use complex types that don't serialize well

---

## Gateway

### Definition

**An object that encapsulates access to an external system or resource.**

### Purpose

Provide a simple interface to complex external systems, isolating your code from third-party APIs.

### When to Use

✅ **Good For:**
- Third-party API integration
- Legacy system integration
- External service abstraction
- Testability (can mock gateway)
- Isolating vendor-specific code

❌ **Not Ideal For:**
- Simple in-process calls
- When direct access is sufficient

### Example

```typescript
// Gateway interface (internal abstraction)
interface PaymentGateway {
  charge(amount: Money, paymentMethod: PaymentMethod): Promise<PaymentResult>;
  refund(transactionId: string, amount: Money): Promise<RefundResult>;
  getTransaction(transactionId: string): Promise<Transaction>;
}

// Stripe implementation
class StripePaymentGateway implements PaymentGateway {
  constructor(private stripeClient: Stripe) {}

  async charge(amount: Money, paymentMethod: PaymentMethod): Promise<PaymentResult> {
    try {
      // Map internal types to Stripe API
      const paymentIntent = await this.stripeClient.paymentIntents.create({
        amount: amount.cents, // Stripe uses cents
        currency: amount.currency.toLowerCase(),
        payment_method: paymentMethod.stripeId,
        confirm: true
      });

      // Map Stripe response to internal type
      return {
        success: paymentIntent.status === 'succeeded',
        transactionId: paymentIntent.id,
        amount: amount,
        timestamp: new Date(paymentIntent.created * 1000)
      };
    } catch (error) {
      // Translate Stripe errors to internal errors
      if (error.type === 'StripeCardError') {
        throw new PaymentDeclinedError(error.message);
      }
      throw new PaymentGatewayError('Payment failed', error);
    }
  }

  async refund(transactionId: string, amount: Money): Promise<RefundResult> {
    const refund = await this.stripeClient.refunds.create({
      payment_intent: transactionId,
      amount: amount.cents
    });

    return {
      success: refund.status === 'succeeded',
      refundId: refund.id,
      amount: Money.fromCents(refund.amount, amount.currency)
    };
  }

  async getTransaction(transactionId: string): Promise<Transaction> {
    const paymentIntent = await this.stripeClient.paymentIntents.retrieve(transactionId);

    return {
      id: paymentIntent.id,
      amount: Money.fromCents(paymentIntent.amount, paymentIntent.currency),
      status: this.mapStripeStatus(paymentIntent.status),
      createdAt: new Date(paymentIntent.created * 1000)
    };
  }

  private mapStripeStatus(stripeStatus: string): TransactionStatus {
    switch (stripeStatus) {
      case 'succeeded': return TransactionStatus.Completed;
      case 'processing': return TransactionStatus.Pending;
      case 'canceled': return TransactionStatus.Canceled;
      default: return TransactionStatus.Failed;
    }
  }
}

// PayPal implementation (same interface, different vendor)
class PayPalPaymentGateway implements PaymentGateway {
  constructor(private paypalClient: PayPalClient) {}

  async charge(amount: Money, paymentMethod: PaymentMethod): Promise<PaymentResult> {
    // Different implementation, same interface
    const order = await this.paypalClient.createOrder({
      intent: 'CAPTURE',
      purchase_units: [{
        amount: {
          currency_code: amount.currency,
          value: amount.toString()
        }
      }]
    });

    const capture = await this.paypalClient.captureOrder(order.id);

    return {
      success: capture.status === 'COMPLETED',
      transactionId: capture.id,
      amount: amount,
      timestamp: new Date(capture.create_time)
    };
  }

  // ... other methods
}

// Usage in service (vendor-agnostic)
class OrderService {
  constructor(private paymentGateway: PaymentGateway) {}

  async processPayment(order: Order): Promise<void> {
    const result = await this.paymentGateway.charge(
      order.total,
      order.paymentMethod
    );

    if (!result.success) {
      throw new PaymentFailedError('Payment processing failed');
    }

    order.markAsPaid(result.transactionId);
  }
}
```

### Gateway Pattern Variations

**1. API Gateway**
```typescript
class GitHubGateway {
  constructor(private httpClient: HttpClient, private apiKey: string) {}

  async getRepository(owner: string, repo: string): Promise<Repository> {
    const response = await this.httpClient.get(
      `https://api.github.com/repos/${owner}/${repo}`,
      {
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'Accept': 'application/vnd.github.v3+json'
        }
      }
    );

    return this.mapToRepository(response.data);
  }

  private mapToRepository(data: any): Repository {
    return {
      name: data.name,
      owner: data.owner.login,
      stars: data.stargazers_count,
      url: data.html_url
    };
  }
}
```

**2. Database Gateway**
```typescript
class UserGateway {
  constructor(private db: Database) {}

  async findById(id: string): Promise<User | null> {
    const row = await this.db.queryOne(
      'SELECT * FROM users WHERE id = $1',
      [id]
    );

    return row ? this.mapRowToUser(row) : null;
  }

  async findByEmail(email: string): Promise<User | null> {
    const row = await this.db.queryOne(
      'SELECT * FROM users WHERE email = $1',
      [email]
    );

    return row ? this.mapRowToUser(row) : null;
  }

  private mapRowToUser(row: any): User {
    return new User(row.id, row.name, row.email, row.created_at);
  }
}
```

### Best Practices

✅ **DO:**
- Define gateway interface in your domain
- Isolate vendor-specific code
- Map external types to internal types
- Translate external errors to domain errors
- Make gateways testable with mocks
- Version gateway interfaces

❌ **DON'T:**
- Expose third-party types in gateway interface
- Let external API structure leak into domain
- Create tight coupling to vendor
- Skip error translation

---

## Service Stub

### Definition

**Removes dependence on problematic services during testing by providing a simplified implementation.**

### Purpose

Enable testing of distributed systems without requiring actual external services.

### When to Use

✅ **Good For:**
- Unit testing distributed systems
- Development without external dependencies
- Simulating error conditions
- Performance testing
- Continuous integration

❌ **Not Ideal For:**
- Production code
- Integration testing (use real services)
- End-to-end testing

### Example

```typescript
// Real payment gateway
class StripePaymentGateway implements PaymentGateway {
  async charge(amount: Money, paymentMethod: PaymentMethod): Promise<PaymentResult> {
    // Real Stripe API call
    const paymentIntent = await this.stripeClient.paymentIntents.create({...});
    return {...};
  }
}

// Stub for testing
class StubPaymentGateway implements PaymentGateway {
  private shouldSucceed = true;
  private delay = 0;
  private transactionCounter = 1000;

  configureSuccess(shouldSucceed: boolean): void {
    this.shouldSucceed = shouldSucceed;
  }

  configureDelay(delayMs: number): void {
    this.delay = delayMs;
  }

  async charge(amount: Money, paymentMethod: PaymentMethod): Promise<PaymentResult> {
    if (this.delay > 0) {
      await sleep(this.delay);
    }

    if (!this.shouldSucceed) {
      throw new PaymentDeclinedError('Card declined (stub)');
    }

    return {
      success: true,
      transactionId: `stub-txn-${this.transactionCounter++}`,
      amount: amount,
      timestamp: new Date()
    };
  }

  async refund(transactionId: string, amount: Money): Promise<RefundResult> {
    return {
      success: this.shouldSucceed,
      refundId: `stub-refund-${this.transactionCounter++}`,
      amount: amount
    };
  }

  async getTransaction(transactionId: string): Promise<Transaction> {
    return {
      id: transactionId,
      amount: Money.dollars(100),
      status: TransactionStatus.Completed,
      createdAt: new Date()
    };
  }
}

// Test usage
describe('OrderService', () => {
  it('should process payment successfully', async () => {
    const stubGateway = new StubPaymentGateway();
    stubGateway.configureSuccess(true);

    const orderService = new OrderService(stubGateway);
    const order = createTestOrder();

    await orderService.processPayment(order);

    expect(order.status).toBe(OrderStatus.Paid);
  });

  it('should handle payment failure', async () => {
    const stubGateway = new StubPaymentGateway();
    stubGateway.configureSuccess(false); // Simulate failure

    const orderService = new OrderService(stubGateway);
    const order = createTestOrder();

    await expect(orderService.processPayment(order))
      .rejects.toThrow(PaymentFailedError);
  });
});
```

### Configurable Stubs

```typescript
class ConfigurableEmailStub implements EmailGateway {
  private sentEmails: Email[] = [];
  private shouldFail = false;
  private failureRate = 0;

  async send(email: Email): Promise<void> {
    if (this.shouldFail || Math.random() < this.failureRate) {
      throw new EmailSendError('Failed to send email (stub)');
    }

    this.sentEmails.push(email);
  }

  getSentEmails(): Email[] {
    return [...this.sentEmails];
  }

  wasEmailSentTo(recipient: string): boolean {
    return this.sentEmails.some(email => email.to === recipient);
  }

  configureFail(shouldFail: boolean): void {
    this.shouldFail = shouldFail;
  }

  configureFailureRate(rate: number): void {
    this.failureRate = rate;
  }

  reset(): void {
    this.sentEmails = [];
    this.shouldFail = false;
    this.failureRate = 0;
  }
}
```

### Best Practices

✅ **DO:**
- Implement same interface as real service
- Make stubs configurable for different scenarios
- Record calls for verification
- Simulate realistic delays
- Support error simulation

❌ **DON'T:**
- Use stubs in production
- Make stubs too complex
- Test stub implementation details
- Skip integration tests with real services

---

## Common Pitfalls

❌ **Chatty Communication:** Too many fine-grained network calls
❌ **God DTOs:** DTOs that contain everything
❌ **Leaky Abstraction:** Gateway exposing vendor details
❌ **Missing Facades:** Direct access to fine-grained services
❌ **Tight Coupling:** Domain depending on external APIs
❌ **No Versioning:** Breaking API changes affecting clients

## Key Takeaways

1. **Remote Facade:** Bundle operations to reduce network overhead
2. **DTO:** Transfer data across boundaries with simple, serializable objects
3. **Gateway:** Isolate external systems, map types at boundary
4. **Service Stub:** Enable testing without external dependencies
5. **Always version** your APIs and DTOs
6. **Map at boundaries** - don't let external types leak into domain
