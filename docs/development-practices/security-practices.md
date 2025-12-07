# Security Best Practices & Guidelines

## Input Validation

### Whitelist Validation

```typescript
// ❌ Blacklist approach (bypassable)
const sanitize = (input: string) => {
  return input.replace(/<script>/g, '');
  // Bypassed with: <scr<script>ipt>, <SCRIPT>, etc.
};

// ✅ Whitelist approach
const validateEmail = (email: string): boolean => {
  const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
  return emailRegex.test(email);
};

const validateAge = (age: string): number => {
  const ageNum = parseInt(age, 10);
  if (isNaN(ageNum) || ageNum < 0 || ageNum > 150) {
    throw new ValidationError('Invalid age');
  }
  return ageNum;
};
```

### Framework Validation

```typescript
// Using class-validator (TypeScript/NestJS)
import { IsEmail, IsInt, Min, Max, Length } from 'class-validator';

class CreateUserDto {
  @IsEmail()
  email: string;

  @Length(12, 160)
  password: string;

  @IsInt()
  @Min(0)
  @Max(150)
  age: number;
}

// Using Zod
import { z } from 'zod';

const userSchema = z.object({
  email: z.string().email(),
  password: z.string().min(12).max(160),
  age: z.number().int().min(0).max(150),
  url: z.string().url()
});

const validateUser = (data: unknown) => {
  return userSchema.parse(data); // Throws on invalid
};
```

### Validation Rules

- Keep contracts as restrictive as possible
- Reject invalid data without detailed error feedback
- Validate at API boundaries, not just UI
- Never trust client-side validation alone
- Validate data type, length, format, and range

## Output Encoding

### Context-Appropriate Encoding

```typescript
// ❌ Dangerous: Direct HTML injection
const showMessage = (userInput: string) => {
  element.innerHTML = userInput; // XSS vulnerability
};

// ✅ Safe: Text encoding
const showMessage = (userInput: string) => {
  element.textContent = userInput; // Automatically encoded
};

// For React
const UserProfile = ({ userName }: { userName: string }) => {
  return <div>{userName}</div>; // Auto-encoded by React
};

// ❌ Bypassing encoding
const UnsafeProfile = ({ html }: { html: string }) => {
  return <div dangerouslySetInnerHTML={{ __html: html }} />; // Avoid
};
```

### Template Encoding

```erb
<!-- ERB (Ruby) -->
<p><%= @user_input %></p>         <!-- Safe: Auto-encoded -->
<p><%= raw @user_input %></p>     <!-- Dangerous: No encoding -->

<!-- Thymeleaf (Java) -->
<p th:text="${userInput}"></p>     <!-- Safe: Auto-encoded -->
<p th:utext="${userInput}"></p>    <!-- Dangerous: No encoding -->

<!-- Handlebars -->
<p>{{userInput}}</p>               <!-- Safe: Auto-encoded -->
<p>{{{userInput}}}</p>             <!-- Dangerous: No encoding -->
```

### Storage and Rendering

```typescript
// ✅ Store raw, encode at render time
const saveComment = async (comment: string) => {
  await db.insert('comments', { text: comment }); // Store raw
};

const displayComment = (comment: Comment) => {
  return escapeHtml(comment.text); // Encode when displaying
};

// ❌ Don't encode before storage
const saveComment = async (comment: string) => {
  const encoded = escapeHtml(comment); // Wrong: encode at storage
  await db.insert('comments', { text: encoded });
};
```

## SQL Injection Prevention

### Parameter Binding

```typescript
// ❌ String concatenation (vulnerable)
const getUserByEmail = async (email: string) => {
  const query = `SELECT * FROM users WHERE email = '${email}'`;
  // Input: ' OR '1'='1
  // Result: SELECT * FROM users WHERE email = '' OR '1'='1'
  return db.query(query);
};

// ✅ Parameterized queries
const getUserByEmail = async (email: string) => {
  const query = 'SELECT * FROM users WHERE email = ?';
  return db.query(query, [email]);
};

// ✅ Using ORM (TypeORM example)
const getUserByEmail = async (email: string) => {
  return userRepository.findOne({ where: { email } });
};

// ✅ Using query builder
const getUsers = async (minAge: number) => {
  return db
    .select('*')
    .from('users')
    .where('age', '>', minAge); // Automatically parameterized
};
```

### Dynamic Queries

```typescript
// ❌ Building dynamic WHERE with concatenation
const searchUsers = async (filters: Record<string, string>) => {
  let query = 'SELECT * FROM users WHERE 1=1';
  Object.entries(filters).forEach(([key, value]) => {
    query += ` AND ${key} = '${value}'`; // SQL injection
  });
  return db.query(query);
};

// ✅ Using query builder for dynamic queries
const searchUsers = async (filters: Record<string, string>) => {
  let query = db.select('*').from('users');

  Object.entries(filters).forEach(([key, value]) => {
    query = query.where(key, '=', value); // Parameterized
  });

  return query;
};
```

### NoSQL Injection

```typescript
// ❌ MongoDB injection
const getUser = async (username: string) => {
  return db.collection('users').findOne({
    username: username,
    $where: `this.username === '${username}'` // Injection point
  });
};

// ✅ Safe MongoDB query
const getUser = async (username: string) => {
  return db.collection('users').findOne({ username }); // Safe
};

// ❌ Accepting objects from user input
app.post('/login', (req, res) => {
  const { username, password } = req.body;
  db.users.findOne({ username, password }); // If password = {$gt: ""}, bypasses check
});

// ✅ Validate types
app.post('/login', (req, res) => {
  const { username, password } = req.body;

  if (typeof username !== 'string' || typeof password !== 'string') {
    throw new Error('Invalid input types');
  }

  db.users.findOne({ username, password });
});
```

## Authentication

### Password Storage

```typescript
import bcrypt from 'bcrypt';

// ❌ Plaintext storage
const createUser = async (email: string, password: string) => {
  await db.insert('users', { email, password }); // Catastrophic
};

// ❌ Simple hash (no salt, fast algorithm)
const createUser = async (email: string, password: string) => {
  const hash = crypto.createHash('sha256').update(password).digest('hex');
  await db.insert('users', { email, password_hash: hash }); // Still weak
};

// ✅ Bcrypt with salt (recommended)
const SALT_ROUNDS = 12; // Configurable work factor

const createUser = async (email: string, password: string) => {
  const hash = await bcrypt.hash(password, SALT_ROUNDS);
  await db.insert('users', { email, password_hash: hash });
};

const verifyPassword = async (email: string, password: string): Promise<boolean> => {
  const user = await db.findOne('users', { email });
  if (!user) {
    return false; // Don't reveal user existence
  }
  return bcrypt.compare(password, user.password_hash);
};

// Using Argon2 (more modern)
import argon2 from 'argon2';

const createUser = async (email: string, password: string) => {
  const hash = await argon2.hash(password);
  await db.insert('users', { email, password_hash: hash });
};
```

### Password Policies

```typescript
const validatePassword = (password: string): boolean => {
  // Minimum length: 12 characters
  if (password.length < 12) {
    throw new Error('Password must be at least 12 characters');
  }

  // Maximum length: prevent DoS via bcrypt
  if (password.length > 160) {
    throw new Error('Password too long');
  }

  // ✅ Allow special characters, spaces, unicode
  // ✅ Don't prevent password manager usage
  // ✅ Support paste functionality

  return true;
};

// ❌ Avoid overly restrictive rules
const badPasswordValidation = (password: string) => {
  // Don't require specific character types
  // This reduces entropy and frustrates users
  if (!/[A-Z]/.test(password)) return false;
  if (!/[a-z]/.test(password)) return false;
  if (!/[0-9]/.test(password)) return false;
  if (!/[!@#$]/.test(password)) return false;
  // Bad approach
};
```

### Login Protection

```typescript
// Rate limiting and account lockout
import rateLimit from 'express-rate-limit';

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // 5 attempts
  message: 'Too many login attempts, please try again later',
  standardHeaders: true,
  legacyHeaders: false,
});

app.post('/login', loginLimiter, async (req, res) => {
  const { email, password } = req.body;

  // ✅ Generic error message
  const user = await verifyPassword(email, password);
  if (!user) {
    return res.status(401).json({ error: 'Invalid email or password' });
    // ❌ Don't say: "Email not found" or "Incorrect password"
  }

  // Create session
  req.session.userId = user.id;
  res.json({ success: true });
});

// Temporary lockout with exponential backoff
const loginAttempts = new Map<string, { count: number; lockedUntil?: Date }>();

const checkLoginAttempts = (email: string): boolean => {
  const attempts = loginAttempts.get(email);

  if (attempts?.lockedUntil && attempts.lockedUntil > new Date()) {
    return false; // Still locked
  }

  return true;
};

const recordFailedLogin = (email: string) => {
  const attempts = loginAttempts.get(email) || { count: 0 };
  attempts.count++;

  if (attempts.count >= 5) {
    // Lock for exponentially increasing time
    const lockMinutes = Math.pow(2, attempts.count - 5); // 1, 2, 4, 8... minutes
    attempts.lockedUntil = new Date(Date.now() + lockMinutes * 60 * 1000);
  }

  loginAttempts.set(email, attempts);
};
```

### Two-Factor Authentication

```typescript
import speakeasy from 'speakeasy';
import qrcode from 'qrcode';

const enable2FA = async (userId: string) => {
  const secret = speakeasy.generateSecret({
    name: `MyApp (${user.email})`
  });

  // Store secret (encrypted)
  await db.update('users', userId, {
    totp_secret: encrypt(secret.base32)
  });

  // Generate QR code for user
  const qrCodeUrl = await qrcode.toDataURL(secret.otpauth_url);

  return { secret: secret.base32, qrCode: qrCodeUrl };
};

const verify2FA = async (userId: string, token: string): Promise<boolean> => {
  const user = await db.findById('users', userId);
  const secret = decrypt(user.totp_secret);

  return speakeasy.totp.verify({
    secret,
    encoding: 'base32',
    token,
    window: 2 // Allow 2 time steps (60 seconds)
  });
};

// Login with 2FA
app.post('/login', async (req, res) => {
  const { email, password, totpToken } = req.body;

  const user = await verifyPassword(email, password);
  if (!user) {
    return res.status(401).json({ error: 'Invalid credentials' });
  }

  if (user.totp_enabled) {
    if (!totpToken || !await verify2FA(user.id, totpToken)) {
      return res.status(401).json({ error: 'Invalid 2FA token' });
    }
  }

  req.session.userId = user.id;
  res.json({ success: true });
});
```

## Session Management

### Secure Session Generation

```typescript
import crypto from 'crypto';

// ❌ Predictable session ID
const generateSessionId = () => {
  return `${Date.now()}-${Math.random()}`; // Predictable
};

// ✅ Cryptographically secure random
const generateSessionId = (): string => {
  return crypto.randomBytes(32).toString('base64'); // 256 bits
};

// Session creation
app.post('/login', async (req, res) => {
  const user = await authenticateUser(req.body);

  // ✅ Create new session after authentication
  req.session.regenerate((err) => {
    if (err) throw err;

    req.session.userId = user.id;
    req.session.save();
    res.json({ success: true });
  });
});
```

### Cookie Security

```typescript
// Express session configuration
import session from 'express-session';

app.use(session({
  secret: process.env.SESSION_SECRET, // Strong random secret
  name: 'sessionId', // Don't use default 'connect.sid'

  cookie: {
    secure: true,        // Only send over HTTPS
    httpOnly: true,      // Prevent JavaScript access
    sameSite: 'strict',  // CSRF protection
    maxAge: 30 * 60 * 1000, // 30 minutes
    domain: 'example.com',
    path: '/'
  },

  resave: false,
  saveUninitialized: false,

  // Use secure session store (Redis, database)
  store: new RedisStore({ client: redisClient })
}));

// ❌ Insecure cookie settings
app.use(session({
  cookie: {
    secure: false,      // Allows HTTP transmission
    httpOnly: false,    // Accessible via JavaScript
    sameSite: 'none'    // No CSRF protection
  }
}));
```

### Session Lifecycle

```typescript
// Inactivity timeout
const SESSION_TIMEOUT = 30 * 60 * 1000; // 30 minutes

app.use((req, res, next) => {
  if (req.session.userId) {
    const now = Date.now();
    const lastActivity = req.session.lastActivity || now;

    if (now - lastActivity > SESSION_TIMEOUT) {
      req.session.destroy();
      return res.status(401).json({ error: 'Session expired' });
    }

    req.session.lastActivity = now;
  }
  next();
});

// Logout endpoint
app.post('/logout', (req, res) => {
  req.session.destroy((err) => {
    if (err) {
      return res.status(500).json({ error: 'Logout failed' });
    }

    res.clearCookie('sessionId');
    res.json({ success: true });
  });
});

// Terminate all sessions on password change
const changePassword = async (userId: string, newPassword: string) => {
  const hash = await bcrypt.hash(newPassword, SALT_ROUNDS);
  await db.update('users', userId, { password_hash: hash });

  // Invalidate all sessions for this user
  await sessionStore.destroyAllForUser(userId);
};
```

## Authorization

### Server-Side Enforcement

```typescript
// ❌ Client-side only (dangerous)
const AdminPanel = () => {
  const user = useUser();

  if (!user.isAdmin) {
    return null; // UI hidden but API still accessible
  }

  return <AdminControls />;
};

// ✅ Server-side enforcement
app.delete('/users/:id', requireAuth, async (req, res) => {
  const currentUser = req.user;

  // Check role
  if (!currentUser.hasRole('admin')) {
    return res.status(403).json({ error: 'Forbidden' });
  }

  await userService.delete(req.params.id);
  res.json({ success: true });
});

// ✅ Resource-level authorization
app.put('/profiles/:id', requireAuth, async (req, res) => {
  const currentUser = req.user;
  const profileId = req.params.id;

  // Check ownership
  if (currentUser.id !== profileId && !currentUser.hasRole('admin')) {
    return res.status(403).json({ error: 'Forbidden' });
  }

  await profileService.update(profileId, req.body);
  res.json({ success: true });
});
```

### RBAC (Role-Based Access Control)

```typescript
// Define permissions
enum Permission {
  USER_READ = 'user:read',
  USER_WRITE = 'user:write',
  USER_DELETE = 'user:delete',
  POST_CREATE = 'post:create',
  POST_PUBLISH = 'post:publish'
}

// Define roles
const roles = {
  viewer: [Permission.USER_READ],
  editor: [Permission.USER_READ, Permission.POST_CREATE],
  admin: [Permission.USER_READ, Permission.USER_WRITE, Permission.USER_DELETE, Permission.POST_PUBLISH]
};

// Authorization middleware
const requirePermission = (permission: Permission) => {
  return (req, res, next) => {
    const user = req.user;

    if (!user) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const userPermissions = roles[user.role] || [];

    if (!userPermissions.includes(permission)) {
      return res.status(403).json({ error: 'Forbidden' });
    }

    next();
  };
};

// Usage
app.delete('/users/:id', requirePermission(Permission.USER_DELETE), async (req, res) => {
  await userService.delete(req.params.id);
  res.json({ success: true });
});
```

### ABAC (Attribute-Based Access Control)

```typescript
// Policy-based authorization
interface AuthContext {
  user: User;
  resource: Resource;
  action: string;
  environment: {
    time: Date;
    ipAddress: string;
  };
}

const policies = {
  canEditDocument: (ctx: AuthContext): boolean => {
    const { user, resource, environment } = ctx;

    // Owner can always edit
    if (resource.ownerId === user.id) return true;

    // Admins can edit during business hours
    if (user.role === 'admin') {
      const hour = environment.time.getHours();
      return hour >= 9 && hour < 17;
    }

    // Collaborators can edit if document is not locked
    if (resource.collaborators.includes(user.id)) {
      return !resource.isLocked;
    }

    return false;
  }
};

// Authorization middleware
const authorize = (policy: string) => {
  return async (req, res, next) => {
    const resource = await loadResource(req.params.id);

    const context: AuthContext = {
      user: req.user,
      resource,
      action: req.method,
      environment: {
        time: new Date(),
        ipAddress: req.ip
      }
    };

    if (!policies[policy](context)) {
      return res.status(403).json({ error: 'Forbidden' });
    }

    next();
  };
};

// Usage
app.put('/documents/:id', authorize('canEditDocument'), async (req, res) => {
  await documentService.update(req.params.id, req.body);
  res.json({ success: true });
});
```

## HTTPS / TLS

### Configuration

```typescript
import https from 'https';
import fs from 'fs';

// HTTPS server setup
const options = {
  key: fs.readFileSync('/path/to/private-key.pem'),
  cert: fs.readFileSync('/path/to/certificate.pem'),

  // Modern cipher suite (use Mozilla SSL Config Generator)
  ciphers: 'TLS_AES_128_GCM_SHA256:TLS_AES_256_GCM_SHA384',
  minVersion: 'TLSv1.3'
};

https.createServer(options, app).listen(443);

// Force HTTPS redirect
app.use((req, res, next) => {
  if (!req.secure && req.get('x-forwarded-proto') !== 'https') {
    return res.redirect(301, `https://${req.hostname}${req.url}`);
  }
  next();
});

// HSTS header
app.use((req, res, next) => {
  res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
  next();
});
```

### Security Headers

```typescript
import helmet from 'helmet';

// Use Helmet for security headers
app.use(helmet());

// Custom security headers
app.use((req, res, next) => {
  // Prevent MIME sniffing
  res.setHeader('X-Content-Type-Options', 'nosniff');

  // Prevent clickjacking
  res.setHeader('X-Frame-Options', 'DENY');

  // XSS protection
  res.setHeader('X-XSS-Protection', '1; mode=block');

  // Content Security Policy
  res.setHeader('Content-Security-Policy',
    "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'");

  // Referrer policy
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');

  // Permissions policy
  res.setHeader('Permissions-Policy', 'geolocation=(), microphone=(), camera=()');

  next();
});
```

## Secrets Management

### Environment Variables

```typescript
// ❌ Hardcoded secrets
const config = {
  dbPassword: 'super_secret_password', // Never do this
  apiKey: 'sk-1234567890abcdef'
};

// ✅ Environment variables
import dotenv from 'dotenv';
dotenv.config();

const config = {
  dbPassword: process.env.DB_PASSWORD,
  apiKey: process.env.API_KEY,
  sessionSecret: process.env.SESSION_SECRET
};

// Validate required secrets on startup
const requiredEnvVars = ['DB_PASSWORD', 'API_KEY', 'SESSION_SECRET'];

requiredEnvVars.forEach(varName => {
  if (!process.env[varName]) {
    throw new Error(`Missing required environment variable: ${varName}`);
  }
});
```

### Secret Generation

```bash
# Generate strong session secret
head -c32 /dev/urandom | base64

# Or using Node.js
node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"

# OpenSSL
openssl rand -base64 32
```

### .env File Security

```bash
# .gitignore
.env
.env.local
.env.*.local
*.key
*.pem
secrets/

# .env.example (commit this)
DB_PASSWORD=
API_KEY=
SESSION_SECRET=
```

### Secrets in CI/CD

```yaml
# GitHub Actions
- name: Deploy
  env:
    DB_PASSWORD: ${{ secrets.DB_PASSWORD }}
    API_KEY: ${{ secrets.API_KEY }}
  run: ./deploy.sh

# Don't echo secrets in logs
- name: Configure
  run: |
    echo "Configuring application..."
    # ❌ echo "DB_PASSWORD=$DB_PASSWORD"
    # ✅ Use secrets properly without logging
```

## Threat Modeling with STRIDE

### STRIDE Framework

**S - Spoofing Identity**
- Threat: Attacker impersonates legitimate user
- Mitigations: Strong authentication, MFA, session management

**T - Tampering**
- Threat: Malicious modification of data or code
- Mitigations: Input validation, checksums, integrity checks, HTTPS

**R - Repudiation**
- Threat: Users deny actions they performed
- Mitigations: Audit logging, non-repudiable signatures

**I - Information Disclosure**
- Threat: Unauthorized data access
- Mitigations: Encryption, access controls, secure transmission

**D - Denial of Service**
- Threat: System unavailability
- Mitigations: Rate limiting, resource quotas, load balancing

**E - Elevation of Privilege**
- Threat: Unauthorized privilege escalation
- Mitigations: Principle of least privilege, authorization checks

### Practical Application

```typescript
// Example: File upload feature threat model

// SPOOFING: Verify uploader identity
app.post('/upload', requireAuth, async (req, res) => {
  const userId = req.user.id; // Authenticated user

  // TAMPERING: Validate file type and content
  const file = req.files.upload;
  const allowedTypes = ['image/jpeg', 'image/png', 'application/pdf'];

  if (!allowedTypes.includes(file.mimetype)) {
    return res.status(400).json({ error: 'Invalid file type' });
  }

  // Scan for malware (TAMPERING)
  await virusScanner.scan(file.path);

  // INFORMATION DISCLOSURE: Store with access controls
  const fileId = await fileStore.save(file, {
    ownerId: userId,
    visibility: 'private'
  });

  // REPUDIATION: Audit log
  await auditLog.record({
    action: 'file_upload',
    userId,
    fileId,
    timestamp: new Date(),
    ipAddress: req.ip
  });

  // DENIAL OF SERVICE: Enforce size limits
  const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
  if (file.size > MAX_FILE_SIZE) {
    return res.status(413).json({ error: 'File too large' });
  }

  // ELEVATION OF PRIVILEGE: Check quotas
  const userQuota = await quotaService.getRemaining(userId);
  if (userQuota < file.size) {
    return res.status(403).json({ error: 'Quota exceeded' });
  }

  res.json({ fileId });
});
```

## Common Vulnerabilities

### Cross-Site Request Forgery (CSRF)

```typescript
// ❌ Vulnerable endpoint
app.post('/transfer-money', requireAuth, async (req, res) => {
  const { to, amount } = req.body;
  await transferMoney(req.user.id, to, amount);
  res.json({ success: true });
});
// Attacker creates: <form action="https://bank.com/transfer-money" method="POST">

// ✅ CSRF token protection
import csrf from 'csurf';

const csrfProtection = csrf({ cookie: true });

app.get('/transfer', csrfProtection, (req, res) => {
  res.render('transfer', { csrfToken: req.csrfToken() });
});

app.post('/transfer-money', csrfProtection, async (req, res) => {
  const { to, amount } = req.body;
  await transferMoney(req.user.id, to, amount);
  res.json({ success: true });
});

// ✅ SameSite cookie attribute
app.use(session({
  cookie: {
    sameSite: 'strict' // or 'lax'
  }
}));
```

### XML External Entity (XXE)

```typescript
import { parseString } from 'xml2js';

// ❌ Vulnerable XML parsing
const parseXML = (xmlString: string) => {
  return parseString(xmlString, { /* default options */ });
  // Can load external entities
};

// ✅ Disable external entities
import libxmljs from 'libxmljs';

const parseXML = (xmlString: string) => {
  return libxmljs.parseXml(xmlString, {
    noent: false,  // Don't substitute entities
    nonet: true    // Don't fetch external resources
  });
};
```

### Server-Side Request Forgery (SSRF)

```typescript
// ❌ Vulnerable URL fetch
app.post('/fetch-url', async (req, res) => {
  const { url } = req.body;
  const response = await fetch(url); // Can access internal resources
  res.json(await response.json());
});

// ✅ Whitelist allowed domains
const ALLOWED_DOMAINS = ['api.example.com', 'cdn.example.com'];

app.post('/fetch-url', async (req, res) => {
  const { url } = req.body;
  const urlObj = new URL(url);

  if (!ALLOWED_DOMAINS.includes(urlObj.hostname)) {
    return res.status(400).json({ error: 'Domain not allowed' });
  }

  // Prevent access to internal IPs
  const ip = await dns.resolve4(urlObj.hostname);
  if (isPrivateIP(ip[0])) {
    return res.status(400).json({ error: 'Internal IP not allowed' });
  }

  const response = await fetch(url);
  res.json(await response.json());
});

const isPrivateIP = (ip: string): boolean => {
  return /^(10\.|172\.(1[6-9]|2[0-9]|3[01])\.|192\.168\.)/.test(ip) ||
         ip === '127.0.0.1' ||
         ip === 'localhost';
};
```

### Path Traversal

```typescript
// ❌ Vulnerable file access
app.get('/files/:filename', (req, res) => {
  const filename = req.params.filename;
  res.sendFile(`/uploads/${filename}`);
  // Input: ../../etc/passwd
});

// ✅ Validate and sanitize path
import path from 'path';

app.get('/files/:filename', (req, res) => {
  const filename = req.params.filename;

  // Remove path traversal characters
  const safeName = path.basename(filename);

  // Build safe path
  const filePath = path.join('/uploads', safeName);

  // Verify path is within uploads directory
  const normalizedPath = path.normalize(filePath);
  if (!normalizedPath.startsWith('/uploads/')) {
    return res.status(400).json({ error: 'Invalid filename' });
  }

  res.sendFile(normalizedPath);
});
```

### Insecure Deserialization

```typescript
// ❌ Deserializing untrusted data
app.post('/data', (req, res) => {
  const obj = JSON.parse(req.body.data);
  eval(obj.code); // Remote code execution
});

// ✅ Safe deserialization
app.post('/data', (req, res) => {
  try {
    const obj = JSON.parse(req.body.data);

    // Validate structure
    const schema = z.object({
      name: z.string(),
      age: z.number()
    });

    const validated = schema.parse(obj);

    // Never execute code from user input
    // Never use eval, Function constructor, etc.

    res.json(validated);
  } catch (error) {
    res.status(400).json({ error: 'Invalid data' });
  }
});
```

## Anti-Patterns

### ❌ Security by Obscurity

```typescript
// Don't hide endpoints and call it security
app.post('/api/secret_admin_panel_xyz123/delete-user', async (req, res) => {
  // Obscure URL doesn't provide real security
});

// ✅ Proper authorization
app.post('/api/users/:id', requireAuth, requireRole('admin'), async (req, res) => {
  // Real security through authentication and authorization
});
```

### ❌ Rolling Your Own Crypto

```typescript
// ❌ Custom encryption
const encrypt = (text: string, key: string) => {
  return text.split('').map((c, i) =>
    String.fromCharCode(c.charCodeAt(0) ^ key.charCodeAt(i % key.length))
  ).join('');
};

// ✅ Use established libraries
import crypto from 'crypto';

const encrypt = (text: string, key: Buffer): string => {
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);

  let encrypted = cipher.update(text, 'utf8', 'hex');
  encrypted += cipher.final('hex');

  const authTag = cipher.getAuthTag();

  return JSON.stringify({
    iv: iv.toString('hex'),
    authTag: authTag.toString('hex'),
    encrypted
  });
};
```

### ❌ Client-Side Security

```javascript
// ❌ Client-side validation only
function deleteUser(userId) {
  if (currentUser.role !== 'admin') {
    alert('Not authorized');
    return;
  }

  fetch(`/api/users/${userId}`, { method: 'DELETE' });
  // Attacker bypasses by calling fetch directly
}

// ✅ Server enforces security
app.delete('/api/users/:id', requireRole('admin'), async (req, res) => {
  await userService.delete(req.params.id);
  res.json({ success: true });
});
```

### ❌ Storing Secrets in Code

```typescript
// ❌ Committed to version control
const config = {
  awsAccessKey: 'AKIAIOSFODNN7EXAMPLE',
  awsSecretKey: 'wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY'
};

// ✅ Environment variables
const config = {
  awsAccessKey: process.env.AWS_ACCESS_KEY_ID,
  awsSecretKey: process.env.AWS_SECRET_ACCESS_KEY
};
```

### ❌ Insufficient Logging

```typescript
// ❌ No audit trail
app.post('/users/:id/promote', async (req, res) => {
  await userService.promoteToAdmin(req.params.id);
  res.json({ success: true });
});

// ✅ Comprehensive audit logging
app.post('/users/:id/promote', requireAuth, async (req, res) => {
  await auditLog.record({
    action: 'user_promote_admin',
    actor: req.user.id,
    target: req.params.id,
    timestamp: new Date(),
    ipAddress: req.ip,
    userAgent: req.get('user-agent')
  });

  await userService.promoteToAdmin(req.params.id);
  res.json({ success: true });
});
```

## Security Checklist

### Development
- [ ] All inputs validated server-side with whitelist approach
- [ ] All outputs encoded for appropriate context
- [ ] Parameterized queries for all database access
- [ ] Passwords hashed with bcrypt/Argon2 (work factor ≥12)
- [ ] No secrets in source code or version control
- [ ] HTTPS enforced with HSTS header
- [ ] Security headers configured (CSP, X-Frame-Options, etc.)
- [ ] CSRF protection enabled for state-changing operations
- [ ] Rate limiting on authentication endpoints
- [ ] Audit logging for sensitive operations

### Authentication & Authorization
- [ ] Session IDs cryptographically random (≥128 bits)
- [ ] Sessions regenerated after login/privilege change
- [ ] Cookies marked Secure, HttpOnly, SameSite
- [ ] Inactivity timeout implemented
- [ ] Authorization enforced server-side for all endpoints
- [ ] Principle of least privilege applied
- [ ] Generic error messages (no user enumeration)
- [ ] Two-factor authentication available for sensitive operations

### Dependencies & Infrastructure
- [ ] Dependencies regularly updated (automated scanning)
- [ ] Vulnerable dependencies identified and patched
- [ ] TLS 1.3 or TLS 1.2 minimum
- [ ] Strong cipher suites configured
- [ ] Database connections encrypted
- [ ] Backup data encrypted at rest
- [ ] Security monitoring and alerting enabled

### Testing
- [ ] Automated security tests in CI/CD
- [ ] Regular penetration testing
- [ ] Dependency vulnerability scanning
- [ ] Static code analysis (SAST)
- [ ] Dynamic analysis (DAST)
- [ ] Threat modeling completed for new features

## References

- [OWASP Top 10](https://owasp.org/www-project-top-ten/)
- [OWASP Cheat Sheet Series](https://cheatsheetseries.owasp.org/)
- [Mozilla Web Security Guidelines](https://infosec.mozilla.org/guidelines/web_security)
- [Mozilla SSL Configuration Generator](https://ssl-config.mozilla.org/)
- [NIST Password Guidelines](https://pages.nist.gov/800-63-3/)
- [CWE Top 25](https://cwe.mitre.org/top25/)
