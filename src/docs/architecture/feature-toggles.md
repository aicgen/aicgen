# Feature Toggles (Feature Flags) Guidelines

## Overview

Feature toggles allow modifying system behavior without code changes through configuration management. They enable trunk-based development, A/B testing, graceful degradation, and controlled feature rollout.

## Toggle Categories

### 1. Release Toggles
**Purpose:** Enable trunk-based development by allowing incomplete features to ship as dormant code

**Characteristics:**
- Separate feature release from code deployment
- Typically transient (days to weeks)
- Static configuration
- Low dynamism

**Use Cases:**
- Continuous deployment with incomplete features
- Dark launching
- Gradual feature rollout

### 2. Experiment Toggles
**Purpose:** Support A/B testing and multivariate analysis

**Characteristics:**
- Highly dynamic (per-request decisions)
- Based on user cohorts
- Short-lived (hours to weeks)
- Requires analytics integration

**Use Cases:**
- A/B testing
- Multivariate experiments
- User experience optimization

### 3. Ops Toggles
**Purpose:** Control operational behavior for system stability

**Characteristics:**
- Manual operator control
- Short to long-lived
- Static to semi-dynamic
- "Kill switch" functionality

**Use Cases:**
- Graceful degradation under load
- Circuit breakers
- Performance tuning
- Emergency shutdowns

### 4. Permissioning Toggles
**Purpose:** Gate features by user type or permissions

**Characteristics:**
- Long-lived (years)
- Highly dynamic (per-request)
- Based on user identity/roles
- Integrated with auth system

**Use Cases:**
- Premium features
- Beta access
- Internal tools
- Canary deployments

## Implementation Patterns

### Decouple Decision Points from Logic

❌ **Avoid:**
```typescript
function processOrder(order: Order) {
  if (featureFlags.get('new-pricing')) {
    return newPricingService.calculate(order);
  }
  return legacyPricingService.calculate(order);
}
```

✅ **Prefer:**
```typescript
class FeatureDecisions {
  getPricingService(): PricingService {
    return this.flags.get('new-pricing')
      ? new NewPricingService()
      : new LegacyPricingService();
  }
}

function processOrder(order: Order, decisions: FeatureDecisions) {
  return decisions.getPricingService().calculate(order);
}
```

### Inversion of Control

❌ **Avoid:**
```typescript
class OrderProcessor {
  process(order: Order) {
    const useNewFlow = FeatureFlags.global.get('new-flow');
    // ...
  }
}
```

✅ **Prefer:**
```typescript
class OrderProcessor {
  constructor(private useNewFlow: boolean) {}

  process(order: Order) {
    if (this.useNewFlow) {
      // ...
    }
  }
}

// At composition root
const processor = new OrderProcessor(
  featureDecisions.isNewFlowEnabled()
);
```

### Strategy Pattern Over Conditionals

❌ **Avoid:**
```typescript
function handlePayment(order: Order) {
  if (featureFlags.get('payment-v2')) {
    // v2 logic
  } else if (featureFlags.get('payment-v1-enhanced')) {
    // v1 enhanced logic
  } else {
    // legacy logic
  }
}
```

✅ **Prefer:**
```typescript
interface PaymentStrategy {
  process(order: Order): Promise<PaymentResult>;
}

class PaymentProcessor {
  constructor(private strategy: PaymentStrategy) {}

  async process(order: Order) {
    return this.strategy.process(order);
  }
}
```

## Configuration Management

### Progression of Sophistication

**1. Hardcoded/Commented Code**
- Requires redeployment
- Suitable only for developer-managed short-term toggles

**2. Environment Variables/Parameters**
- Configuration without rebuilding
- Still requires redeployment
- Good for ops toggles

**3. Configuration Files**
- YAML/JSON in source control
- Supports environment-specific overrides
- May require redeployment

**4. Application Database**
- Centralized store with admin UI
- Runtime reconfiguration across fleet
- No redeployment needed

**5. Distributed Systems**
- Zookeeper, etcd, Consul
- Real-time cluster-wide synchronization
- Automatic propagation
- Best for large-scale systems

### Per-Request Overrides

Allow toggle state modification via:
- Cookies
- Query parameters
- HTTP headers

**Use Cases:**
- Testing without affecting other users
- Developer debugging
- QA verification

⚠️ **Security Consideration:** Introduces security surface; implement proper access controls

## Managing Toggle Lifecycle

### Treat Toggles as Inventory

Feature toggles have carrying costs and should be kept to minimum.

### Best Practices

✅ **Create Removal Tasks:**
Create backlog items for toggle removal alongside creation

✅ **Set Expiration Dates:**
Include creation dates and expected lifetime in config

✅ **Implement Time Bombs:**
Fail tests or prevent startup if toggles exceed expiration

✅ **Cap Total Toggles:**
Enforce maximum limits; require removing old before adding new

### Example Configuration

```yaml
features:
  new-checkout:
    enabled: true
    created: 2024-12-01
    expires: 2025-01-15
    owner: checkout-team
    description: "New streamlined checkout flow"
    type: release-toggle

  premium-dashboard:
    enabled: true
    created: 2024-06-01
    owner: product-team
    description: "Premium user dashboard"
    type: permissioning-toggle
```

## Testing Strategies

### Test Multiple States

✅ **Test:**
- Toggle ON (new behavior)
- Toggle OFF (legacy behavior)
- Expected production state

❌ **Avoid:**
- Testing every combination (combinatorial explosion)
- Only testing one state

### Semantic Conventions

✅ **Adopt Standard:**
- OFF = legacy behavior
- ON = new behavior

Prevents surprise regressions and clarifies intent

### Dynamic Reconfiguration in Tests

```typescript
describe('Order Processing', () => {
  it('uses new flow when enabled', async () => {
    await featureFlags.set('new-flow', true);
    const result = await processOrder(order);
    expect(result).toMatchNewFlowBehavior();
  });

  it('uses legacy flow when disabled', async () => {
    await featureFlags.set('new-flow', false);
    const result = await processOrder(order);
    expect(result).toMatchLegacyBehavior();
  });
});
```

### Restrict Override Access

- Limit dynamic reconfiguration to automated tests
- Require authentication for debugging overrides
- Log all toggle state changes
- Audit override usage

## Placement Considerations

### Edge Services
Place per-request toggles (Experiment, Permissioning) at system edges:
- API gateways
- Frontend applications
- BFFs (Backend for Frontend)

Where user context is available

### Core Services
Technical toggles controlling internal implementation:
- Reside within the service they modify
- Not exposed at system edges
- Managed by service owners

## Additional Best Practices

### Expose Configuration

```typescript
app.get('/meta/features', (req, res) => {
  res.json({
    features: {
      'new-checkout': featureFlags.get('new-checkout'),
      'premium-dashboard': featureFlags.get('premium-dashboard')
    },
    version: '1.2.3',
    build: '2024-12-06-1234'
  });
});
```

### Structured Configuration

Include in config files:
- Human-readable descriptions
- Creation dates
- Contact information
- Toggle type/category
- Expected lifespan

### Manage by Category

Different toggle types require different management:
- **Release:** Aggressive cleanup
- **Experiment:** Short-term, analytics-driven
- **Ops:** Long-term, operator-controlled
- **Permissioning:** Very long-term, user-driven

## Common Pitfalls

❌ **Toggle Debt:** Accumulating too many toggles over time
❌ **Nested Conditionals:** Complex if/else chains
❌ **Testing Explosion:** Trying to test all combinations
❌ **Permanent Toggles:** Keeping release toggles indefinitely
❌ **Global State:** Using global feature flag accessors everywhere
❌ **Poor Naming:** Unclear toggle purposes
❌ **Missing Documentation:** No context for future developers

## Anti-Patterns to Avoid

❌ Feature flags scattered throughout codebase
❌ No expiration strategy
❌ Testing only one toggle state
❌ Using feature flags for configuration
❌ Nested feature flag checks
❌ No audit trail of toggle changes
❌ Permanent "temporary" toggles
