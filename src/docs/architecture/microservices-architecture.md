# Microservices Architecture Guidelines

## Overview

Microservices are a suite of small services, each running in its own process and communicating with lightweight mechanisms. Each service is independently deployable, replaceable, and upgradeable.

## Core Characteristics

### Componentization via Services
- Services are independently replaceable and upgradeable units
- Communicate through remote mechanisms (HTTP, RPC) rather than in-memory calls
- Enable independent deployment without full system rebuilds

### Organization Around Business Capabilities
- Structure teams and services around business functions, not technology layers
- Cross-functional teams own full-stack implementations
- Embodies Conway's Law: system design mirrors organizational communication

### Products, Not Projects
- Teams maintain services throughout their lifecycle
- "You build, you run it" philosophy
- Developers engage directly with production behavior and user feedback

### Smart Endpoints, Dumb Pipes
- Intelligence resides in service logic, not communication infrastructure
- Avoid complex Enterprise Service Buses with sophisticated routing
- Use simple protocols: HTTP REST APIs or lightweight messaging

### Decentralized Governance
- Teams select appropriate technology for their service's needs
- Standards emerge from successful implementations
- Share battle-tested internal tools without rigid enforcement

### Decentralized Data Management
- Each service manages its own database
- Different services may use different database technologies (polyglot persistence)
- Different bounded contexts have different data model views

### Infrastructure Automation
- CI/CD pipelines essential for reducing deployment risk
- Automated testing and deployment
- Make it easy to do the right thing

### Design for Failure
- Services may fail; systems must tolerate unavailability gracefully
- Implement circuit breaker patterns, timeouts, and bulkhead isolation
- Test resilience by deliberately inducing failures

### Evolutionary Design
- Service boundaries should be refactorable as understanding evolves
- Services often intentionally replaceable rather than perpetually evolved
- Keep frequently-changing code together

## Communication Patterns

### Synchronous vs Asynchronous
- Synchronous calls create multiplicative downtime across services
- Prefer asynchronous messaging to decouple service dependencies
- Limit single synchronous call per user request

### Service Integration
- Use Tolerant Reader pattern for independent service contract evolution
- Consumer-Driven Contracts define expectations before implementation
- Minimize versioning through flexible service design

## Data Management

### Transactionless Coordination
- Distributed transactions difficult; emphasize eventual consistency
- Use compensating operations to handle inconsistencies
- Speed often outweighs perfect consistency

## Size Guidelines

- "Two Pizza Team" model: services sized for teams of ~12 people
- Range from service-per-person to service-per-dozen-person
- Size depends on organizational context

## When NOT to Use Microservices

- Startups or teams without maturity in modular architecture
- Systems where component boundaries remain unclear
- Organizations lacking infrastructure automation capabilities
- Teams unable to manage distributed system complexity

## Best Practices

✅ **DO:**
- Begin with a monolith, keep it modular, split into microservices when needed
- Implement comprehensive monitoring of service health
- Use semantic monitoring for business metrics
- Design for independent deployment
- Employ circuit breakers and timeouts
- Practice chaos engineering

❌ **DON'T:**
- Create tight coupling between services
- Share databases between services
- Build microservices without proper team skills
- Neglect operational complexity
- Ignore the cost of distributed systems
- Prematurely decompose before understanding boundaries

## Common Pitfalls

### Complexity Migration
- Refactoring across service boundaries significantly harder than within monoliths
- Risk shifting component complexity to inter-service connections
- Messy boundaries create less explicit, harder-to-control complexity

### Team Capability Requirements
- Success depends on team skill
- Poor teams create poor systems regardless of architecture

### Component Boundary Errors
- Getting initial service boundaries right is difficult
- Interface changes require coordination and backward compatibility
- Remote calls make refactoring harder than in-process calls

## Operational Considerations

- Sophisticated monitoring essential for individual service health
- Real-time dashboards detect emergent behavior issues
- Independent service deployment enables faster, targeted releases
- Requires mature DevOps practices and culture
