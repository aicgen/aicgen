# DevOps Best Practices & Guidelines

## CI/CD Pipeline Patterns

### Build Pipeline Structure

```yaml
# .github/workflows/ci-cd.yml
name: CI/CD Pipeline

on:
  push:
    branches: [main]
  pull_request:
    branches: [main]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v2
      - name: Install dependencies
        run: npm ci
      - name: Lint
        run: npm run lint
      - name: Unit tests
        run: npm test
      - name: Integration tests
        run: npm run test:integration
      - name: Build
        run: npm run build
      - name: Security scan
        run: npm audit

  deploy-staging:
    needs: test
    if: github.ref == 'refs/heads/main'
    runs-on: ubuntu-latest
    steps:
      - name: Deploy to staging
        run: ./deploy.sh staging
      - name: Smoke tests
        run: npm run test:smoke
      - name: E2E tests
        run: npm run test:e2e

  deploy-production:
    needs: deploy-staging
    if: github.ref == 'refs/heads/main'
    runs-on: ubuntu-latest
    environment: production
    steps:
      - name: Deploy
        run: ./deploy.sh production
      - name: Health check
        run: ./health-check.sh
      - name: Verify metrics
        run: ./verify-deployment.sh
```

### Deployment Strategies

**Blue-Green Deployment:**
```bash
# Zero-downtime deployment
./deploy.sh blue-green

# Steps:
# 1. Deploy new version to "green" environment
# 2. Run health checks on green
# 3. Switch traffic from blue to green
# 4. Keep blue running for quick rollback
# 5. After validation, decommission blue
```

**Canary Deployment:**
```yaml
# Gradual rollout
apiVersion: v1
kind: Service
metadata:
  name: app-canary
spec:
  selector:
    app: myapp
    version: v2
  # Route 10% of traffic to v2
  sessionAffinity: ClientIP
```

**Feature Flags:**
```typescript
export const processPayment = async (order: Order) => {
  if (featureFlags.isEnabled('new-payment-gateway', order.userId)) {
    return newPaymentGateway.charge(order);
  }
  return legacyPaymentGateway.charge(order);
};
```

## Infrastructure as Code

### Terraform Example

```hcl
# main.tf
terraform {
  backend "s3" {
    bucket = "myapp-terraform-state"
    key    = "production/terraform.tfstate"
    region = "us-east-1"
  }
}

resource "aws_instance" "app_server" {
  ami           = var.app_ami
  instance_type = var.instance_type

  tags = {
    Name        = "app-server-${var.environment}"
    Environment = var.environment
    ManagedBy   = "terraform"
  }
}

resource "aws_security_group" "app_sg" {
  name = "app-sg-${var.environment}"

  ingress {
    from_port   = 443
    to_port     = 443
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
  }

  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }
}
```

### Docker Compose for Local Development

```yaml
# docker-compose.yml
version: '3.8'

services:
  app:
    build: .
    ports:
      - "3000:3000"
    environment:
      DB_HOST: postgres
      REDIS_URL: redis://redis:6379
      NODE_ENV: development
    volumes:
      - .:/app
      - /app/node_modules
    depends_on:
      postgres:
        condition: service_healthy
      redis:
        condition: service_started

  postgres:
    image: postgres:14
    environment:
      POSTGRES_DB: ${DB_NAME}
      POSTGRES_USER: ${DB_USER}
      POSTGRES_PASSWORD: ${DB_PASSWORD}
    volumes:
      - postgres-data:/var/lib/postgresql/data
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U ${DB_USER}"]
      interval: 5s
      timeout: 5s
      retries: 5

  redis:
    image: redis:7-alpine
    volumes:
      - redis-data:/data

volumes:
  postgres-data:
  redis-data:
```

## Monitoring & Observability

### Structured Logging

```typescript
import { createLogger } from './logger';

const logger = createLogger({
  service: 'order-service',
  environment: process.env.NODE_ENV
});

export const processOrder = async (orderId: string, userId: string) => {
  const timer = logger.startTimer();

  logger.info('Processing order', {
    orderId,
    userId,
    timestamp: new Date().toISOString()
  });

  try {
    const order = await orderRepo.findById(orderId);

    logger.debug('Order retrieved', {
      orderId,
      status: order.status,
      total: order.total
    });

    await paymentService.charge(order);

    logger.info('Order processed', {
      orderId,
      userId,
      duration: timer.elapsed()
    });

    return order;
  } catch (error) {
    logger.error('Order processing failed', {
      orderId,
      userId,
      error: error.message,
      stack: error.stack,
      context: { order }
    });
    throw error;
  }
};
```

### Application Metrics

```typescript
import { metrics } from './metrics';

export const handler = async (req, res) => {
  const startTime = Date.now();
  const route = req.route.path;

  try {
    const result = await processRequest(req);

    metrics.increment('requests.success', { route });
    metrics.recordHistogram('request.duration', Date.now() - startTime, { route });
    metrics.gauge('active_connections', getActiveConnections());

    return res.json(result);
  } catch (error) {
    metrics.increment('requests.error', { route, error: error.name });
    metrics.recordHistogram('request.duration', Date.now() - startTime, {
      route,
      status: 'error'
    });
    throw error;
  }
};
```

### Distributed Tracing

```typescript
import { trace, context } from '@opentelemetry/api';

const tracer = trace.getTracer('order-service');

export const createOrder = async (orderData) => {
  return tracer.startActiveSpan('createOrder', async (span) => {
    try {
      span.setAttribute('user.id', orderData.userId);
      span.setAttribute('order.total', orderData.total);

      const order = await tracer.startActiveSpan('db.insert', async (dbSpan) => {
        const result = await db.insert('orders', orderData);
        dbSpan.setAttribute('db.operation', 'insert');
        dbSpan.setAttribute('db.table', 'orders');
        dbSpan.end();
        return result;
      });

      await tracer.startActiveSpan('payment.charge', async (paymentSpan) => {
        await paymentService.charge(order.total);
        paymentSpan.setAttribute('payment.amount', order.total);
        paymentSpan.end();
      });

      span.setStatus({ code: SpanStatusCode.OK });
      return order;
    } catch (error) {
      span.recordException(error);
      span.setStatus({ code: SpanStatusCode.ERROR, message: error.message });
      throw error;
    } finally {
      span.end();
    }
  });
};
```

### Health Check Endpoints

```typescript
export const healthCheck = async (req, res) => {
  const health = {
    status: 'healthy',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    checks: {
      database: await checkDatabase(),
      redis: await checkRedis(),
      externalApi: await checkExternalApi()
    }
  };

  const isHealthy = Object.values(health.checks).every(check => check.status === 'ok');

  res.status(isHealthy ? 200 : 503).json(health);
};

const checkDatabase = async () => {
  try {
    await db.query('SELECT 1');
    return { status: 'ok', latency: 5 };
  } catch (error) {
    return { status: 'error', error: error.message };
  }
};
```

### Alerting Rules

```yaml
# Prometheus alert rules
groups:
  - name: application_alerts
    rules:
      - alert: HighErrorRate
        expr: rate(http_requests_total{status=~"5.."}[5m]) > 0.05
        for: 5m
        labels:
          severity: critical
        annotations:
          summary: "High error rate ({{ $value | humanizePercentage }})"
          description: "{{ $labels.service }} error rate above 5% for 5 minutes"

      - alert: SlowResponseTime
        expr: histogram_quantile(0.95, http_request_duration_seconds) > 2
        for: 10m
        labels:
          severity: warning
        annotations:
          summary: "Slow response time"
          description: "95th percentile response time: {{ $value }}s"

      - alert: HighMemoryUsage
        expr: (container_memory_usage_bytes / container_spec_memory_limit_bytes) > 0.9
        for: 5m
        labels:
          severity: warning
        annotations:
          summary: "High memory usage ({{ $value | humanizePercentage }})"

      - alert: ServiceDown
        expr: up{job="app"} == 0
        for: 1m
        labels:
          severity: critical
        annotations:
          summary: "Service is down"
          description: "{{ $labels.instance }} has been down for 1 minute"
```

## Automation Best Practices

### Single-Command Build

```bash
#!/bin/bash
# build.sh - One command to build everything

set -e

echo "Installing dependencies..."
npm ci

echo "Linting code..."
npm run lint

echo "Type checking..."
npm run typecheck

echo "Running tests..."
npm test

echo "Building application..."
npm run build

echo "Creating Docker image..."
docker build -t myapp:${VERSION} .

echo "Pushing to registry..."
docker push myapp:${VERSION}

echo "Build complete: myapp:${VERSION}"
```

### Automated Rollback

```bash
#!/bin/bash
# rollback.sh

CURRENT_VERSION=$(cat /var/app/version.txt)
PREVIOUS_VERSION=$(cat /var/app/previous-version.txt)

echo "Rolling back from $CURRENT_VERSION to $PREVIOUS_VERSION"

# Stop current version
docker-compose down

# Start previous version
docker-compose -f docker-compose.$PREVIOUS_VERSION.yml up -d

# Health check
if ./health-check.sh; then
  echo "Rollback successful"
  exit 0
else
  echo "Rollback failed"
  exit 1
fi
```

### Database Migrations in CI/CD

```typescript
// migrations/run-migrations.ts
import { migrate } from './migrator';

export const runMigrations = async () => {
  try {
    console.log('Running database migrations...');

    const results = await migrate({
      direction: 'up',
      dryRun: process.env.DRY_RUN === 'true'
    });

    console.log(`Applied ${results.length} migrations`);

    if (process.env.DRY_RUN === 'true') {
      console.log('DRY RUN - No changes made');
    }

    process.exit(0);
  } catch (error) {
    console.error('Migration failed:', error);
    process.exit(1);
  }
};
```

## Incident Response

### Runbook Template

```markdown
# Runbook: API High Error Rate

## Symptoms
- Error rate > 5% for 5+ minutes
- Alert: `HighErrorRate` firing
- User reports of 500 errors

## Investigation Steps

1. **Check application logs**
   ```bash
   kubectl logs -l app=api --tail=100 | grep ERROR
   ```

2. **Check recent deployments**
   ```bash
   kubectl rollout history deployment/api
   ```

3. **Check dependencies**
   - Database: `./check-db.sh`
   - Redis: `redis-cli ping`
   - External APIs: `curl -I https://external-api.com/health`

4. **Check metrics**
   - Dashboard: https://grafana.com/d/api-overview
   - Look for: CPU spikes, memory leaks, connection pool exhaustion

## Resolution Steps

### If recent deployment caused issue:
```bash
kubectl rollout undo deployment/api
```

### If database is slow:
```bash
# Check slow queries
psql -c "SELECT * FROM pg_stat_statements ORDER BY mean_time DESC LIMIT 10"
```

### If external API is down:
```bash
# Enable circuit breaker
curl -X POST http://api/config/circuit-breaker/enable
```

## Escalation
- On-call engineer: #oncall-team
- Database team: #database-team
- External vendor support: vendor-support@example.com
```

### Blameless Postmortem Template

```markdown
# Incident Report: [Title]

**Date:** YYYY-MM-DD
**Duration:** XX minutes
**Severity:** Critical/Major/Minor
**Affected Users:** X,XXX users

## Summary
Brief description of what happened and user impact.

## Timeline
- **HH:MM** - Deployment of vX.X.X
- **HH:MM** - First error spike detected
- **HH:MM** - Alert triggered
- **HH:MM** - Engineer began investigation
- **HH:MM** - Root cause identified
- **HH:MM** - Fix deployed
- **HH:MM** - Service fully restored

## Root Cause
Technical explanation of what caused the incident.

## What Went Well
✅ Monitoring detected issue quickly
✅ Rollback procedure worked
✅ Clear communication in incident channel

## What Didn't Go Well
❌ Issue not caught in staging
❌ Alert delay of X minutes
❌ Unclear runbook steps

## Action Items
1. [ ] Add test coverage for scenario (Owner: @dev, Due: Date)
2. [ ] Improve alert threshold (Owner: @ops, Due: Date)
3. [ ] Update runbook with new steps (Owner: @sre, Due: Date)
4. [ ] Add monitoring for X metric (Owner: @dev, Due: Date)

## Lessons Learned
- Key takeaway 1
- Key takeaway 2
```

## DORA Metrics Reference

**Four Key Metrics for DevOps Performance:**

### 1. Deployment Frequency
How often you deploy to production.

```
Elite Performers:   Multiple times per day
High Performers:    Daily to weekly
Medium Performers:  Weekly to monthly
Low Performers:     Monthly to every 6 months
```

**Improve:** Smaller batches, automated pipelines, feature flags, trunk-based development

### 2. Lead Time for Changes
Time from commit to production.

```
Elite Performers:   < 1 hour
High Performers:    1 day to 1 week
Medium Performers:  1 week to 1 month
Low Performers:     1 month to 6 months
```

**Improve:** Remove manual gates, faster CI/CD, reduce batch size, automate tests

### 3. Mean Time to Recovery (MTTR)
Time to restore service after incident.

```
Elite Performers:   < 1 hour
High Performers:    < 1 day
Medium Performers:  1 day to 1 week
Low Performers:     1 week to 1 month
```

**Improve:** Better monitoring, automated rollback, feature flags, runbooks, practice recovery

### 4. Change Failure Rate
Percentage of deployments causing production issues.

```
Elite Performers:   0-15%
High Performers:    16-30%
Medium Performers:  31-45%
Low Performers:     46-60%
```

**Improve:** Better testing, staging matches production, gradual rollouts, post-deployment verification

## Anti-Patterns

### ❌ Separate "DevOps Team"

```
Development Team → DevOps Team → Operations
                  (new silo)
```

**Problem:** Recreates dev/ops divide, becomes bottleneck, handover mentality persists.

**✅ Instead:** Embed DevOps practices in all teams, create platform team that enables (not gatekeeps).

### ❌ Tools Without Culture

```
Executive: "We bought Jenkins and Kubernetes!"

Reality:
- Teams still siloed
- Deployments still manual
- No collaboration
- Tools unused
```

**✅ Instead:** Foster collaboration first, then adopt tools that support the culture.

### ❌ Manual Approval Gates

```
Developer → CI/CD → CAB Meeting → Production
                    (1 week wait)
```

**Problem:** Defeats automation, creates large batches, slow feedback.

**✅ Instead:** Automated governance through tests, security scans, audit trails.

### ❌ Inconsistent Environments

```
Development: macOS, SQLite, mock APIs
Production:  Linux, PostgreSQL, real APIs
```

**Problem:** "Works on my machine," late discovery of environment issues.

**✅ Instead:** Use containers (Docker) to match environments, IaC for consistency.

### ❌ Missing Observability

```typescript
// Can't debug production issues
export const handler = async (req, res) => {
  const result = await processRequest(req);
  return res.json(result);
};
```

**✅ Instead:**
```typescript
export const handler = async (req, res) => {
  const timer = startTimer();
  logger.info('Request started', { path: req.path, userId: req.userId });

  try {
    const result = await processRequest(req);

    metrics.recordLatency('request.duration', timer.elapsed());
    logger.info('Request completed', { path: req.path, status: 200 });

    return res.json(result);
  } catch (error) {
    logger.error('Request failed', {
      path: req.path,
      error: error.message,
      stack: error.stack
    });
    throw error;
  }
};
```

### ❌ No Rollback Strategy

```bash
# Deploy script with no way back
./deploy.sh production
# Hope it works!
```

**✅ Instead:**
```bash
# Always keep previous version
./deploy.sh production --keep-previous
# Quick rollback available
./rollback.sh
```

## Practical Tips

### Make Deployments Boring
- Deploy frequently (reduces risk per deployment)
- Automate completely (no manual steps)
- Same process for all environments
- Practice rollbacks regularly

### Shift Left on Security
```yaml
# Security in CI pipeline
- name: Security scan
  run: |
    npm audit
    docker scan myapp:latest
    sonarqube-scan
    dependency-check
```

### Version Everything
- Code: Git
- Infrastructure: Terraform/IaC
- Configuration: Version controlled
- Database: Migration scripts
- Dependencies: Lock files (package-lock.json, yarn.lock)

### Automate Toil
If you do it manually twice, automate it the third time.

```bash
# Manual: SSH into server, restart service
ssh prod-server "sudo systemctl restart myapp"

# Automated: Self-healing service
kubectl set image deployment/myapp myapp=myapp:v2
# Kubernetes handles health checks and restarts
```

### Document as Code
```typescript
// Bad: Wiki page that gets outdated
// Good: Code documentation that stays current

/**
 * Processes order payment
 *
 * @throws {PaymentError} When payment gateway is unavailable
 * @throws {InsufficientFundsError} When user has insufficient funds
 *
 * Metrics: payment.success, payment.failure
 * Logs: payment.processed, payment.failed
 */
export const processPayment = async (order: Order) => {
  // Implementation
};
```

### Progressive Rollout Pattern

```typescript
// Gradual rollout with monitoring
export const deploymentStrategy = {
  canary: {
    steps: [
      { traffic: 5, duration: '5m' },   // 5% traffic for 5 min
      { traffic: 25, duration: '10m' },  // 25% traffic for 10 min
      { traffic: 50, duration: '15m' },  // 50% traffic for 15 min
      { traffic: 100 }                   // Full rollout
    ],
    autoRollback: {
      errorRate: 0.05,     // Rollback if error rate > 5%
      latencyP95: 2000     // Rollback if p95 latency > 2s
    }
  }
};
```

### Chaos Engineering Basics

```typescript
// Inject failures to test resilience
export const chaosTests = {
  // Kill random instance
  killPod: async () => {
    const pod = await selectRandomPod();
    await kubectl.delete(pod);
    await verifyServiceHealthy();
  },

  // Introduce network latency
  networkDelay: async () => {
    await injectLatency({ delay: '500ms', jitter: '100ms' });
    await verifyResponseTime({ max: 3000 });
  },

  // Simulate dependency failure
  dependencyFailure: async () => {
    await mockService.returnError(500);
    await verifyCircuitBreaker();
  }
};
```

## References

- [DORA Metrics](https://cloud.google.com/blog/products/devops-sre/using-the-four-keys-to-measure-your-devops-performance)
- [The Phoenix Project](https://itrevolution.com/the-phoenix-project/)
- [Site Reliability Engineering (SRE)](https://sre.google/books/)
- [Continuous Delivery](https://continuousdelivery.com/)
- [Infrastructure as Code](https://www.terraform.io/intro)
