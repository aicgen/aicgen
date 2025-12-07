# Distribution Patterns

## Remote Facade

Coarse-grained interface to reduce network calls.

```typescript
// Bad: Multiple network calls
const customer = await api.getCustomer(id);
const orders = await api.getOrders(id);
const addresses = await api.getAddresses(id);

// Good: Single call via facade
const details = await api.getCustomerDetails(id);
// Returns { customer, orders, addresses }
```

## Data Transfer Object (DTO)

Bundle data for transfer across boundaries.

```typescript
interface OrderDTO {
  id: string;
  customerId: string;
  items: OrderItemDTO[];
  total: number;
  status: string;
}

class OrderDTOMapper {
  static toDTO(order: Order): OrderDTO {
    return {
      id: order.id,
      customerId: order.customer.id,
      items: order.items.map(i => this.itemToDTO(i)),
      total: order.total.amount,
      status: order.status.toString()
    };
  }
}
```

## Gateway

Abstract external system access.

```typescript
interface PaymentGateway {
  charge(amount: Money, method: PaymentMethod): Promise<PaymentResult>;
}

class StripeGateway implements PaymentGateway {
  async charge(amount: Money, method: PaymentMethod): Promise<PaymentResult> {
    const result = await this.stripe.paymentIntents.create({
      amount: amount.cents,
      currency: amount.currency
    });
    return this.mapToResult(result);
  }
}
```

## Service Stub

Test double for external services.

```typescript
class StubPaymentGateway implements PaymentGateway {
  private shouldSucceed = true;

  async charge(amount: Money): Promise<PaymentResult> {
    if (!this.shouldSucceed) throw new PaymentDeclinedError();
    return { success: true, transactionId: 'stub-123' };
  }

  configureFail(): void { this.shouldSucceed = false; }
}
```

## Best Practices

- Design facades around client use cases
- Keep DTOs simple and serializable
- Isolate vendor code in gateways
- Use stubs for testing, not production
