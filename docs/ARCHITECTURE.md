# Starviel Auth Service — Complete Technical Deep Dive

---

## 1. High-Level Architecture

The Auth service is a **standalone Express.js microservice** that acts as both:
- A **direct authentication provider** (email/password signup + signin)
- An **OAuth 2.0 Authorization Server** ("Continue with Starviel")
- A **Google OAuth relay** (sign in with Google)

It uses **Neon PostgreSQL** (serverless Postgres) and issues **JWT tokens** signed with HS256. Every request gets a **correlation ID** (`X-Request-Id`) for tracing across logs.

```
┌──────────────────────────────────────────────────────────────────────────┐
│  LAYERED ARCHITECTURE                                                     │
├──────────────────────────────────────────────────────────────────────────┤
│  CORRELATION ID           crypto.randomUUID() → X-Request-Id header       │
│  (server.js)              attached to every request + error responses     │
├──────────────────────────────────────────────────────────────────────────┤
│  ROUTING LAYER            auth.routes.js + oauth.routes.js                │
│  (Express Router)         rate limiting on signup (5/15min per IP)        │
├──────────────────────────────────────────────────────────────────────────┤
│  MIDDLEWARE LAYER         helmet → cors → morgan → body parser →         │
│  (Express middleware)     cookie-parser → auth.middleware (protect)       │
│                           → checks JWT jti against token blacklist        │
│                           validator.middleware (express-validator)        │
├──────────────────────────────────────────────────────────────────────────┤
│  CONTROLLER LAYER         auth.controller.js + oauth.controller.js       │
│  (Request handlers)       input sanitization, error classification,      │
│                           response formatting, status codes              │
├──────────────────────────────────────────────────────────────────────────┤
│  SERVICE LAYER                                                          │
│  auth.service.js          signUp, signIn, verifyEmail, resendVerif,      │
│                           deleteAccount, getProfile, updateProfile,      │
│                           getGoogleAuthUrl, exchangeGoogleCode,           │
│                           requestPasswordReset, resetPassword,            │
│                           generateAuthCode, exchangeAuthCode,             │
│                           generateRefreshToken, exchangeRefreshToken     │
│                                                                           │
│  oauth.service.js         registerClient, listClients, validateClient,   │
│                           validateScopes, generateAuthorizationCode,     │
│                           exchangeCode, getUserInfoFromToken,            │
│                           getAllowedOrigins                              │
│                                                                           │
│  email.service.js         sendVerificationEmail, sendWelcomeEmail,       │
│                           sendPasswordResetEmail,                         │
│                           sendAccountDeletionEmail, sendBroadcastEmail    │
│                           (all with exponential backoff retry: 1s→2s→4s) │
├──────────────────────────────────────────────────────────────────────────┤
│  UTILITY LAYER                                                           │
│  login.tracker.js         failed attempt tracking, lockout, persistence  │
│  audit.logger.js          security event logging (console + DB)          │
│  token.blacklist.js       JWT jti blacklist (in-memory Set + DB persist) │
│  security.config.js       JWT expiry, CORS, password rules, cookies      │
├──────────────────────────────────────────────────────────────────────────┤
│  DATA LAYER              PostgreSQL (Neon serverless)                    │
│  db.js                   pg Pool with SSL, reconnection retry (5 tries)  │
└──────────────────────────────────────────────────────────────────────────┘
```

---

## 2. Database Schema (8 Tables + 1 View)

### 2.1 `users` — Core Authentication

```
┌─────────────────────────────────────────────┐
│                 users                         │
├─────────────────────────────────────────────┤
│ id              UUID PRIMARY KEY             │ ← PK, auto-generated
│ email           TEXT UNIQUE NOT NULL          │ ← login identifier
│ password_hash   TEXT NOT NULL                 │ ← bcrypt $2b$12$...
│ role            VARCHAR DEFAULT 'user'        │ ← 'user' | 'admin'
│ email_verified   BOOLEAN DEFAULT FALSE        │ ← false until link clicked
│ email_verified_at TIMESTAMPTZ                 │ ← when verified
│ account_status  TEXT DEFAULT 'active'         │ ← 'active' | 'suspended' | 'deleted'
│ last_signin_at  TIMESTAMPTZ                   │ ← updated on every signin
│ created_at, updated_at TIMESTAMPTZ            │ ← managed by trigger
└─────────────────────────────────────────────┘
```

### 2.2 `user_profiles` — 1:1 Extended Profile

```
┌─────────────────────────────────────────────┐
│             user_profiles                    │
├─────────────────────────────────────────────┤
│ id              UUID PRIMARY KEY             │
│ user_id         UUID UNIQUE NOT NULL         │ ← FK → users(id) CASCADE
│ full_name       TEXT                          │ ← set by Google OAuth or profile update
│ display_name    TEXT                          │ ← public display name
│ avatar_url      TEXT                          │ ← from Google or uploaded
│ bio, date_of_birth, gender, phone_number     │
│ country, city, website_url                   │
└─────────────────────────────────────────────┘
```

Auto-created via trigger on user insert:
```sql
CREATE TRIGGER create_profile_on_user_insert
AFTER INSERT ON users FOR EACH ROW
EXECUTE FUNCTION create_user_profile();
```

### 2.3 `user_auth_tokens` — One-Time Tokens

Stores 6 token types:

| Token Type | Purpose | Expiry | Single-Use |
|------------|---------|--------|------------|
| `email_verification` | Email verification link | 24h | Yes |
| `password_reset` | Password reset link | 1h | Yes |
| `oauth_csrf` | Google OAuth CSRF state | 10min | Yes |
| `oauth_code` | Post-Google-auth one-time code | 60s | Yes |
| `refresh_token` | Long-lived refresh token (rotation) | 30 days | Yes (rotated) |
| `jwt_blacklist` | Revoked JWT `jti` values | Until JWT expires | N/A |

### 2.4 `user_oauth` — Linked OAuth Providers

Stores Google (and future GitHub/Apple) connections. Allows linking multiple providers to one account.

### 2.5 `oauth_clients` — Registered Apps

Each "Continue with Starviel" client app has:
```
client_id:          sauth_<32-char-hex>   ← public identifier
client_secret:      <64-char-hex>         ← hashed with bcrypt
redirect_uris:      TEXT[]                 ← allowed redirect URLs
scopes:             TEXT[]                 ← ['profile', 'email']
is_confidential:    BOOLEAN               ← has secret vs PKCE
```

### 2.6 `oauth_authorization_codes` — Temporary OAuth Codes

60-second expiry, single-use. Links to a specific user + client + redirect URI. Optionally stores PKCE code_challenge for public clients.

### 2.7 `audit_logs` — Security Events

Stores critical events: login failures, account lockouts, account deletions, Google OAuth failures, logout events, token refreshes. Each event has: event type, JSON data, timestamp, IP address, user ID.

### 2.8 `login_attempts` — Persistent Failed Attempts

Allows lockout tracking to survive server restarts. Each record stores count, first/last attempt time, lockout expiry, and IP.

### 2.9 `users_complete` VIEW — Unified User View

```sql
CREATE VIEW users_complete AS
SELECT u.id, u.email, u.role, u.email_verified, u.email_verified_at,
       u.account_status, u.last_signin_at, u.created_at,
       p.full_name, p.display_name, p.avatar_url, p.bio,
       p.phone_number, p.country, p.city,
       (SELECT json_agg(...) FROM user_oauth o WHERE o.user_id = u.id) as oauth_providers
FROM users u
LEFT JOIN user_profiles p ON u.id = p.user_id;
```

This is the **primary data source** returned in API responses. It intentionally excludes `password_hash`.

---

## 3. Request Lifecycle: Detailed Flow

### 3.1 Signup (`POST /api/v1/auth/signup`)

```
Request Body: { "email": "user@example.com", "password": "SecurePass123!" }

0. CORRELATION ID
   req.headers['x-request-id'] || crypto.randomUUID()
   → added as X-Request-Id response header
   → included in all error responses for debugging

0b. RATE LIMITER
   express-rate-limit checks IP-based counter
   → 5 signups max per 15 minutes per IP
   → 429 if exceeded: "Too many signup attempts."

1. EXPRESS PIPELINE
   helmet              → sets security headers
   cors                → checks origin (dev: all, prod: whitelist/DB)
   morgan('dev')       → logs: POST /api/v1/auth/signup 201
   express.json        → parses body
   express.urlencoded  → parses URL-encoded

2. VALIDATOR MIDDLEWARE (signupValidation)
   check('email').isEmail().normalizeEmail()
   check('password').isLength({min:8}).matches(/[A-Z]/).matches(/[a-z]/).matches(/[0-9]/)

3. CONTROLLER (auth.controller.js → exports.register)
   try { AuthService.signUp(email, password, frontendUrl) }
   catch(err) {
     classify error → map to user-friendly message
     auditLogger.log('SIGNUP_FAILED', {email, error, ip})
     return 400/422/429 with {error: string}
   }

4. SERVICE (auth.service.js → signUp)
   a. Check duplicate:
        SELECT id FROM users WHERE email = $1

   b. Hash password:
        bcrypt.hash(password, 12) → ~250ms, $2b$12$...

   c. Create user:
        INSERT INTO users ... RETURNING *
        → trigger auto-creates user_profiles row

   d. Generate verification token:
        INSERT INTO user_auth_tokens (token_type='email_verification',
                                       expires_at=NOW()+24h)

   e. Send email (async, fire-and-forget, retry 1s→2s→4s):
        EmailService.sendVerificationEmail(email, verificationLink)

   f. Return: { id, email, created_at }

5. RESPONSE
   → 201 { message: "User created", user_id: "uuid" }
```

### 3.2 Sign In (`POST /api/v1/auth/signin`)

```
1. ACCOUNT LOCKOUT CHECK (loginTracker.isLocked)
   • In-memory Map first → fallback to login_attempts table
   • If locked (5 fails/15min) → 429 with remainingMinutes

2. AUTHENTICATION (AuthService.signIn)
   a. Get user:
        SELECT * FROM users_complete WHERE email = $1 AND account_status = 'active'

   b. Get password hash:
        SELECT password_hash FROM users WHERE id = $1

   c. Google OAuth check:
        if password_hash === 'GOOGLE_OAUTH' → throw (must use Google)

   d. Email verification check:
        if !user.email_verified → throw "verify your email"

   e. Password verification:
        bcrypt.compare(password, password_hash)

   f. Generate JWT with jti:
        crypto.randomUUID() → jti
        jwt.sign({ sub, email, role, jti }, JWT_SECRET, { expiresIn: '1h' })

   g. Generate refresh token (30-day, stored in user_auth_tokens):
        generateRefreshToken(userId) → 64-char hex token

   h. Clear failed attempts + audit log

3. RESPONSE:
   → 200 {
        user: { id, email, full_name, ... },
        access_token: "eyJ...",
        refresh_token: "<64-char-hex>"
      }
```

### 3.3 Token Refresh (`POST /api/v1/auth/refresh`)

```
Request Body: { "refresh_token": "<64-char-hex>" }

1. Validate refresh token:
     SELECT * FROM user_auth_tokens
     WHERE token = $1 AND token_type = 'refresh_token'
     AND used_at IS NULL AND expires_at > NOW()

   → 401 if missing, expired, or already used

2. Mark old token as used:
     UPDATE user_auth_tokens SET used_at = NOW() WHERE id = $1
     (refresh token rotation — old token cannot be reused)

3. Issue new tokens:
   a. New JWT with fresh jti (1h expiry)
   b. New refresh token stored in DB (30-day)
   c. Return both

4. RESPONSE:
   → 200 { user, access_token, refresh_token }
```

### 3.4 Logout (`POST /api/v1/auth/logout`)

```
Headers: Authorization: Bearer <access_token>

1. Extract jti from req.user (attached by protect middleware)
2. tokenBlacklist.add(jti, expiresAt):
   a. Add jti to in-memory Set (O(1) lookup)
   b. INSERT INTO user_auth_tokens (token_type='jwt_blacklist', expires_at)

3. Audit: LOGOUT event

4. RESPONSE:
   → 200 { success: true, message: "Logged out successfully" }

SUBSEQUENT REQUESTS with same token:
   protect middleware decodes JWT → checks tokenBlacklist.isBlacklisted(jti)
   → blacklisted → 401 "Token has been revoked"
```

### 3.5 Google OAuth Flow (GET /api/v1/auth/google → callback)

```
Step A: INITIATION
  1. Build origin from request (protocol + host)
  2. AuthService.getGoogleAuthUrl(origin, frontendUrl):
     a. Generate CSRF token, encode state as base64 JSON
     b. Store CSRF: INSERT (token_type='oauth_csrf', 10min expiry)
     c. Build Google URL with state parameter
  3. Redirect to Google (302)

Step B: CALLBACK
  1. Extract code + state from query
  2. Validate state CSRF (decode → verify in DB → mark used)
  3. Exchange code for Google tokens (POST to Google API)
  4. Get user info from Google
  5. Find or create user in users + user_oauth tables
  6. Generate JWT with jti + refresh token (same as signin)
  7. Set cookies + generate one-time auth code
  8. Redirect to frontend with code
```

### 3.6 OAuth 2.0 Provider Flow ("Continue with Starviel")

```
PHASE 1: APP REGISTRATION
  POST /api/v1/auth/developer/apps → client_id + client_secret

PHASE 2: AUTHORIZATION REQUEST
  GET /oauth/authorize?client_id=...&redirect_uri=...&response_type=code
  → Validate client → render consent page
  → User enters email/password + approves

PHASE 3: TOKEN EXCHANGE
  POST /oauth/token { code, client_id, client_secret }
  → Validate code (not expired, not used)
  → Verify client_secret (bcrypt) or PKCE code_verifier
  → Mark code as used
  → Build JWT: { sub, iss: 's-auth', aud: clientId, scopes, email, name }
  → Return: { access_token, token_type, expires_in, scope }

PHASE 4: USER INFO
  GET /oauth/userinfo (Authorization: Bearer <token>)
  → Verify iss === 's-auth'
  → Return based on scopes: { sub, email?, name?, picture? }
```

---

## 4. Token Blacklist System

```
┌──────────────────────────────────────────────────────────────────────┐
│  TOKEN BLACKLIST (token.blacklist.js)                                 │
├──────────────────────────────────────────────────────────────────────┤
│                                                                        │
│  On Server Startup:                                                    │
│    SELECT token FROM user_auth_tokens                                  │
│    WHERE token_type = 'jwt_blacklist' AND expires_at > NOW()          │
│    → Loads all active blacklisted jti values into in-memory Set        │
│                                                                        │
│  On Logout:                                                            │
│    1. jti added to in-memory Set (immediate)                          │
│    2. Persisted to DB (survives restart)                              │
│                                                                        │
│  On Every Protected Request (protect middleware):                      │
│    1. JWT decoded → jti extracted                                      │
│    2. Check: tokenBlacklist.isBlacklisted(jti)                        │
│    3. If blacklisted → 401 "Token revoked"                            │
│                                                                        │
│  Memory: O(n) where n = active blacklisted tokens                    │
│  Lookup: O(1)                                                         │
│  Persistence: user_auth_tokens table with token_type='jwt_blacklist'  │
└──────────────────────────────────────────────────────────────────────┘
```

---

## 5. Refresh Token Rotation

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  REFRESH TOKEN LIFECYCLE
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  Issue:                    On signin or token refresh
                            INSERT INTO user_auth_tokens
                            (token_type='refresh_token', expires_at=NOW()+30d)

  Use:                      POST /auth/refresh { refresh_token }
                            → Mark old token used_at = NOW()
                            → Issue new JWT + new refresh token
                            (old refresh token cannot be reused)

  Expiry:                   user_auth_tokens.expires_at (30 days)

  Security benefit:
    If a refresh token is stolen, the attacker uses it →
    the legitimate user's next use of the old token fails
    (it's been rotated) → signals token theft →
    both tokens invalidated, user must re-authenticate
```

---

## 6. Rate Limiting

```
┌──────────────────────────────────────────────────────────────────────┐
│  RATE LIMITING (express-rate-limit)                                   │
├──────────────────────────────────────────────────────────────────────┤
│                                                                        │
│  Endpoint:    POST /api/v1/auth/signup                                │
│  Window:      15 minutes                                               │
│  Max:         5 attempts per IP                                       │
│  Response:    429 { error: "Too many signup attempts..." }            │
│  Storage:     In-memory (default memory store)                        │
│  Key:         req.ip || req.connection.remoteAddress                   │
│                                                                        │
│  Rationale:                                                            │
│  • Prevents email flooding via automated signup bots                  │
│  • Prevents abuse of Brevo email API (spending quota)                 │
│  • 5/15min is generous enough for legitimate users                    │
│  • IP-based key may block shared NAT users → intentional tradeoff    │
└──────────────────────────────────────────────────────────────────────┘
```

---

## 7. Database Connection Resilience

```
STARTUP RETRY LOOP (server.js)

  for i = 0; i < 5; i++:
    try:
      await db.query('SELECT NOW()')
      await securityConfig.refreshCorsOrigins()
      await tokenBlacklist.init()
      app.listen(PORT)
      return
    catch error:
      if i == 4: process.exit(1)
      wait min(1000 * 2^i, 10000) ms
      → 1s, 2s, 4s, 8s, 10s between retries

  Why: In ephemeral environments (K8s, serverless),
  the DB may not be immediately ready when the
  app process starts. Retries avoid crash loops.
```

---

## 8. Correlation ID

```
SERVER MIDDLEWARE (server.js)

  app.use((req, res, next) => {
    req.correlationId = req.headers['x-request-id']
                      || crypto.randomUUID()
    res.setHeader('X-Request-Id', req.correlationId)
    next()
  })

  Error responses include:
    { error: "...", correlationId: "uuid" }

  Console logs include:
    [<correlationId>] ERROR: ...

  Why: Enables tracing a single request across
  log lines, even under high concurrency.
```

---

## 9. JWT Token Structure

### Direct Login JWT (from `auth.service.js` signIn)

```json
HEADER:  { "alg": "HS256", "typ": "JWT" }
PAYLOAD: {
  "sub": "550e8400-e29b-41d4-a716-446655440000",
  "email": "user@example.com",
  "role": "user",
  "jti": "a1b2c3d4-...",               ← unique token ID for blacklist
  "iat": 1700000000,
  "exp": 1700003600
}
```

### OAuth JWT (from `oauth.service.js` exchangeCode)

```json
PAYLOAD: {
  "sub": "550e8400-...",
  "iss": "starviel",
  "aud": "sauth_a3a6fc028c0ab7a200f4fedaac189eb9",
  "scopes": ["profile", "email"],
  "email": "user@example.com",
  "name": "User Name",
  "picture": "https://...",
  "iat": 1700000000,
  "exp": 1700003600
}
```

---

## 10. Request Routing Summary

```
Path                                 Method  Auth      Handler
───                                 ──────  ────      ───────
/api/v1/auth/signup                 POST    Rate(5)   authController.register
/api/v1/auth/signin                 POST    None      authController.login
/api/v1/auth/refresh                POST    None      authController.refreshToken
/api/v1/auth/logout                 POST    JWT       authController.logout
/api/v1/auth/verify-email           GET     None      authController.verifyEmail
/api/v1/auth/resend-verification    POST    None      authController.resendVerification
/api/v1/auth/google                 GET     None      authController.googleAuth
/api/v1/auth/google/callback        GET     None      authController.googleCallback
/api/v1/auth/exchange-code          POST    None      authController.exchangeCode
/api/v1/auth/complete-verification   POST    JWT       authController.completeVerification
/api/v1/auth/profile                GET     JWT       authController.getProfile
/api/v1/auth/profile                PUT     JWT       authController.updateProfile
/api/v1/auth/delete-account         DELETE  JWT       authController.removeAccount
/api/v1/auth/admin/users            GET     Admin     authController.getAllUsers
/api/v1/auth/admin/refresh-cors     POST    Admin     authController.refreshCors
/api/v1/auth/developer/apps         POST    JWT       authController.devRegisterApp
/api/v1/auth/developer/apps         GET     JWT       authController.devListApps
/api/v1/auth/developer/apps/:id     DELETE  JWT       authController.devDeleteApp
/oauth/authorize                    GET     None      oauthController.authorize
/oauth/authorize                    POST    None      oauthController.authorizeSubmit
/oauth/token                        POST    None      oauthController.token
/oauth/userinfo                     GET     Bearer    oauthController.userinfo
/                                   GET     None      Serves public/index.html (landing page)
/console                            GET     None      Serves public/console/index.html (React SPA)
/dashboard                          GET     None      Serves public/dashboard.html (user dashboard)

Static files served:
  /api-tester.html                  GET     None      API testing tool
  /logo.png                         GET     None      S-Auth logo
  /console/assets/*                 GET     None      Console SPA bundles

New endpoints added:
  POST /auth/refresh   → Exchange refresh token for new JWT + rotated refresh token
  POST /auth/logout    → Blacklist current JWT's jti (requires valid JWT)
  GET /dashboard       → Unified user dashboard (login, profile, apps, security)
```

---

## 11. Performance Characteristics

| Operation | Typical Latency | DB Queries | External Calls |
|-----------|----------------|------------|----------------|
| signup | 300-500ms | 3 | 1 (Brevo email) |
| signin | 200-400ms | 3-4 | 0 |
| refresh token | 100-200ms | 3 | 0 |
| logout | 10-30ms | 1 | 0 |
| Google OAuth init | 50ms | 1 | 0 |
| Google OAuth callback | 600-1200ms | 5-7 | 2 (Google) |
| OAuth authorize (GET) | 50ms | 1 | 0 |
| OAuth authorize (POST) | 300-500ms | 4 | 0 |
| OAuth token exchange | 100-200ms | 3-4 | 0 |
| OAuth userinfo | 20ms | 0 (JWT decode only) | 0 |

**JWT verify (protect middleware):** <1ms (pure CPU, no DB) + ~0.01ms blacklist Set lookup

---

## 12. Security Layers Summary

| Layer | Mechanism | Protection |
|-------|-----------|------------|
| 1 | bcrypt (cost 12) | Password brute force |
| 2 | Account lockout (5 attempts/15min) | Online brute force |
| 3 | Rate limiting (5 signups/15min/IP) | Signup abuse, email flooding |
| 4 | Email verification | Email ownership proof |
| 5 | JWT HS256 + 1h expiry + `jti` | Token forgery, replay, revocation |
| 6 | Refresh token rotation (30-day) | Token theft detection |
| 7 | JWT blacklist (in-memory + DB) | Immediate token revocation on logout |
| 8 | OAuth authorization code (60s, single-use) | Authorization code interception |
| 9 | PKCE (SHA256 code_verifier) | Code interception (public clients) |
| 10 | CSRF state parameter (10min) | OAuth CSRF attack |
| 11 | Open redirect validation | URL-based attacks |
| 12 | Dynamic CORS origins (env + DB) | Cross-origin API access |
| 13 | Helmet security headers | XSS, clickjacking, MIME sniffing |
| 14 | httpOnly + secure + sameSite cookies | XSS + CSRF |
| 15 | Audit logging (console + DB) | Security incident reconstruction |
| 16 | Input validation (express-validator) | SQL injection, XSS |
| 17 | Correlation ID (X-Request-Id) | Request tracing across logs |
| 18 | Password strength on reset | Weak password prevention |
