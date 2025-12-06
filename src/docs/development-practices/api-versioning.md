# API Design & Versioning Strategies

## API Versioning Strategies

### URL Path Versioning

```typescript
// Version in URL path
app.get('/api/v1/users', getUsersV1);
app.get('/api/v2/users', getUsersV2);

// ✅ Pros: Clear, cacheable, easy to route
// ❌ Cons: URL changes, forces new version for all endpoints
```

### Header Versioning

```typescript
app.get('/api/users', (req, res) => {
  const version = req.headers['api-version'] || '1';

  if (version === '2') {
    return getUsersV2(req, res);
  }

  return getUsersV1(req, res);
});

// Request:
// GET /api/users
// API-Version: 2

// ✅ Pros: Clean URLs, selective versioning
// ❌ Cons: Harder to test/cache, not visible in browser
```

### Accept Header Versioning (Content Negotiation)

```typescript
app.get('/api/users', (req, res) => {
  const acceptHeader = req.headers['accept'];

  if (acceptHeader?.includes('application/vnd.myapp.v2+json')) {
    return getUsersV2(req, res);
  }

  return getUsersV1(req, res);
});

// Request:
// GET /api/users
// Accept: application/vnd.myapp.v2+json

// ✅ Pros: RESTful, follows HTTP standards
// ❌ Cons: Complex, harder to debug
```

### Query Parameter Versioning

```typescript
app.get('/api/users', (req, res) => {
  const version = req.query.version || '1';

  if (version === '2') {
    return getUsersV2(req, res);
  }

  return getUsersV1(req, res);
});

// Request: GET /api/users?version=2

// ✅ Pros: Easy to test, visible
// ❌ Cons: URL pollution, not RESTful
```

### Recommended: URL Path Versioning

```typescript
// Clear structure with version namespacing
const v1Router = express.Router();
const v2Router = express.Router();

// V1 endpoints
v1Router.get('/users', async (req, res) => {
  const users = await db.getUsers();
  res.json(users.map(u => ({
    id: u.id,
    name: u.name,
    email: u.email
  })));
});

// V2 endpoints (expanded response)
v2Router.get('/users', async (req, res) => {
  const users = await db.getUsers();
  res.json(users.map(u => ({
    id: u.id,
    fullName: u.name,  // Renamed field
    email: u.email,
    profile: {         // Nested structure
      avatar: u.avatar_url,
      bio: u.bio
    },
    createdAt: u.created_at
  })));
});

app.use('/api/v1', v1Router);
app.use('/api/v2', v2Router);
```

## Backward Compatibility

### Additive Changes (Safe)

```typescript
// ✅ Adding optional fields
interface UserV1 {
  id: string;
  name: string;
  email: string;
}

interface UserV2 extends UserV1 {
  avatar?: string;     // Optional - backward compatible
  createdAt?: Date;    // Optional - backward compatible
}

// ✅ Adding new endpoints
app.get('/api/v1/users/:id/preferences', getPreferences);  // New, doesn't break existing

// ✅ Adding optional query parameters
app.get('/api/v1/users', (req, res) => {
  const { role } = req.query;  // Optional filter, defaults work without it
  // ...
});
```

### Breaking Changes (Require New Version)

```typescript
// ❌ Removing fields
interface UserV1 {
  id: string;
  name: string;
  email: string;
  phone: string;  // Removed in V2 - BREAKING
}

// ❌ Changing field types
interface UserV1 {
  createdAt: string;  // ISO string
}

interface UserV2 {
  createdAt: number;  // Unix timestamp - BREAKING
}

// ❌ Renaming fields
interface UserV1 {
  name: string;
}

interface UserV2 {
  fullName: string;  // Renamed - BREAKING
}

// ❌ Changing required vs optional
interface UserV1 {
  avatar?: string;  // Optional
}

interface UserV2 {
  avatar: string;  // Now required - BREAKING
}
```

### Deprecation Strategy

```typescript
// 1. Announce deprecation
app.get('/api/v1/users', (req, res) => {
  res.setHeader('X-API-Warn', 'Deprecated: Use /api/v2/users instead. V1 will be removed on 2025-12-31');
  res.setHeader('Sunset', 'Sat, 31 Dec 2025 23:59:59 GMT');  // RFC 8594

  // Return V1 response
});

// 2. Provide migration path
// Documentation:
// V1 → V2 Migration Guide:
// - `name` field renamed to `fullName`
// - `createdAt` changed from string to Unix timestamp
// - New optional `profile` object added

// 3. Maintain for grace period (6-12 months)

// 4. Remove deprecated version
// Delete V1 routes, return 410 Gone
app.all('/api/v1/*', (req, res) => {
  res.status(410).json({
    error: 'API version 1 has been retired. Please use /api/v2'
  });
});
```

## Evolutionary API Design

### Expand-Contract Pattern

```typescript
// Phase 1: Expand (support both old and new)
interface User {
  name: string;         // Old field
  fullName?: string;    // New field
}

app.get('/api/v1/users/:id', async (req, res) => {
  const user = await db.getUser(req.params.id);

  res.json({
    id: user.id,
    name: user.full_name,          // Old field (still populated)
    fullName: user.full_name,       // New field (also populated)
    email: user.email
  });
});

// Phase 2: Migrate clients to new field

// Phase 3: Contract (remove old field in next version)
app.get('/api/v2/users/:id', async (req, res) => {
  const user = await db.getUser(req.params.id);

  res.json({
    id: user.id,
    fullName: user.full_name,  // Only new field
    email: user.email
  });
});
```

### Parallel Run

```typescript
// Run old and new implementations side-by-side
const getUsersV1 = async (req, res) => {
  const users = await db.query('SELECT id, name FROM users');
  res.json(users);
};

const getUsersV2 = async (req, res) => {
  const users = await db.query(`
    SELECT id, name, email, created_at
    FROM users
    JOIN user_profiles ON users.id = user_profiles.user_id
  `);
  res.json(users);
};

app.get('/api/v1/users', getUsersV1);
app.get('/api/v2/users', getUsersV2);

// Both versions available during transition
```

## GraphQL Versioning

### Schema Evolution (No Versioning Needed)

```graphql
# Original schema
type User {
  id: ID!
  name: String!
  email: String!
}

# Evolved schema (backward compatible)
type User {
  id: ID!
  name: String!  @deprecated(reason: "Use fullName instead")
  fullName: String!
  email: String!
  avatar: String  # New optional field
  profile: UserProfile  # New optional nested type
}

type UserProfile {
  bio: String
  website: String
}
```

```typescript
// Resolvers handle both old and new fields
const resolvers = {
  User: {
    name: (user) => user.full_name,      // Legacy support
    fullName: (user) => user.full_name,  // New field
    avatar: (user) => user.avatar_url,
    profile: (user) => ({
      bio: user.bio,
      website: user.website
    })
  }
};

// Clients request only what they need
query {
  user(id: "123") {
    fullName  # New clients use fullName
    email
    profile {
      bio
    }
  }
}
```

## API Documentation

### OpenAPI/Swagger

```yaml
openapi: 3.0.0
info:
  title: User API
  version: 2.0.0
  description: User management API

servers:
  - url: https://api.example.com/v2
    description: Production API v2

paths:
  /users:
    get:
      summary: List users
      parameters:
        - in: query
          name: role
          schema:
            type: string
            enum: [admin, user, guest]
          description: Filter by user role
        - in: query
          name: limit
          schema:
            type: integer
            default: 20
            minimum: 1
            maximum: 100
      responses:
        '200':
          description: Successful response
          content:
            application/json:
              schema:
                type: object
                properties:
                  users:
                    type: array
                    items:
                      $ref: '#/components/schemas/User'
                  pagination:
                    $ref: '#/components/schemas/Pagination'

components:
  schemas:
    User:
      type: object
      required:
        - id
        - fullName
        - email
      properties:
        id:
          type: string
          format: uuid
        fullName:
          type: string
        email:
          type: string
          format: email
        avatar:
          type: string
          format: uri
          nullable: true
        createdAt:
          type: string
          format: date-time
```

## Hypermedia (HATEOAS)

### Self-Describing APIs

```typescript
// Include links to related resources
app.get('/api/v1/users/:id', async (req, res) => {
  const user = await db.getUser(req.params.id);

  res.json({
    id: user.id,
    name: user.name,
    email: user.email,
    _links: {
      self: { href: `/api/v1/users/${user.id}` },
      orders: { href: `/api/v1/users/${user.id}/orders` },
      preferences: { href: `/api/v1/users/${user.id}/preferences` },
      avatar: { href: user.avatar_url }
    }
  });
});

// HAL format example
{
  "id": "123",
  "name": "John Doe",
  "email": "john@example.com",
  "_links": {
    "self": { "href": "/api/v1/users/123" },
    "orders": { "href": "/api/v1/users/123/orders" }
  },
  "_embedded": {
    "recentOrders": [
      {
        "id": "order-1",
        "total": 99.99,
        "_links": {
          "self": { "href": "/api/v1/orders/order-1" }
        }
      }
    ]
  }
}
```

## Rate Limiting

### Token Bucket Algorithm

```typescript
class RateLimiter {
  private tokens = new Map<string, { count: number; resetAt: number }>();

  constructor(
    private limit: number = 100,
    private windowMs: number = 60000
  ) {}

  async checkLimit(key: string): Promise<{ allowed: boolean; remaining: number }> {
    const now = Date.now();
    const bucket = this.tokens.get(key);

    if (!bucket || now > bucket.resetAt) {
      this.tokens.set(key, {
        count: this.limit - 1,
        resetAt: now + this.windowMs
      });
      return { allowed: true, remaining: this.limit - 1 };
    }

    if (bucket.count > 0) {
      bucket.count--;
      return { allowed: true, remaining: bucket.count };
    }

    return { allowed: false, remaining: 0 };
  }
}

// Middleware
const rateLimiter = new RateLimiter(100, 60000); // 100 req/min

app.use(async (req, res, next) => {
  const key = req.ip || 'anonymous';
  const { allowed, remaining } = await rateLimiter.checkLimit(key);

  res.setHeader('X-RateLimit-Limit', '100');
  res.setHeader('X-RateLimit-Remaining', remaining.toString());
  res.setHeader('X-RateLimit-Reset', Date.now() + 60000);

  if (!allowed) {
    return res.status(429).json({
      error: 'Too many requests',
      retryAfter: 60
    });
  }

  next();
});
```

## Error Responses

### Consistent Error Format

```typescript
interface APIError {
  error: {
    code: string;
    message: string;
    details?: unknown;
    timestamp: string;
    path: string;
    requestId?: string;
  };
}

app.use((err, req, res, next) => {
  const statusCode = err.statusCode || 500;

  res.status(statusCode).json({
    error: {
      code: err.code || 'INTERNAL_ERROR',
      message: err.message,
      details: err.details,
      timestamp: new Date().toISOString(),
      path: req.path,
      requestId: req.id
    }
  });
});

// Usage
throw {
  statusCode: 400,
  code: 'VALIDATION_ERROR',
  message: 'Invalid user input',
  details: {
    fields: {
      email: 'Invalid email format',
      age: 'Must be between 0 and 150'
    }
  }
};
```

### HTTP Status Codes

```typescript
// 2xx Success
res.status(200).json(data);          // OK
res.status(201).json(created);       // Created
res.status(204).send();              // No Content

// 3xx Redirection
res.status(301).redirect(newUrl);    // Moved Permanently
res.status(304).send();              // Not Modified

// 4xx Client Errors
res.status(400).json({ error });     // Bad Request
res.status(401).json({ error });     // Unauthorized
res.status(403).json({ error });     // Forbidden
res.status(404).json({ error });     // Not Found
res.status(409).json({ error });     // Conflict
res.status(422).json({ error });     // Unprocessable Entity
res.status(429).json({ error });     // Too Many Requests

// 5xx Server Errors
res.status(500).json({ error });     // Internal Server Error
res.status(502).json({ error });     // Bad Gateway
res.status(503).json({ error });     // Service Unavailable
```

## API Pagination

### Cursor-Based Pagination

```typescript
app.get('/api/v1/users', async (req, res) => {
  const { cursor, limit = 20 } = req.query;

  const users = await db.query(`
    SELECT * FROM users
    WHERE ${cursor ? 'id > ?' : 'TRUE'}
    ORDER BY id
    LIMIT ?
  `, cursor ? [cursor, limit] : [limit]);

  const nextCursor = users.length === limit ? users[users.length - 1].id : null;

  res.json({
    data: users,
    pagination: {
      cursor: nextCursor,
      hasMore: nextCursor !== null
    },
    _links: {
      self: { href: `/api/v1/users?limit=${limit}${cursor ? `&cursor=${cursor}` : ''}` },
      next: nextCursor ? { href: `/api/v1/users?limit=${limit}&cursor=${nextCursor}` } : null
    }
  });
});
```

## API Security

### API Keys

```typescript
const validateAPIKey = async (req, res, next) => {
  const apiKey = req.headers['x-api-key'];

  if (!apiKey) {
    return res.status(401).json({ error: 'API key required' });
  }

  const client = await db.findClientByAPIKey(apiKey);

  if (!client) {
    return res.status(401).json({ error: 'Invalid API key' });
  }

  if (!client.is_active) {
    return res.status(403).json({ error: 'API key deactivated' });
  }

  req.client = client;
  next();
};

app.use('/api/v1', validateAPIKey);
```

### OAuth 2.0

```typescript
import passport from 'passport';
import { Strategy as OAuth2Strategy } from 'passport-oauth2';

passport.use(new OAuth2Strategy({
  authorizationURL: 'https://provider.com/oauth/authorize',
  tokenURL: 'https://provider.com/oauth/token',
  clientID: process.env.OAUTH_CLIENT_ID,
  clientSecret: process.env.OAUTH_CLIENT_SECRET,
  callbackURL: 'https://myapp.com/auth/callback'
}, (accessToken, refreshToken, profile, done) => {
  // Verify and create/update user
  return done(null, profile);
}));

app.get('/auth/oauth',
  passport.authenticate('oauth2'));

app.get('/auth/callback',
  passport.authenticate('oauth2', { failureRedirect: '/login' }),
  (req, res) => {
    res.redirect('/dashboard');
  });
```

## Anti-Patterns

### ❌ Breaking Changes Without Version Bump

```typescript
// ❌ Changing response format in same version
// V1 before:
{ "name": "John" }

// V1 after (BREAKING):
{ "fullName": "John" }  // Breaks existing clients

// ✅ Create new version instead
// V1: { "name": "John" }
// V2: { "fullName": "John" }
```

### ❌ Over-Versioning

```typescript
// ❌ Too many versions
/api/v1/users
/api/v2/users
/api/v3/users
/api/v4/users  // Maintenance nightmare

// ✅ Consolidate and deprecate
/api/v2/users  (supports most features)
/api/v3/users  (latest)
```

### ❌ Leaking Implementation Details

```typescript
// ❌ Database structure exposed
GET /api/users_table?user_id=123

// ✅ Resource-oriented
GET /api/users/123
```

## References

- [REST API Design](https://martinfowler.com/articles/richardsonMaturityModel.html)
- [API Versioning](https://www.troyhunt.com/your-api-versioning-is-wrong-which-is/)
- [GraphQL Best Practices](https://graphql.org/learn/best-practices/)
- [OpenAPI Specification](https://swagger.io/specification/)
