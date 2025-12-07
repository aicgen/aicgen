# Modular Monolith Structure

## Project Organization

```
project-root/
├── apps/
│   └── api/
│       ├── src/
│       │   ├── app/              # Application bootstrap
│       │   ├── modules/          # Business modules
│       │   │   ├── auth/
│       │   │   ├── user/
│       │   │   ├── booking/
│       │   │   ├── payment/
│       │   │   └── notification/
│       │   ├── common/           # Shared infrastructure
│       │   │   ├── decorators/
│       │   │   ├── guards/
│       │   │   └── interceptors/
│       │   └── prisma/           # Database service
│       └── main.ts
├── libs/                         # Shared libraries
│   └── shared-types/
└── package.json
```

## Module Structure

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

## Module Definition

```typescript
@Module({
  imports: [
    PrismaModule,
    forwardRef(() => AuthModule),
    NotificationsModule,
  ],
  controllers: [BookingsController],
  providers: [
    BookingService,
    AvailabilityService,
    BookingRepository,
  ],
  exports: [BookingService], // Only export public API
})
export class BookingsModule {}
```

## Layered Architecture Within Modules

```typescript
// Controller - HTTP layer
@Controller('api/v1/bookings')
export class BookingsController {
  constructor(private bookingService: BookingService) {}

  @Get('calendar')
  async getCalendarBookings(@Query() dto: GetBookingsDto) {
    return this.bookingService.getBookingsForCalendar(dto);
  }
}

// Service - Business logic
@Injectable()
export class BookingService {
  constructor(
    private bookingRepository: BookingRepository,
    private availabilityService: AvailabilityService,
  ) {}

  async getBookingsForCalendar(dto: GetBookingsDto) {
    const bookings = await this.bookingRepository.findByDateRange(
      dto.startDate,
      dto.endDate
    );
    return bookings.map(this.mapToCalendarDto);
  }
}

// Repository - Data access
@Injectable()
export class BookingRepository {
  constructor(private prisma: PrismaService) {}

  async findByDateRange(start: Date, end: Date) {
    return this.prisma.booking.findMany({
      where: {
        startTime: { gte: start },
        endTime: { lte: end }
      }
    });
  }
}
```

## Shared Infrastructure

```typescript
// common/guards/jwt-auth.guard.ts
@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {
  canActivate(context: ExecutionContext) {
    const isPublic = this.reflector.get<boolean>('isPublic', context.getHandler());
    return isPublic ? true : super.canActivate(context);
  }
}

// common/decorators/current-user.decorator.ts
export const CurrentUser = createParamDecorator(
  (data: unknown, ctx: ExecutionContext) => {
    return ctx.switchToHttp().getRequest().user;
  }
);
```
