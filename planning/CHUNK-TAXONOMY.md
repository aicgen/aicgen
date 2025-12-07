# Comprehensive Chunk Taxonomy

## Chunk Naming Convention

`{category}-{subcategory}-{topic}-{level?}`

Examples:
- `lang-ts-basics-types`
- `arch-microservices-communication`
- `security-auth-jwt`
- `testing-unit-mocking`

## Total Estimated Chunks: ~150-200

---

## 1. LANGUAGE CHUNKS (~80 chunks)

### TypeScript (10 chunks)
- `lang-ts-basics-types` - Type system fundamentals
- `lang-ts-basics-interfaces` - Interfaces and type aliases
- `lang-ts-advanced-generics` - Generic programming
- `lang-ts-advanced-utility` - Utility types and mapped types
- `lang-ts-async-promises` - Async/await and promises
- `lang-ts-error-handling` - Error handling patterns
- `lang-ts-tooling-tsconfig` - TypeScript configuration
- `lang-ts-testing-jest` - Testing with Jest/Vitest
- `lang-ts-performance` - Performance optimization
- `lang-ts-patterns-decorators` - Decorators and metadata

### JavaScript (10 chunks)
- `lang-js-basics-syntax` - Modern JS syntax (ES6+)
- `lang-js-basics-functions` - Functions and closures
- `lang-js-async-callbacks` - Callbacks and event loop
- `lang-js-async-promises` - Promises and async/await
- `lang-js-objects-prototypes` - Objects and prototypes
- `lang-js-modules-esm` - ESM and CommonJS
- `lang-js-error-handling` - Error handling
- `lang-js-tooling-babel` - Babel and transpilation
- `lang-js-testing-jest` - Testing patterns
- `lang-js-performance` - Performance tips

### Python (10 chunks)
- `lang-py-basics-syntax` - Python fundamentals
- `lang-py-basics-types` - Type hints and typing
- `lang-py-oop-classes` - OOP and classes
- `lang-py-async-asyncio` - Async/await with asyncio
- `lang-py-error-handling` - Exception handling
- `lang-py-testing-pytest` - Testing with pytest
- `lang-py-tooling-venv` - Virtual environments
- `lang-py-tooling-pip` - Package management
- `lang-py-performance` - Performance optimization
- `lang-py-patterns-context` - Context managers and decorators

### Go (10 chunks)
- `lang-go-basics-syntax` - Go fundamentals
- `lang-go-basics-types` - Types and interfaces
- `lang-go-concurrency-goroutines` - Goroutines
- `lang-go-concurrency-channels` - Channels
- `lang-go-error-handling` - Error handling patterns
- `lang-go-testing-stdlib` - Testing with stdlib
- `lang-go-tooling-modules` - Go modules
- `lang-go-performance` - Performance patterns
- `lang-go-patterns-composition` - Composition over inheritance
- `lang-go-http-handlers` - HTTP handlers

### Rust (10 chunks)
- `lang-rust-basics-ownership` - Ownership and borrowing
- `lang-rust-basics-types` - Type system
- `lang-rust-advanced-lifetimes` - Lifetimes
- `lang-rust-advanced-traits` - Traits and generics
- `lang-rust-async-tokio` - Async with Tokio
- `lang-rust-error-handling` - Result and Option
- `lang-rust-testing-cargo` - Testing with Cargo
- `lang-rust-tooling-cargo` - Cargo and crates
- `lang-rust-performance` - Zero-cost abstractions
- `lang-rust-patterns-enums` - Enum patterns

### Java (10 chunks)
- `lang-java-basics-oop` - OOP fundamentals
- `lang-java-basics-types` - Type system
- `lang-java-advanced-generics` - Generics
- `lang-java-async-threads` - Threading and concurrency
- `lang-java-async-completable` - CompletableFuture
- `lang-java-error-handling` - Exception handling
- `lang-java-testing-junit` - JUnit testing
- `lang-java-tooling-maven` - Maven/Gradle
- `lang-java-performance-jvm` - JVM optimization
- `lang-java-patterns-streams` - Streams API

### C# (10 chunks)
- `lang-csharp-basics-syntax` - C# fundamentals
- `lang-csharp-basics-types` - Type system
- `lang-csharp-advanced-linq` - LINQ
- `lang-csharp-async-tasks` - async/await and Tasks
- `lang-csharp-error-handling` - Exception handling
- `lang-csharp-testing-nunit` - Testing with NUnit/xUnit
- `lang-csharp-tooling-nuget` - NuGet packages
- `lang-csharp-performance` - Performance optimization
- `lang-csharp-patterns-delegates` - Delegates and events
- `lang-csharp-dotnet-core` - .NET Core patterns

### Ruby (10 chunks)
- `lang-ruby-basics-syntax` - Ruby fundamentals
- `lang-ruby-basics-oop` - OOP in Ruby
- `lang-ruby-metaprogramming` - Metaprogramming
- `lang-ruby-blocks-procs` - Blocks, Procs, Lambdas
- `lang-ruby-error-handling` - Exception handling
- `lang-ruby-testing-rspec` - RSpec testing
- `lang-ruby-tooling-bundler` - Bundler and gems
- `lang-ruby-performance` - Performance tips
- `lang-ruby-patterns-modules` - Modules and mixins
- `lang-ruby-rails-conventions` - Rails conventions

---

## 2. ARCHITECTURE CHUNKS (~30 chunks)

### Microservices (5 chunks)
- `arch-microservices-boundaries` - Service boundaries
- `arch-microservices-communication` - Inter-service communication
- `arch-microservices-data` - Data management and consistency
- `arch-microservices-deployment` - Deployment strategies
- `arch-microservices-patterns` - Patterns (saga, CQRS, etc.)

### Modular Monolith (5 chunks)
- `arch-modular-structure` - Module organization
- `arch-modular-boundaries` - Module boundaries
- `arch-modular-communication` - Inter-module communication
- `arch-modular-data` - Data ownership
- `arch-modular-migration` - Migration to microservices

### Layered Architecture (5 chunks)
- `arch-layered-structure` - Layer organization
- `arch-layered-presentation` - Presentation layer
- `arch-layered-business` - Business logic layer
- `arch-layered-data` - Data access layer
- `arch-layered-dependencies` - Dependency management

### Hexagonal Architecture (5 chunks)
- `arch-hexagonal-ports` - Ports and adapters
- `arch-hexagonal-domain` - Domain model
- `arch-hexagonal-adapters` - Adapter patterns
- `arch-hexagonal-testing` - Testing strategies
- `arch-hexagonal-structure` - Project structure

### Event-Driven Architecture (5 chunks)
- `arch-event-driven-events` - Event design
- `arch-event-driven-messaging` - Message brokers
- `arch-event-driven-consistency` - Eventual consistency
- `arch-event-driven-patterns` - Event sourcing, CQRS
- `arch-event-driven-testing` - Testing event systems

### Refactoring (5 chunks)
- `arch-refactor-strategy` - Refactoring strategy
- `arch-refactor-techniques` - Refactoring techniques
- `arch-refactor-testing` - Test-driven refactoring
- `arch-refactor-patterns` - Common patterns
- `arch-refactor-legacy` - Legacy code handling

---

## 3. TESTING CHUNKS (~20 chunks)

### Unit Testing (5 chunks)
- `testing-unit-fundamentals` - Unit testing basics
- `testing-unit-mocking` - Mocking and stubbing
- `testing-unit-coverage` - Code coverage
- `testing-unit-tdd` - Test-driven development
- `testing-unit-patterns` - Testing patterns

### Integration Testing (3 chunks)
- `testing-integration-strategy` - Integration test strategy
- `testing-integration-database` - Database testing
- `testing-integration-api` - API integration tests

### E2E Testing (3 chunks)
- `testing-e2e-strategy` - E2E test strategy
- `testing-e2e-tools` - E2E testing tools
- `testing-e2e-ci` - E2E in CI/CD

### Testing Strategy (9 chunks)
- `testing-strategy-pyramid` - Test pyramid
- `testing-strategy-coverage` - Coverage strategy
- `testing-strategy-performance` - Performance testing
- `testing-strategy-security` - Security testing
- `testing-strategy-contracts` - Contract testing
- `testing-strategy-visual` - Visual regression testing
- `testing-strategy-mutation` - Mutation testing
- `testing-strategy-property` - Property-based testing
- `testing-strategy-snapshot` - Snapshot testing

---

## 4. SECURITY CHUNKS (~15 chunks)

- `security-owasp-injection` - Injection prevention
- `security-owasp-auth` - Broken authentication
- `security-owasp-exposure` - Sensitive data exposure
- `security-owasp-xxe` - XML external entities
- `security-owasp-access` - Broken access control
- `security-owasp-config` - Security misconfiguration
- `security-owasp-xss` - Cross-site scripting
- `security-owasp-deserialization` - Insecure deserialization
- `security-owasp-components` - Vulnerable components
- `security-owasp-logging` - Insufficient logging
- `security-auth-jwt` - JWT authentication
- `security-auth-oauth` - OAuth 2.0
- `security-crypto-basics` - Cryptography basics
- `security-secrets-management` - Secrets management
- `security-headers` - Security headers

---

## 5. API DESIGN CHUNKS (~12 chunks)

### REST API (6 chunks)
- `api-rest-design` - REST design principles
- `api-rest-resources` - Resource modeling
- `api-rest-methods` - HTTP methods
- `api-rest-status` - Status codes
- `api-rest-versioning` - API versioning
- `api-rest-documentation` - API documentation

### GraphQL (3 chunks)
- `api-graphql-schema` - Schema design
- `api-graphql-resolvers` - Resolver patterns
- `api-graphql-performance` - N+1 problem and caching

### General API (3 chunks)
- `api-pagination` - Pagination strategies
- `api-filtering` - Filtering and sorting
- `api-rate-limiting` - Rate limiting

---

## 6. DATABASE CHUNKS (~12 chunks)

- `db-schema-design` - Schema design principles
- `db-normalization` - Normalization (3NF)
- `db-indexing-strategy` - Index strategy
- `db-indexing-performance` - Index optimization
- `db-migrations` - Database migrations
- `db-transactions` - Transaction management
- `db-performance-queries` - Query optimization
- `db-performance-caching` - Database caching
- `db-scaling-read` - Read replicas
- `db-scaling-sharding` - Sharding strategies
- `db-orm-patterns` - ORM patterns
- `db-nosql-design` - NoSQL data modeling

---

## 7. CI/CD CHUNKS (~10 chunks)

- `cicd-pipeline-structure` - Pipeline structure
- `cicd-build-strategy` - Build strategies
- `cicd-testing-automation` - Test automation
- `cicd-deployment-strategies` - Deployment strategies
- `cicd-deployment-canary` - Canary deployments
- `cicd-deployment-blue-green` - Blue-green deployments
- `cicd-monitoring` - Monitoring and observability
- `cicd-rollback` - Rollback strategies
- `cicd-secrets` - Secrets management
- `cicd-infrastructure` - Infrastructure as code

---

## 8. ERROR HANDLING CHUNKS (~8 chunks)

- `error-handling-strategy` - Error handling strategy
- `error-handling-types` - Error types and hierarchy
- `error-handling-logging` - Error logging
- `error-handling-monitoring` - Error monitoring
- `error-handling-retry` - Retry patterns
- `error-handling-circuit` - Circuit breakers
- `error-handling-user` - User-facing errors
- `error-handling-recovery` - Recovery strategies

---

## 9. PERFORMANCE CHUNKS (~10 chunks)

- `performance-profiling` - Performance profiling
- `performance-caching-strategy` - Caching strategy
- `performance-caching-cdn` - CDN usage
- `performance-async-patterns` - Async patterns
- `performance-database` - Database optimization
- `performance-network` - Network optimization
- `performance-memory` - Memory management
- `performance-bundling` - Code bundling
- `performance-lazy-loading` - Lazy loading
- `performance-monitoring` - Performance monitoring

---

## 10. CODE STYLE CHUNKS (~10 chunks)

- `style-naming-conventions` - Naming conventions
- `style-file-organization` - File organization
- `style-function-design` - Function design
- `style-class-design` - Class design
- `style-comments` - Comments and documentation
- `style-formatting` - Code formatting
- `style-complexity` - Complexity management
- `style-dry` - DRY principle
- `style-solid` - SOLID principles
- `style-readability` - Code readability

---

## 11. LOGGING CHUNKS (~6 chunks)

- `logging-structured` - Structured logging
- `logging-levels` - Log levels
- `logging-context` - Contextual logging
- `logging-sensitive` - Sensitive data handling
- `logging-aggregation` - Log aggregation
- `logging-monitoring` - Log monitoring

---

## 12. DEPLOYMENT CHUNKS (~8 chunks)

- `deployment-docker-basics` - Docker fundamentals
- `deployment-docker-optimization` - Docker optimization
- `deployment-kubernetes` - Kubernetes deployment
- `deployment-cloud-aws` - AWS deployment
- `deployment-cloud-gcp` - GCP deployment
- `deployment-cloud-azure` - Azure deployment
- `deployment-env-management` - Environment management
- `deployment-health-checks` - Health checks

---

## 13. STATE MANAGEMENT CHUNKS (~6 chunks)

- `state-client-patterns` - Client state patterns
- `state-server-sessions` - Server-side sessions
- `state-caching` - State caching
- `state-consistency` - State consistency
- `state-redux-patterns` - Redux patterns
- `state-react-hooks` - React state hooks

---

## Chunk Mapping Strategy

Each profile gets chunks based on:

1. **Core chunks (always included):**
   - Basic code style
   - Basic error handling
   - Basic security

2. **Language chunks:**
   - Language basics (always)
   - Language advanced (expert/full only)
   - Language-specific testing
   - Language async patterns

3. **Architecture chunks:**
   - All chunks for selected architecture

4. **Level-based chunks:**
   - **Basic:** Core + language basics
   - **Standard:** Basic + testing + cicd + database basics
   - **Expert:** Standard + advanced patterns + performance
   - **Full:** Everything applicable

5. **Assistant-specific adjustments:**
   - Some chunks may have assistant-specific formatting
   - Example: Claude Code might get more detailed explanations

Total chunks to create: **~150-200 focused chunks**
