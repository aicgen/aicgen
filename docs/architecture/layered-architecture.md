# Layered Architecture Guidelines

## Overview

Layered architecture separates applications into distinct layers with clear responsibilities and dependencies flowing in one direction. The most common pattern is the three-layer architecture: Presentation, Domain, and Data Access.

## Core Layers

### Presentation Layer (UI)
**Responsibilities:**
- Handle HTTP requests and responses
- Manage UI behavior and interactions
- Render HTML or JSON responses
- Abstract away data sources through function calls

**What Belongs Here:**
- View templates and components
- UI controllers and handlers
- Input validation and sanitization
- Session management
- User authentication checks

**What Doesn't Belong:**
- Business logic or calculations
- Direct database queries
- Data transformation rules

### Domain Layer (Business Logic)
**Responsibilities:**
- Contain validations and calculations
- Represent core application logic
- Be independent of UI or persistence
- Treat data sources as abstract interfaces

**What Belongs Here:**
- Business rules and workflows
- Domain models and entities
- Service interfaces
- Application use cases
- Business validation logic

**What Doesn't Belong:**
- UI rendering logic
- Database queries or SQL
- HTTP request handling
- Framework-specific code

### Data Access Layer
**Responsibilities:**
- Manage persistent data in databases or remote services
- Handle technical details of storage and retrieval
- Provide abstract functions to domain layer
- Implement repository patterns

**What Belongs Here:**
- Database queries and commands
- ORM configurations
- Data mapping logic
- Connection management
- Cache implementations

**What Doesn't Belong:**
- Business logic
- UI concerns
- Direct controller access

## Key Principles

### Reduce Cognitive Load
Allows thinking about three topics relatively independently, reducing scope of attention needed at any given time.

### Dependency Flow
Dependencies run top-to-bottom: Presentation → Domain → Data Source

**Hexagonal Architecture Variation:**
Introduce mappers between domain and data to eliminate domain dependencies on data sources entirely.

### Non-Sequential Development
Layers need not be built in order; iteration across layers is normal and expected.

### Substitutability
Separation enables multiple presentations (web, mobile, CLI, API) sharing identical domain logic without duplication.

### Testability
Layer boundaries create seams that afford testing, allowing domain logic testing without UI gymnastics.

## Best Practices

✅ **DO:**
- Keep layers loosely coupled through interfaces
- Make layer boundaries explicit in folder structure
- Test each layer independently
- Use dependency injection at layer boundaries
- Keep business logic in domain layer only
- Create clear abstractions between layers

❌ **DON'T:**
- Separate development teams by layers (create cross-functional teams instead)
- Skip layers (e.g., presentation directly accessing data layer)
- Put business logic in presentation or data layers
- Create circular dependencies between layers
- Over-apply at large scale (use domain-oriented modules at highest level)
- Confuse logical layers with physical deployment

## Common Mistakes

### Team Anti-Pattern
Separating development teams by layers creates friction and reduces cross-layer understanding. Teams should be cross-functional, even if individuals specialize.

### Over-Application
This pattern works at small granularity. Larger systems should use domain-oriented modules at the highest level, with internal layering within modules.

### Logical vs Physical Confusion
Layers are logical constructs, not physical. They can deploy together or separately depending on architecture needs.

## Layer Communication Patterns

### Top-Down Communication
- Higher layers call lower layers through well-defined interfaces
- Use dependency injection to avoid tight coupling
- Pass data through DTOs or domain models

### Bottom-Up Notifications
- Use observer pattern for lower layers to notify higher layers
- Implement event-driven architecture for loose coupling
- Consider message queues for asynchronous updates

## Testing Strategy

### Unit Testing
- Test each layer in isolation
- Mock dependencies from other layers
- Focus on layer-specific responsibilities

### Integration Testing
- Test interactions between adjacent layers
- Verify data flows correctly across boundaries
- Ensure abstractions work as intended

### End-to-End Testing
- Test full request/response cycle through all layers
- Verify system behavior as a whole
- Catch integration issues

## Folder Structure Example

```
src/
├── presentation/       # Controllers, views, API endpoints
│   ├── controllers/
│   ├── views/
│   └── middleware/
├── domain/            # Business logic, models, services
│   ├── models/
│   ├── services/
│   └── interfaces/
└── data/              # Repositories, database access
    ├── repositories/
    ├── migrations/
    └── seeds/
```

## When to Use Layered Architecture

✅ **Good For:**
- Applications with clear separation of concerns
- Projects where multiple UIs share business logic
- Systems requiring high testability
- Teams new to architecture patterns
- Monolithic applications

❌ **Not Ideal For:**
- Simple CRUD applications (may be overkill)
- Microservices (use within each service, not across)
- Event-driven systems (consider different patterns)
- Systems with complex domain logic (consider DDD)

## Variants

### Three-Tier Architecture
Physical separation: Client tier, Application tier, Database tier

### N-Tier Architecture
Additional layers for specific concerns (e.g., caching, messaging)

### Hexagonal Architecture (Ports and Adapters)
Domain at center, infrastructure at edges, connected through ports

### Clean Architecture
Similar to hexagonal with explicit dependency inversion rules
