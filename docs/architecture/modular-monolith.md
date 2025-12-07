# Modular Monolith Architecture

## Overview

A modular monolith is a software architecture where the application is built as a single deployable unit, but internally structured into well-defined, loosely coupled modules with clear boundaries. This approach combines the simplicity of monolithic deployment with the maintainability benefits of modular design.

## Core Philosophy: Monolith First

### Why Start with a Monolith

**Martin Fowler's empirical observation:** "Almost all successful microservice stories have started with a monolith that got too big and was broken up."

**Key Reasons:**

1. **Microservice Premium Cost**: Microservices impose significant overhead in managing multiple services, deployment pipelines, distributed tracing, and inter-service communication. This complexity only pays off for sufficiently complex systems.

2. **YAGNI Principle**: When launching applications, uncertainty about market success is high. A successful but poorly designed monolith beats an unsuccessful sophisticated microservices architecture.

3. **Boundary Discovery**: Establishing stable service boundaries is extremely difficult initially. Any refactoring across service boundaries is much harder than within a monolith. Start with a monolith to explore and discover correct boundaries before they become architecturally rigid.

4. **Speed & Feedback**: Initial speed and tight feedback loops matter most when validating product-market fit.

### When Monolith First Doesn't Apply

- **System Replacement**: Replacing existing systems where boundaries are already well-understood
- **Existing Expertise**: Teams with proven microservices experience
- **Known Scale Requirements**: Clear need for independent scaling from day one

---

## Modular Monolith Structure

### High-Level Organization

```
project-root/
├── apps/
│   └── api/                      # Main application
│       ├── src/
│       │   ├── app/              # Application bootstrap
│       │   ├── modules/          # Business modules (bounded contexts)
│       │   │   ├── auth/
│       │   │   ├── user/
│       │   │   ├── booking/
│       │   │   ├── payment/
│       │   │   ├── notification/
│       │   │   └── ...
│       │   ├── common/           # Shared infrastructure
│       │   │   ├── decorators/
│       │   │   ├── guards/
│       │   │   ├── interceptors/
│       │   │   └── interfaces/
│       │   └── prisma/           # Database service (global)
│       └── main.ts
├── libs/                         # Shared libraries (optional)
│   └── shared-types/             # Shared DTOs and types
├── prisma/
│   ├── schema.prisma
│   └── migrations/
└── package.json
```

### Module Structure (Per Business Capability)

Each module follows consistent layered architecture:

```
modules/booking/
├── entities/              # Domain models and DTOs
│   ├── booking.entity.ts
│   ├── create-booking.dto.ts
│   └── booking-response.dto.ts
├── repositories/          # Data access layer
│   └── booking.repository.ts
├── services/              # Business logic
│   ├── booking.service.ts
│   └── availability.service.ts
├── controllers/           # HTTP/API layer
│   └── bookings.controller.ts
└── booking.module.ts      # Module definition
```

---

## Module Design Principles

### 1. High Cohesion, Low Coupling

**Each module should:**
- Encapsulate a single business capability (bounded context)
- Have clearly defined public interfaces
- Hide implementation details
- Minimize dependencies on other modules

❌ **Bad (Tight Coupling):**
```typescript
// OrderService directly accessing UserRepository
@Injectable()
export class OrderService {
  constructor(private userRepo: UserRepository) {} // Direct dependency

  async createOrder(userId: string) {
    const user = await this.userRepo.findById(userId); // Crosses module boundary
  }
}
```

✅ **Good (Loose Coupling via Service):**
```typescript
// OrderService depends on UserService interface
@Injectable()
export class OrderService {
  constructor(private userService: UserService) {} // Service dependency

  async createOrder(userId: string) {
    const user = await this.userService.findById(userId); // Through public API
  }
}
```

### 2. Separated Interface Pattern

Define interfaces in consuming module, implement in providing module.

```typescript
// modules/order/interfaces/user-provider.interface.ts
export interface UserProvider {
  findById(id: string): Promise<User>;
  validateUser(id: string): Promise<boolean>;
}

// modules/user/user.service.ts
@Injectable()
export class UserService implements UserProvider {
  async findById(id: string): Promise<User> {
    return this.userRepo.findById(id);
  }

  async validateUser(id: string): Promise<boolean> {
    const user = await this.findById(id);
    return user && user.isActive;
  }
}

// modules/user/user.module.ts
@Module({
  providers: [UserService],
  exports: [UserService], // Export for other modules
})
export class UserModule {}
```

### 3. No Direct Cross-Module Database Access

**Never** query another module's tables directly.

❌ **Bad:**
```typescript
// In BookingService, querying user table directly
const user = await this.prisma.user.findUnique({ where: { id: userId } });
```

✅ **Good:**
```typescript
// Use UserService
const user = await this.userService.findById(userId);
```

### 4. Dependency Direction

**Dependencies should point inward:** Common utilities can be used by modules, but modules should not depend on each other's internals.

```
┌─────────────────────────────────────┐
│         Modules (Business Logic)     │
│  ┌──────┐ ┌──────┐ ┌──────┐         │
│  │ User │ │ Order│ │ Pay  │         │
│  └──┬───┘ └───┬──┘ └──┬───┘         │
│     │         │        │             │
│     └─────────┼────────┘             │
│               ▼                      │
│      ┌────────────────┐              │
│      │ Common/Shared  │              │
│      │  (Guards, etc) │              │
│      └────────────────┘              │
└─────────────────────────────────────┘
```

---

## Real-World Example: Booking System

### Module Catalog

```typescript
// app.module.ts - Root module
@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    PrismaModule,           // Shared database service
    LocationModule,         // Business module
    UsersModule,            // Business module
    AuthModule,             // Business module
    AuditModule,            // Cross-cutting concern
    RolesModule,            // Business module
    ServicesModule,         // Business module
    ResourceModule,         // Business module
    StaffModule,            // Business module
    BookingsModule,         // Business module
    AppConfigModule,        // Business module
  ],
})
export class AppModule {}
```

### Module Definition Example

```typescript
// modules/user/users.module.ts
import { Module, forwardRef } from '@nestjs/common';
import { UsersController } from './controllers/users.controller';
import { RolesController } from './controllers/roles.controller';
import { InvitationsController } from './controllers/invitations.controller';
import { UserService } from './services/user.service';
import { RoleService } from './services/role.service';
import { InvitationService } from './services/invitation.service';
import { UserRepository } from './repositories/user.repository';
import { RoleRepository } from './repositories/role.repository';
import { RefreshTokenRepository } from './repositories/refresh-token.repository';
import { InvitationRepository } from './repositories/invitation.repository';
import { RolesModule } from '../roles/roles.module';
import { PrismaModule } from '../../prisma/prisma.module';
import { AuthModule } from '../auth/auth.module';
import { NotificationsModule } from '../notifications/notifications.module';

@Module({
  imports: [
    RolesModule,
    PrismaModule,
    NotificationsModule,
    forwardRef(() => AuthModule), // Handle circular dependency
  ],
  controllers: [
    UsersController,
    RolesController,
    InvitationsController,
  ],
  providers: [
    UserService,
    RoleService,
    InvitationService,
    UserRepository,
    RoleRepository,
    RefreshTokenRepository,
    InvitationRepository,
  ],
  exports: [
    UserService,           // Export for other modules
    RoleService,
    InvitationService,
    UserRepository,
    RoleRepository,
    RefreshTokenRepository,
    InvitationRepository,
  ],
})
export class UsersModule {}
```

### Service Layer Example

```typescript
// modules/bookings/services/booking.service.ts
import { Injectable, BadRequestException } from '@nestjs/common';
import { BookingRepository } from '../repositories/booking.repository';
import { CreateBookingDto, BookingDto } from '@shared/types';
import { PrismaService } from '../../../prisma/prisma.service';
import { AvailabilityService } from './availability.service';

@Injectable()
export class BookingService {
  constructor(
    private bookingRepository: BookingRepository,
    private prisma: PrismaService,
    private availabilityService: AvailabilityService, // Internal module service
  ) {}

  async getBookingsForCalendar(dto: GetBookingsDto): Promise<{
    data: BookingCalendarDto[];
    pagination: PaginationDto;
  }> {
    const startDate = new Date(dto.startDate);
    const endDate = new Date(dto.endDate);

    if (startDate >= endDate) {
      throw new BadRequestException('Start date must be before end date');
    }

    const page = dto.page || 1;
    const limit = Math.min(dto.limit || 100, 100);

    const filters = {
      locationId: dto.locationId,
      resourceId: dto.resourceId,
      staffId: dto.staffId,
      status: dto.status,
    };

    const [bookings, total] = await Promise.all([
      this.bookingRepository.findByDateRange(startDate, endDate, filters, page, limit),
      this.bookingRepository.count(startDate, endDate, filters),
    ]);

    return {
      data: bookings.map(b => this.mapToCalendarDto(b)),
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
        hasNext: page * limit < total,
        hasPrev: page > 1,
      },
    };
  }

  private mapToCalendarDto(booking: any): BookingCalendarDto {
    // Map database entity to DTO
    return { /* ... */ };
  }
}
```

### Repository Layer Example

```typescript
// modules/bookings/repositories/booking.repository.ts
import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import { Booking } from '@prisma/client';

export interface BookingFilters {
  locationId?: string;
  resourceId?: string;
  staffId?: string;
  status?: string;
}

@Injectable()
export class BookingRepository {
  constructor(private prisma: PrismaService) {}

  async findByDateRange(
    startDate: Date,
    endDate: Date,
    filters: BookingFilters,
    page: number,
    limit: number,
  ): Promise<Booking[]> {
    return this.prisma.booking.findMany({
      where: {
        startTime: { gte: startDate },
        endTime: { lte: endDate },
        ...this.buildFilters(filters),
      },
      skip: (page - 1) * limit,
      take: limit,
      include: {
        lines: {
          include: {
            serviceOption: {
              include: { service: true },
            },
          },
        },
      },
      orderBy: { startTime: 'asc' },
    });
  }

  async count(
    startDate: Date,
    endDate: Date,
    filters: BookingFilters,
  ): Promise<number> {
    return this.prisma.booking.count({
      where: {
        startTime: { gte: startDate },
        endTime: { lte: endDate },
        ...this.buildFilters(filters),
      },
    });
  }

  private buildFilters(filters: BookingFilters) {
    const where: any = {};
    if (filters.locationId) where.locationId = filters.locationId;
    if (filters.resourceId) where.resourceId = filters.resourceId;
    if (filters.staffId) where.staffId = filters.staffId;
    if (filters.status) where.status = filters.status;
    return where;
  }
}
```

### Controller Layer Example

```typescript
// modules/bookings/controllers/bookings.controller.ts
import { Controller, Get, Post, Body, Query, UseGuards } from '@nestjs/common';
import { BookingService } from '../services/booking.service';
import { CreateBookingDto, GetBookingsDto } from '@shared/types';
import { JwtAuthGuard } from '../../../common/guards/jwt-auth.guard';
import { CurrentUser } from '../../../common/decorators/current-user.decorator';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';

@ApiTags('Bookings')
@Controller('api/v1/bookings')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class BookingsController {
  constructor(private bookingService: BookingService) {}

  @Get('calendar')
  @ApiOperation({ summary: 'Get bookings for calendar view' })
  async getCalendarBookings(@Query() dto: GetBookingsDto) {
    return this.bookingService.getBookingsForCalendar(dto);
  }

  @Post()
  @ApiOperation({ summary: 'Create new booking' })
  async createBooking(
    @Body() dto: CreateBookingDto,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.bookingService.createBooking(dto, user);
  }
}
```

---

## Common Infrastructure

### Shared Utilities (src/common/)

```typescript
// common/decorators/current-user.decorator.ts
import { createParamDecorator, ExecutionContext } from '@nestjs/common';

export const CurrentUser = createParamDecorator(
  (data: unknown, ctx: ExecutionContext) => {
    const request = ctx.switchToHttp().getRequest();
    return request.user;
  },
);

// common/decorators/require-roles.decorator.ts
import { SetMetadata } from '@nestjs/common';

export const ROLES_KEY = 'roles';
export const RequireRoles = (...roles: string[]) =>
  SetMetadata(ROLES_KEY, roles);

// common/guards/jwt-auth.guard.ts
import { Injectable, ExecutionContext } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { Reflector } from '@nestjs/core';

@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {
  constructor(private reflector: Reflector) {
    super();
  }

  canActivate(context: ExecutionContext) {
    const isPublic = this.reflector.get<boolean>(
      'isPublic',
      context.getHandler(),
    );
    if (isPublic) {
      return true;
    }
    return super.canActivate(context);
  }
}

// common/interceptors/audit.interceptor.ts
import { Injectable, NestInterceptor, ExecutionContext, CallHandler } from '@nestjs/common';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';

@Injectable()
export class AuditInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const request = context.switchToHttp().getRequest();
    const { method, url, user } = request;

    return next.handle().pipe(
      tap(() => {
        // Log audit event
        console.log(`[AUDIT] ${method} ${url} - User: ${user?.id}`);
      }),
    );
  }
}
```

---

## Module Communication Patterns

### 1. Service Injection (Recommended)

```typescript
@Module({
  imports: [UserModule], // Import module
  providers: [OrderService],
})
export class OrderModule {}

@Injectable()
export class OrderService {
  constructor(private userService: UserService) {} // Inject service

  async createOrder(userId: string, items: OrderItem[]) {
    const user = await this.userService.findById(userId);
    // ... create order
  }
}
```

### 2. Domain Events (For Decoupling)

```typescript
// shared/events/user-created.event.ts
export class UserCreatedEvent {
  constructor(
    public readonly userId: string,
    public readonly email: string,
  ) {}
}

// modules/user/user.service.ts
import { EventEmitter2 } from '@nestjs/event-emitter';

@Injectable()
export class UserService {
  constructor(private eventEmitter: EventEmitter2) {}

  async createUser(dto: CreateUserDto): Promise<User> {
    const user = await this.userRepo.create(dto);

    // Emit event instead of calling NotificationService directly
    this.eventEmitter.emit(
      'user.created',
      new UserCreatedEvent(user.id, user.email),
    );

    return user;
  }
}

// modules/notification/notification.listener.ts
import { OnEvent } from '@nestjs/event-emitter';

@Injectable()
export class NotificationListener {
  constructor(private notificationService: NotificationService) {}

  @OnEvent('user.created')
  async handleUserCreated(event: UserCreatedEvent) {
    await this.notificationService.sendWelcomeEmail(event.email);
  }
}
```

### 3. Handling Circular Dependencies

Use `forwardRef()` when modules depend on each other:

```typescript
@Module({
  imports: [
    forwardRef(() => AuthModule), // Break circular dependency
    UserModule,
  ],
})
export class UserModule {}

@Module({
  imports: [
    forwardRef(() => UserModule),
  ],
})
export class AuthModule {}
```

---

## Database Strategy

### Shared Database with Module Boundaries

```typescript
// prisma/schema.prisma
model User {
  id        String   @id @default(uuid())
  email     String   @unique
  name      String
  // ... user fields

  bookings  Booking[] // Relation to Booking module
}

model Booking {
  id        String   @id @default(uuid())
  userId    String
  user      User     @relation(fields: [userId], references: [id])
  // ... booking fields
}
```

**Rules:**
- Modules can define their own tables
- Foreign keys can exist across module boundaries
- Never query another module's tables directly
- Use service layer for cross-module data access

---

## Migration Strategy to Microservices

### Gradual Extraction

When a module becomes too large or needs independent scaling:

1. **Identify Bounded Context**: Choose a well-defined module (e.g., Payment)
2. **Extract API**: Define clean REST/gRPC interface
3. **Deploy as Service**: Run alongside monolith
4. **Route Traffic**: Use API gateway or service mesh
5. **Migrate Data**: Extract module's database tables

### Example: Extracting Payment Module

**Before (Monolith):**
```typescript
@Module({
  imports: [PaymentModule],
})
export class OrderModule {}

@Injectable()
export class OrderService {
  constructor(private paymentService: PaymentService) {}
}
```

**After (Microservice):**
```typescript
@Module({
  providers: [PaymentClient], // HTTP client
})
export class OrderModule {}

@Injectable()
export class OrderService {
  constructor(private paymentClient: PaymentClient) {} // Remote call

  async createOrder(items: OrderItem[]) {
    const payment = await this.paymentClient.processPayment({
      amount: total,
      method: 'card',
    }); // HTTP call to payment microservice
  }
}
```

---

## Best Practices

### Module Design

✅ **DO:**
- Design modules around business capabilities (bounded contexts)
- Keep modules independently testable
- Export only what's necessary (minimal public API)
- Use DTOs for module boundaries
- Document module dependencies
- Use events for loose coupling

❌ **DON'T:**
- Create circular dependencies without forwardRef
- Access other modules' repositories directly
- Share entities across modules
- Create "util" or "common" modules that grow indefinitely
- Let modules know about internal structure of other modules

### Testing Strategy

```typescript
// Unit test - mock dependencies
describe('BookingService', () => {
  let service: BookingService;
  let repo: jest.Mocked<BookingRepository>;

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      providers: [
        BookingService,
        {
          provide: BookingRepository,
          useValue: { findById: jest.fn() },
        },
      ],
    }).compile();

    service = module.get(BookingService);
    repo = module.get(BookingRepository);
  });

  it('should find booking by id', async () => {
    repo.findById.mockResolvedValue(mockBooking);
    const result = await service.findById('123');
    expect(result).toEqual(mockBooking);
  });
});

// Integration test - test module interactions
describe('BookingModule (Integration)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    const module = await Test.createTestingModule({
      imports: [BookingModule, PrismaModule],
    }).compile();

    app = module.createNestApplication();
    await app.init();
  });

  it('should create booking', async () => {
    return request(app.getHttpServer())
      .post('/bookings')
      .send(createBookingDto)
      .expect(201);
  });
});
```

---

## Common Pitfalls

❌ **Distributed Monolith**: Extracting services too early without clear boundaries
❌ **God Module**: One module that knows about everything
❌ **Anemic Modules**: Modules with no business logic (just CRUD)
❌ **Database Coupling**: Modules directly accessing other modules' tables
❌ **Tight Coupling**: Services calling other modules' controllers directly
❌ **No Boundaries**: Shared entities and logic across modules
❌ **Premature Microservices**: Splitting before understanding domain

---

## Key Takeaways

1. **Start with Monolith**: Begin as modular monolith, extract microservices when needed
2. **Module = Bounded Context**: Each module represents a business capability
3. **Strong Boundaries**: Modules communicate via services, never direct database access
4. **Layered Architecture**: Controllers → Services → Repositories
5. **Loose Coupling**: Use events for cross-module communication
6. **Shared Infrastructure**: Common guards, decorators, interceptors
7. **Migration Ready**: Design for future extraction to microservices
8. **Test Independently**: Each module should be testable in isolation

**Remember:** "Almost all successful microservice stories have started with a monolith that got too big and was broken up" - Martin Fowler
