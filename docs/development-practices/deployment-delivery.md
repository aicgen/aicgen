# Deployment & Delivery Best Practices

## Environment Management

### Environment Hierarchy

```
Development → Staging → Production

Development (Dev):
- Developers' local machines or shared dev server
- Frequent changes, unstable
- Mock external services when possible
- Fast feedback loop

Staging (Pre-Production):
- Production-like environment
- Test deployments before production
- Integration with real external services (sandbox/test modes)
- Performance and load testing

Production (Prod):
- Live system serving real users
- Stable, monitored, backed up
- Minimal manual changes
- Automated deployments only
```

### Environment Parity

```
✅ Keep environments as similar as possible

Development should mirror Production:
- Same OS and runtime versions
- Same database engine and version
- Same configuration structure (different values)
- Same infrastructure patterns

❌ Environment drift causes bugs
Dev: SQLite
Staging: MySQL
Production: PostgreSQL
→ Different behaviors, hard to debug

✅ Use containers for consistency
Docker ensures same runtime everywhere:
- Same base image across environments
- Same dependencies and versions
- Same file system structure
```

### Environment-Specific Configuration

```
❌ Hardcoded environment values
if (hostname == 'prod-server-1') {
    apiUrl = 'https://api.production.com'
} else if (hostname == 'staging-server') {
    apiUrl = 'https://api.staging.com'
}

✅ Environment variables
API_URL = process.env.API_URL
DATABASE_URL = process.env.DATABASE_URL
LOG_LEVEL = process.env.LOG_LEVEL || 'info'

✅ Configuration files per environment
config/
├── base.yml           # Common settings
├── development.yml    # Dev overrides
├── staging.yml        # Staging overrides
└── production.yml     # Prod overrides

Load based on ENVIRONMENT variable:
config = loadConfig(`config/${ENVIRONMENT}.yml`)
```

### Secrets Management

```
❌ Never commit secrets to version control
DATABASE_PASSWORD=super_secret_123
API_KEY=sk-1234567890abcdef

✅ Use environment variables or secret management
# .env.example (committed)
DATABASE_PASSWORD=
API_KEY=

# .env (not committed, in .gitignore)
DATABASE_PASSWORD=actual_password
API_KEY=actual_key

✅ Use secret management services
- HashiCorp Vault
- AWS Secrets Manager
- Azure Key Vault
- Google Secret Manager

Secrets injected at runtime, never stored in code:
password = secretsManager.getSecret('database-password')
```

## Continuous Integration (CI)

### Core Principles

```
1. Maintain a single source repository
   - All code in version control (Git)
   - Include build scripts, tests, configs

2. Automate the build
   - One command to build from source
   - No manual steps

3. Make builds self-testing
   - Automated tests run on every build
   - Build fails if tests fail

4. Everyone commits daily
   - Integrate at least once per day
   - Smaller changes = easier integration

5. Every commit builds on integration machine
   - CI server (Jenkins, GitHub Actions, GitLab CI)
   - Catches integration problems immediately

6. Keep builds fast
   - Under 10 minutes for commit build
   - Longer tests in separate pipeline stages

7. Test in production-like environment
   - CI environment mirrors production

8. Make it easy to get latest build
   - Latest successful build always available
   - Artifacts stored and versioned

9. Everyone sees build status
   - Visible dashboard
   - Notifications on failures
```

### CI Pipeline Example

```
.github/workflows/ci.yml (GitHub Actions)

on:
  push:
    branches: [main, develop]
  pull_request:
    branches: [main]

jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3

      - name: Setup environment
        run: |
          # Install dependencies
          # Setup runtime

      - name: Lint
        run: lint-command

      - name: Unit tests
        run: test-command

      - name: Build
        run: build-command

      - name: Integration tests
        run: integration-test-command

  security:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - name: Security scan
        run: security-scan-command

  # Only deploy if all checks pass
  deploy-staging:
    needs: [build, security]
    if: github.ref == 'refs/heads/develop'
    runs-on: ubuntu-latest
    steps:
      - name: Deploy to staging
        run: deploy-to-staging
```

## Continuous Delivery (CD)

### Definition

**Continuous Delivery**: Software is always in a deployable state. Any version can be deployed to production at any time with a single action.

**Key Test**: A business stakeholder can request production deployment immediately without team anxiety.

### Four Requirements

```
1. Software deployable throughout development
   - Never break the build for extended periods
   - Feature branches deployed to test environments

2. Prioritize deployability over new features
   - If choice between new feature and fixing build, fix build
   - Technical debt that blocks deployment is critical

3. Automated feedback on production readiness
   - Automated tests after every commit
   - Fast feedback (minutes, not hours)

4. Push-button deployment to any environment
   - One command deploys to dev/staging/prod
   - No manual steps (no "update this config file")
```

### Continuous Delivery vs Continuous Deployment

```
Continuous Delivery:
- CAN deploy any time
- Business chooses when to deploy
- Deployment is decision, not technical limitation

Continuous Deployment:
- EVERY change goes to production automatically
- No human decision point
- Higher risk, requires excellent monitoring

Most teams use Continuous Delivery:
- Deploy multiple times per day if needed
- Deploy weekly for stable products
- Choice based on business needs
```

## Deployment Pipeline

### Pipeline Stages

```
A deployment pipeline breaks builds into stages.
Each stage provides increasing confidence at the cost of extra time.

┌─────────────┐
│   Commit    │  Fast: Compile, unit tests, code quality
│   Stage     │  Goal: Catch common errors in <10 minutes
└──────┬──────┘
       │ Pass
       ↓
┌─────────────┐
│ Acceptance  │  Medium: Integration tests, API tests
│   Stage     │  Goal: Verify system behavior (10-30 min)
└──────┬──────┘
       │ Pass
       ↓
┌─────────────┐
│  Manual     │  Slow: Manual QA, exploratory testing
│   Test      │  Goal: Human verification
└──────┬──────┘
       │ Pass
       ↓
┌─────────────┐
│ Production  │  Deployment to live environment
│  Deploy     │  Automated or one-click
└─────────────┘
```

### Stage Design Principles

```
✅ Fast feedback first
- Run cheapest, fastest tests early
- Expensive tests later in pipeline

✅ Fail fast
- Stop pipeline on first failure
- Don't waste time on later stages

✅ Parallelize where possible
- Run independent tests concurrently
- Use multiple machines for test suites

✅ One artifact, many environments
- Build once in commit stage
- Same binary deployed through all stages
- Only configuration changes per environment

❌ Don't rebuild in later stages
Commit stage: Build artifact → artifact.v1.2.3
Later stages: Deploy artifact.v1.2.3 (same binary)
```

### Pipeline Example

```
# Jenkinsfile (Jenkins Pipeline)

pipeline {
  agent any

  stages {
    stage('Commit') {
      steps {
        sh 'build-command'
        sh 'unit-test-command'
        sh 'lint-command'
      }
    }

    stage('Acceptance') {
      steps {
        sh 'deploy-to-test-environment'
        sh 'run-integration-tests'
        sh 'run-api-tests'
      }
    }

    stage('Performance') {
      steps {
        sh 'deploy-to-perf-environment'
        sh 'run-load-tests'
      }
    }

    stage('Deploy Staging') {
      when {
        branch 'main'
      }
      steps {
        sh 'deploy-to-staging'
        sh 'smoke-tests'
      }
    }

    stage('Deploy Production') {
      when {
        branch 'main'
      }
      input {
        message "Deploy to production?"
        ok "Deploy"
      }
      steps {
        sh 'deploy-to-production'
        sh 'smoke-tests'
      }
    }
  }

  post {
    failure {
      // Notify team of pipeline failure
    }
  }
}
```

## Deployment Strategies

### Blue-Green Deployment

```
Pattern: Maintain two identical production environments.
Switch traffic between them for zero-downtime deployments.

┌─────────────┐
│    Blue     │  ← Currently serving traffic
│ Environment │
└─────────────┘
       ↑
   [Router]
       ↓ (switch)
┌─────────────┐
│    Green    │  ← New version deployed, tested
│ Environment │
└─────────────┘

Steps:
1. Blue serves production traffic
2. Deploy new version to Green
3. Test Green thoroughly (smoke tests, sanity checks)
4. Switch router to Green
5. Monitor for issues
6. If problems: Switch back to Blue (instant rollback)
7. If success: Blue becomes staging for next release

Benefits:
✅ Zero downtime deployment
✅ Instant rollback capability
✅ Test in production-like environment
✅ Disaster recovery testing on every deploy

Challenges:
⚠️  Requires double infrastructure
⚠️  Database migrations must support both versions
⚠️  Stateful sessions need special handling
```

### Database Migrations for Blue-Green

```
Problem: Blue and Green share database.
New version may need schema changes.

❌ Breaking migration
Deploy Green with new schema:
ALTER TABLE users DROP COLUMN legacy_field;
→ Blue breaks immediately

✅ Parallel Change pattern
Phase 1: Add new column (both versions work)
ALTER TABLE users ADD COLUMN new_field VARCHAR(255);

Deploy Green (reads new_field, writes both)
Deploy Blue (updated to write both fields)

Phase 2: Migrate data
UPDATE users SET new_field = legacy_field WHERE new_field IS NULL;

Phase 3: Remove old column (after Blue retired)
ALTER TABLE users DROP COLUMN legacy_field;
```

### Canary Release

```
Pattern: Gradually roll out changes to subset of users.
Monitor metrics before full rollout.

Production Traffic (100%)
       ↓
   [Router]
       ├──→ 95% → Old Version
       └──→ 5%  → New Version (Canary)

Steps:
1. Deploy new version to small subset (5% of servers)
2. Route 5% of traffic to canary
3. Monitor metrics: errors, latency, business KPIs
4. If metrics good: Increase to 25%
5. If metrics good: Increase to 50%
6. If metrics good: Increase to 100%
7. If metrics bad at any point: Rollback to 0%

Rollout Strategies:
- Random user sampling
- Internal employees first
- Geographic regions (US-East → US-West → EU)
- User segments (free users → paid users)

Benefits:
✅ Limit blast radius of bugs
✅ Real production testing with real users
✅ Gradual validation of capacity
✅ Easy rollback (just reroute traffic)

Monitoring:
Track during canary:
- Error rates (5xx, 4xx)
- Response times (p50, p95, p99)
- Business metrics (conversion, revenue)
- Infrastructure metrics (CPU, memory)

Automated Rollback:
if (canaryErrorRate > oldVersionErrorRate * 1.5) {
    rollback("Error rate increased significantly")
}
```

### Feature Toggles (Feature Flags)

```
Pattern: Deploy code with features disabled.
Enable features via configuration without redeployment.

Categories of Toggles:

1. Release Toggles (short-lived: days-weeks)
   Allow incomplete features to be merged to main branch

   if (featureFlags.isEnabled('new-checkout-flow')) {
       return newCheckoutFlow()
   } else {
       return oldCheckoutFlow()
   }

2. Experiment Toggles (short-lived: weeks-months)
   A/B testing and multivariate experiments

   variant = experimentService.getVariant(userId, 'pricing-test')
   if (variant == 'A') {
       price = 9.99
   } else if (variant == 'B') {
       price = 14.99
   }

3. Ops Toggles (temporary or permanent)
   Graceful degradation during outages

   if (featureFlags.isEnabled('recommendations') && recommendationService.isHealthy()) {
       recommendations = recommendationService.get(userId)
   } else {
       recommendations = []  // Degrade gracefully
   }

4. Permissioning Toggles (long-lived: months-years)
   Premium features, beta access, internal-only features

   if (user.isPremium || featureFlags.isEnabled('premium-feature', userId)) {
       showPremiumFeature()
   }
```

### Feature Toggle Best Practices

```
✅ Decouple decision from logic
❌ Scattered conditionals
if (isFeatureEnabled('feature-x')) { /* ... */ }
if (isFeatureEnabled('feature-x')) { /* ... */ }

✅ Centralize decisions
class FeatureDecisions {
    useNewCheckout() {
        return this.flags.isEnabled('new-checkout')
    }
}

✅ Dependency injection
class CheckoutController {
    constructor(features) {
        if (features.useNewCheckout()) {
            this.checkout = new NewCheckout()
        } else {
            this.checkout = new OldCheckout()
        }
    }
}

✅ Lifecycle management
Toggles are inventory with carrying cost.

When creating toggle:
- Add removal task to backlog immediately
- Set expiration date
- Document purpose and removal criteria

Proactive removal:
MAX_TOGGLES = 20
if (activeToggles.length > MAX_TOGGLES) {
    throw new Error("Too many toggles! Remove old ones.")
}

✅ Testing strategy
Test configurations:
1. All toggles off (fallback state)
2. Expected production state
3. All toggles on (optional, catch regressions)

❌ Don't test all combinations (2^n explosion)

✅ Runtime overrides for testing
Cookie-based override:
if (cookie.featureOverride == 'new-checkout') {
    enableFeature('new-checkout')
}

Allows testing without deployment
```

## Infrastructure as Code (IaC)

### Principles

```
Treat infrastructure like software:
- Version controlled
- Code reviewed
- Automated deployment
- Tested

Benefits:
✅ Reproducible environments
✅ Self-documenting infrastructure
✅ Disaster recovery (rebuild from code)
✅ Version history of infrastructure changes
```

### IaC Tools

```
Terraform (cloud-agnostic):
resource "aws_instance" "web" {
  ami           = "ami-0c55b159cbfafe1f0"
  instance_type = "t2.micro"

  tags = {
    Name = "WebServer"
    Environment = "production"
  }
}

Terraform commands:
terraform plan    # Preview changes
terraform apply   # Apply changes
terraform destroy # Tear down

CloudFormation (AWS):
Resources:
  WebServer:
    Type: AWS::EC2::Instance
    Properties:
      ImageId: ami-0c55b159cbfafe1f0
      InstanceType: t2.micro

Ansible (configuration management):
- name: Install web server
  hosts: webservers
  tasks:
    - name: Install nginx
      package:
        name: nginx
        state: present
    - name: Start nginx
      service:
        name: nginx
        state: started
```

### Immutable Infrastructure

```
Traditional (mutable servers):
1. Deploy server
2. SSH in, install updates
3. Patch security issues
4. Over time: configuration drift, "snowflake servers"

Modern (immutable servers):
1. Build new server image with changes
2. Deploy new servers from image
3. Route traffic to new servers
4. Terminate old servers
5. Never modify running servers

Benefits:
✅ No configuration drift
✅ Easy rollback (deploy old image)
✅ Consistent, reproducible
✅ Testable (test image before deploy)

Phoenix Servers:
Rebuild servers regularly (daily/weekly) rather than patch:
- Prevents configuration drift
- Tests disaster recovery
- Keeps rebuild process working
```

## Monitoring & Observability

### Pre-Production Monitoring

```
Smoke Tests after deployment:
Quick sanity checks that core functionality works

POST deployment:
  1. Health check endpoint returns 200
  2. Database connection succeeds
  3. External API dependencies reachable
  4. Critical user flow completes

If smoke test fails: Automatic rollback

Synthetic Monitoring:
Automated tests running against production continuously

Every 5 minutes:
  - Simulate user login
  - Simulate checkout flow
  - Simulate API calls

Detect issues before users report them
```

### Deployment Metrics

```
Track for every deployment:

Deployment Frequency:
- How often do we deploy?
- Goal: Multiple times per day (elite performers)

Lead Time:
- Time from commit to production
- Goal: Less than 1 hour (elite performers)

Change Failure Rate:
- What % of deployments cause incidents?
- Goal: Less than 15%

Mean Time to Recovery (MTTR):
- How quickly can we recover from failure?
- Goal: Less than 1 hour

These are DORA metrics (DevOps Research & Assessment)
```

## Rollback Strategies

```
Fast rollback is critical for low-risk deployments

Deployment Strategy → Rollback Method:

Blue-Green:
  Rollback: Switch router back to old environment
  Speed: Instant (seconds)

Canary:
  Rollback: Reroute traffic away from canary
  Speed: Instant (seconds)

Rolling Deployment:
  Rollback: Deploy previous version
  Speed: Same as deployment (minutes)

Database Migrations:
  Rollback: Run down migration
  Speed: Depends on data volume (minutes to hours)
  ⚠️  Data loss risk

Always test rollback procedure:
- Rollback in staging before production deployment
- Practice rollback during low-traffic periods
- Document rollback steps
- Automate rollback if possible

Rollback decision criteria:
Automatic rollback if:
- Smoke tests fail
- Error rate > threshold
- Response time > threshold

Manual rollback if:
- Critical business metric drops
- User complaints spike
- Unclear issue requiring investigation
```

## Common Anti-Patterns

```
❌ Manual deployments
"SSH into server and copy files"
→ Error-prone, not reproducible, no audit trail

✅ Automated, scripted deployments

❌ "Works on my machine"
Different environment between dev and prod
→ Use containers for consistency

❌ Long-lived feature branches
Branches diverge, painful merges, integration hell
→ Trunk-based development with feature toggles

❌ Testing in production only
First time code runs together is production
→ CI/CD with automated testing

❌ Big bang releases
Deploy months of changes at once
→ Small, frequent deployments

❌ No rollback plan
"We'll fix forward if something breaks"
→ Always have tested rollback procedure

❌ Shared mutable infrastructure
Multiple apps on same servers, manual configuration
→ Immutable infrastructure, one app per instance

❌ Permanent feature flags
100+ flags, some years old
→ Proactive toggle removal, max toggle limits
```

## Deployment Checklist

```
Before Deployment:
□ All tests passing in CI
□ Code reviewed and approved
□ Deployment plan documented
□ Rollback plan documented and tested
□ Database migrations reviewed (support old and new code)
□ Feature flags configured correctly
□ Monitoring and alerts configured
□ Stakeholders notified (if major change)
□ Deployment window scheduled (if needed)

During Deployment:
□ Deploy during low-traffic period (if possible)
□ Monitor error rates and metrics
□ Run smoke tests after deployment
□ Check logs for errors
□ Verify feature flags working as expected

After Deployment:
□ Monitor for 30 minutes minimum
□ Check business metrics
□ Verify with stakeholders
□ Update documentation
□ Schedule feature flag removal (if added)
□ Document any issues encountered
□ Retrospective on problems (if any)
```

## Summary

**Environment Management:**
- Maintain dev, staging, production environments
- Keep environment parity (same OS, runtime, database)
- Use environment variables for configuration
- Never commit secrets to version control

**Continuous Integration:**
- Everyone commits daily to main branch
- Automated builds and tests on every commit
- Keep builds fast (<10 minutes)
- Visible build status for whole team

**Continuous Delivery:**
- Software always deployable
- Automated deployment to any environment
- Push-button deployment, no manual steps
- Business chooses when to deploy

**Deployment Pipeline:**
- Fast feedback first (unit tests, linting)
- Increasing confidence in later stages
- Build once, deploy same artifact everywhere
- Fail fast, parallelize where possible

**Deployment Strategies:**
- Blue-Green: Zero-downtime with instant rollback
- Canary: Gradual rollout with risk mitigation
- Feature Toggles: Deploy code, enable features separately
- Infrastructure as Code: Treat infrastructure like software

**Key Principles:**
- Small, frequent deployments (less risk than big bang)
- Automated everything (build, test, deploy)
- Fast rollback capability (test rollback procedures)
- Monitor metrics during and after deployment
- Immutable infrastructure (rebuild, don't patch)

## References

- [Continuous Delivery by Jez Humble & David Farley](https://continuousdelivery.com/)
- [Martin Fowler - Continuous Integration](https://martinfowler.com/articles/continuousIntegration.html)
- [Martin Fowler - Deployment Pipeline](https://martinfowler.com/bliki/DeploymentPipeline.html)
- [Martin Fowler - Blue-Green Deployment](https://martinfowler.com/bliki/BlueGreenDeployment.html)
- [Martin Fowler - Canary Release](https://martinfowler.com/bliki/CanaryRelease.html)
- [Martin Fowler - Feature Toggles](https://martinfowler.com/articles/feature-toggles.html)
- [Google SRE Book - Release Engineering](https://sre.google/sre-book/release-engineering/)
- [DORA Metrics](https://www.devops-research.com/research.html)
