# Modular Monolith Boundaries

## High Cohesion, Low Coupling

```typescript
// ❌ Bad: Tight coupling - direct repository access
@Injectable()
export class OrderService {
  constructor(private userRepo: UserRepository) {} // Crosses module boundary

  async createOrder(userId: string) {
    const user = await this.userRepo.findById(userId); // Direct access
  }
}

// ✅ Good: Loose coupling via service
@Injectable()
export class OrderService {
  constructor(private userService: UserService) {} // Service dependency

  async createOrder(userId: string) {
    const user = await this.userService.findById(userId); // Through public API
  }
}
```

## No Direct Cross-Module Database Access

```typescript
// ❌ Never query another module's tables directly
class BookingService {
  async createBooking(data: CreateBookingDto) {
    const user = await this.prisma.user.findUnique({ where: { id: data.userId } });
    // This bypasses the User module!
  }
}

// ✅ Use the module's public service API
class BookingService {
  constructor(private userService: UserService) {}

  async createBooking(data: CreateBookingDto) {
    const user = await this.userService.findById(data.userId);
    // Properly goes through User module
  }
}
```

## Separated Interface Pattern

```typescript
// Define interface in consuming module
// modules/order/interfaces/user-provider.interface.ts
export interface UserProvider {
  findById(id: string): Promise<User>;
  validateUser(id: string): Promise<boolean>;
}

// Implement in providing module
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
```

## Domain Events for Loose Coupling

```typescript
// ✅ Publish events instead of direct calls
@Injectable()
export class UserService {
  constructor(private eventEmitter: EventEmitter2) {}

  async createUser(dto: CreateUserDto): Promise<User> {
    const user = await this.userRepo.create(dto);

    this.eventEmitter.emit('user.created', new UserCreatedEvent(user.id, user.email));

    return user;
  }
}

// Other modules subscribe to events
@Injectable()
export class NotificationListener {
  @OnEvent('user.created')
  async handleUserCreated(event: UserCreatedEvent) {
    await this.notificationService.sendWelcomeEmail(event.email);
  }
}
```

## Handling Circular Dependencies

```typescript
// Use forwardRef() when modules depend on each other
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

## Export Only What's Necessary

```typescript
@Module({
  providers: [
    UserService,        // Public service
    UserRepository,     // Internal
    PasswordHasher,     // Internal
  ],
  exports: [UserService], // Only export the service, not internals
})
export class UserModule {}
```
