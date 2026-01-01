# Security

# Injection Prevention

## SQL Injection Prevention

```typescript
// ❌ DANGEROUS: String concatenation
const getUserByEmail = async (email: string) => {
  const query = `SELECT * FROM users WHERE email = '${email}'`;
  // Input: ' OR '1'='1
  // Result: SELECT * FROM users WHERE email = '' OR '1'='1'
  return db.query(query);
};

// ✅ SAFE: Parameterized queries
const getUserByEmail = async (email: string) => {
  return db.query('SELECT * FROM users WHERE email = ?', [email]);
};

// ✅ SAFE: Using ORM
const getUserByEmail = async (email: string) => {
  return userRepository.findOne({ where: { email } });
};

// ✅ SAFE: Query builder
const getUsers = async (minAge: number) => {
  return db
    .select('*')
    .from('users')
    .where('age', '>', minAge); // Automatically parameterized
};
```

## NoSQL Injection Prevention

```typescript
// ❌ DANGEROUS: Accepting objects from user input
app.post('/login', (req, res) => {
  const { username, password } = req.body;
  // If password = {$gt: ""}, it bypasses password check!
  db.users.findOne({ username, password });
});

// ✅ SAFE: Validate input types
app.post('/login', (req, res) => {
  const { username, password } = req.body;

  if (typeof username !== 'string' || typeof password !== 'string') {
    throw new Error('Invalid input types');
  }

  db.users.findOne({ username, password });
});
```

## Command Injection Prevention

```typescript
// ❌ DANGEROUS: Shell command with user input
const convertImage = async (filename: string) => {
  exec(`convert ${filename} output.jpg`);
  // Input: "file.png; rm -rf /"
};

// ✅ SAFE: Use arrays, avoid shell
import { execFile } from 'child_process';

const convertImage = async (filename: string) => {
  execFile('convert', [filename, 'output.jpg']);
};

// ✅ SAFE: Validate input against whitelist
const allowedFilename = /^[a-zA-Z0-9_-]+\.(png|jpg|gif)$/;
if (!allowedFilename.test(filename)) {
  throw new Error('Invalid filename');
}
```

## Path Traversal Prevention

```typescript
// ❌ DANGEROUS: Direct path usage
app.get('/files/:filename', (req, res) => {
  res.sendFile(`/uploads/${req.params.filename}`);
  // Input: ../../etc/passwd
});

// ✅ SAFE: Validate and normalize path
import path from 'path';

app.get('/files/:filename', (req, res) => {
  const safeName = path.basename(req.params.filename);
  const filePath = path.join('/uploads', safeName);
  const normalizedPath = path.normalize(filePath);

  if (!normalizedPath.startsWith('/uploads/')) {
    return res.status(400).json({ error: 'Invalid filename' });
  }

  res.sendFile(normalizedPath);
});
```

## Input Validation

```typescript
// ✅ Whitelist validation
import { z } from 'zod';

const userSchema = z.object({
  email: z.string().email(),
  password: z.string().min(12).max(160),
  age: z.number().int().min(0).max(150),
  role: z.enum(['user', 'admin'])
});

const validateUser = (data: unknown) => {
  return userSchema.parse(data);
};
```


---

# Authentication & JWT Security

## Password Storage

```typescript
import bcrypt from 'bcrypt';

const SALT_ROUNDS = 12; // Work factor

// ✅ Hash password with bcrypt
async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, SALT_ROUNDS);
}

async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

// ✅ Validate password strength
function validatePassword(password: string): void {
  if (password.length < 12) {
    throw new Error('Password must be at least 12 characters');
  }
  if (password.length > 160) {
    throw new Error('Password too long'); // Prevent DoS via bcrypt
  }
}
```

## JWT Best Practices

```typescript
import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET!;
const ACCESS_TOKEN_EXPIRY = '15m';
const REFRESH_TOKEN_EXPIRY = '7d';

// ✅ Generate tokens
function generateTokens(userId: string) {
  const accessToken = jwt.sign(
    { sub: userId, type: 'access' },
    JWT_SECRET,
    { expiresIn: ACCESS_TOKEN_EXPIRY }
  );

  const refreshToken = jwt.sign(
    { sub: userId, type: 'refresh' },
    JWT_SECRET,
    { expiresIn: REFRESH_TOKEN_EXPIRY }
  );

  return { accessToken, refreshToken };
}

// ✅ Verify and decode token
function verifyToken(token: string) {
  try {
    return jwt.verify(token, JWT_SECRET);
  } catch (error) {
    if (error instanceof jwt.TokenExpiredError) {
      throw new UnauthorizedError('Token expired');
    }
    throw new UnauthorizedError('Invalid token');
  }
}
```

## Login Protection

```typescript
import rateLimit from 'express-rate-limit';

// ✅ Rate limit login attempts
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // 5 attempts
  message: 'Too many login attempts, please try again later',
});

app.post('/login', loginLimiter, async (req, res) => {
  const { email, password } = req.body;

  const user = await userService.findByEmail(email);

  // ✅ Generic error message (don't reveal if user exists)
  if (!user || !await verifyPassword(password, user.passwordHash)) {
    return res.status(401).json({ error: 'Invalid email or password' });
  }

  const tokens = generateTokens(user.id);

  // Regenerate session to prevent fixation
  req.session.regenerate(() => {
    res.json({ ...tokens });
  });
});
```

## Session Security

```typescript
app.use(session({
  secret: process.env.SESSION_SECRET!,
  name: 'sessionId', // Don't use default 'connect.sid'

  cookie: {
    secure: true,        // HTTPS only
    httpOnly: true,      // Prevent XSS access
    sameSite: 'strict',  // CSRF protection
    maxAge: 30 * 60 * 1000, // 30 minutes
  },

  resave: false,
  saveUninitialized: false,
  store: new RedisStore({ client: redisClient })
}));

// ✅ Session regeneration after login
app.post('/login', async (req, res, next) => {
  // ... authenticate user ...

  req.session.regenerate((err) => {
    req.session.userId = user.id;
    res.json({ success: true });
  });
});
```

## Authorization Middleware

```typescript
// ✅ Require authentication
const requireAuth = async (req: Request, res: Response, next: NextFunction) => {
  const token = req.headers.authorization?.replace('Bearer ', '');

  if (!token) {
    return res.status(401).json({ error: 'Authentication required' });
  }

  try {
    const payload = verifyToken(token);
    req.user = await userService.findById(payload.sub);
    next();
  } catch (error) {
    res.status(401).json({ error: 'Invalid token' });
  }
};

// ✅ Require specific role
const requireRole = (...roles: string[]) => {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({ error: 'Forbidden' });
    }
    next();
  };
};
```


---

# Secrets Management

## Environment Variables

```typescript
// ❌ NEVER hardcode secrets
const config = {
  dbPassword: 'super_secret_password',
  apiKey: 'sk-1234567890abcdef'
};

// ✅ Use environment variables
import dotenv from 'dotenv';
dotenv.config();

const config = {
  dbPassword: process.env.DB_PASSWORD,
  apiKey: process.env.API_KEY,
  sessionSecret: process.env.SESSION_SECRET
};
```

## Validate Required Secrets

```typescript
// ✅ Fail fast if secrets missing
const requiredEnvVars = [
  'DB_PASSWORD',
  'API_KEY',
  'SESSION_SECRET',
  'JWT_SECRET'
];

requiredEnvVars.forEach(varName => {
  if (!process.env[varName]) {
    throw new Error(`Missing required environment variable: ${varName}`);
  }
});

// ✅ Type-safe config
interface Config {
  dbPassword: string;
  apiKey: string;
  sessionSecret: string;
}

function loadConfig(): Config {
  const dbPassword = process.env.DB_PASSWORD;
  if (!dbPassword) throw new Error('DB_PASSWORD required');

  // ... validate all required vars

  return { dbPassword, apiKey, sessionSecret };
}
```

## Generate Strong Secrets

```bash
# Generate cryptographically secure secrets
node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"

# Or using OpenSSL
openssl rand -base64 32

# Or using head
head -c32 /dev/urandom | base64
```

## .gitignore Configuration

```bash
# .gitignore - NEVER commit secrets
.env
.env.local
.env.*.local
*.key
*.pem
secrets/
credentials.json
```

## Environment Example File

```bash
# .env.example - commit this to show required variables
DB_HOST=localhost
DB_PORT=5432
DB_NAME=myapp
DB_USER=
DB_PASSWORD=

API_KEY=
SESSION_SECRET=
JWT_SECRET=

# Copy to .env and fill in actual values
```

## Secrets in CI/CD

```yaml
# GitHub Actions
- name: Deploy
  env:
    DB_PASSWORD: ${{ secrets.DB_PASSWORD }}
    API_KEY: ${{ secrets.API_KEY }}
  run: ./deploy.sh

# ❌ Never echo secrets in logs
- name: Configure
  run: |
    echo "Configuring application..."
    # echo "DB_PASSWORD=$DB_PASSWORD"  # NEVER do this!
```

## Secrets Rotation

```typescript
// ✅ Support for rotating secrets
class SecretManager {
  async getSecret(name: string): Promise<string> {
    // Check for new secret first (during rotation)
    const newSecret = process.env[`${name}_NEW`];
    if (newSecret) {
      return newSecret;
    }

    const secret = process.env[name];
    if (!secret) {
      throw new Error(`Secret ${name} not found`);
    }
    return secret;
  }
}

// ✅ Accept multiple JWT signing keys during rotation
function verifyToken(token: string) {
  const keys = [process.env.JWT_SECRET, process.env.JWT_SECRET_OLD].filter(Boolean);

  for (const key of keys) {
    try {
      return jwt.verify(token, key);
    } catch {}
  }
  throw new Error('Invalid token');
}
```
