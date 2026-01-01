# DevOps

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


---

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
