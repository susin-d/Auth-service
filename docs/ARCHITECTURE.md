# Starviel Auth Service — Complete Technical Deep Dive

---

## 1. High-Level Architecture

The Auth service is a **standalone Express.js microservice** that acts as both:
- A **direct authentication provider** (email/password signup + signin)
- An **OAuth 2.0 Authorization Server** ("Continue with Starviel")
- A **Google OAuth relay** (sign in with Google)

It uses **Neon PostgreSQL** (serverless Postgres) and issues **JWT tokens** signed with HS256.

```
┌──────────────────────────────────────────────────────────────────────────┐
│  LAYERED ARCHITECTURE                                                     │
├──────────────────────────────────────────────────────────────────────────┤
│  ROUTING LAYER              auth.routes.js + oauth.routes.js              │
│  (Express Router)           request routing, param extraction            │
├──────────────────────────────────────────────────────────────────────────┤
│  MIDDLEWARE LAYER           helmet → cors → morgan → body parser →       │
│  (Express middleware)       cookie-parser → auth.middleware (protect)    │
│                             validator.middleware (express-validator)     │
├──────────────────────────────────────────────────────────────────────────┤
│  CONTROLLER LAYER           auth.controller.js + oauth.controller.js     │
│  (Request handlers)         input sanitization, error classification,    │
│                             response formatting, status codes            │
├──────────────────────────────────────────────────────────────────────────┤
│  SERVICE LAYER                                                        │
│  auth.service.js            signUp, signIn, verifyEmail, resendVerif,   │
│                             deleteAccount, getProfile, updateProfile,    │
│                             getGoogleAuthUrl, exchangeGoogleCode,         │
│                             requestPasswordReset, resetPassword           │
│                             generateAuthCode, exchangeAuthCode           │
│                                                                           │
│  oauth.service.js           registerClient, listClients, validateClient, │
│                             validateScopes, generateAuthorizationCode,   │
│                             exchangeCode, getUserInfoFromToken,          │
│                             getAllowedOrigins                            │
│                                                                           │
│  email.service.js           sendVerificationEmail, sendWelcomeEmail,     │
│                             sendAccountDeletionEmail, sendBroadcastEmail │
├──────────────────────────────────────────────────────────────────────────┤
│  UTILITY LAYER                                                           │
│  login.tracker.js           failed attempt tracking, lockout, persistence│
│  audit.logger.js            security event logging (console + DB)        │
│  security.config.js         JWT expiry, CORS, password rules, cookies    │
├──────────────────────────────────────────────────────────────────────────┤
│  DATA LAYER                PostgreSQL (Neon serverless)                  │
│  db.js                     pg Pool with SSL, connection management       │
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

Stores 4 token types:
- `email_verification` — 24h expiry, used when user clicks verify link
- `password_reset` — 1h expiry, used for password reset
- `oauth_csrf` — 10min expiry, used for Google OAuth state validation
- `oauth_code` — 60s expiry, one-time code after Google callback

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

Stores critical events: login failures, account lockouts, account deletions, Google OAuth failures. Each event has: event type, JSON data, timestamp, IP address, user ID.

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

1. EXPRESS PIPELINE
   helmet              → sets security headers
   cors                → checks origin (dev: all, prod: whitelist/DB)
   morgan('dev')       → logs: POST /api/v1/auth/signup 201
   express.json        → parses body
   express.urlencoded  → parses URL-encoded (for form submissions)

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
        → if exists, throw "already registered" (422)

   b. Hash password:
        bcrypt.hash(password, 12) → ~250ms, $2b$12$...

   c. Create user:
        INSERT INTO users (email, password_hash, email_verified, account_status)
        VALUES ($1, $2, false, 'active') RETURNING *
        → trigger auto-creates user_profiles row

   d. Generate verification token:
        crypto.randomBytes(32).toString('hex') → 64-char hex
        INSERT INTO user_auth_tokens (user_id, token_type='email_verification',
                                      token, expires_at=NOW()+24h)

   e. Send email (async, fire-and-forget):
        EmailService.sendVerificationEmail(email, verificationLink)
        → Brevo API: POST https://api.brevo.com/v3/smtp/email

   f. Return:
        { id: newUser.id, email: newUser.email, created_at }

5. RESPONSE FORMATTING (controller)
   → 201 { message: "User created", user_id: "uuid" }
   (or error with appropriate 4xx status)
```

### 3.2 Sign In (`POST /api/v1/auth/signin`)

```
1. ACCOUNT LOCKOUT CHECK (loginTracker.isLocked)
   • Check in-memory Map first (fast path)
   • If not in memory, check login_attempts table
   • If locked (5+ attempts in 15min): return { locked: true, remainingMinutes }
   → 429 "Account temporarily locked"

2. AUTHENTICATION (AuthService.signIn)
   a. Get user:
        SELECT * FROM users_complete WHERE email = $1 AND account_status = 'active'

   b. Get password hash:
        SELECT password_hash FROM users WHERE id = $1

   c. Google OAuth check:
        if password_hash === 'GOOGLE_OAUTH' → throw (must use Google sign-in)

   d. Email verification check:
        if !user.email_verified → throw "verify your email"

   e. Password verification:
        bcrypt.compare(password, password_hash)
        → false → throw "Invalid email or password"
               → controller records failed attempt,
                 checks if lockout threshold hit,
                 returns 401 or 429

   f. Update last_signin_at

   g. Generate JWT:
        jwt.sign(
          { sub: user.id, email: user.email, role: user.role || 'user' },
          process.env.JWT_SECRET,
          { expiresIn: '1h' }
        )

   h. Clear failed attempts:
        loginTracker.clearAttempts(email)
        → deletes from memory + login_attempts table

   i. Audit:
        auditLogger.logSuccessfulAuth(user.id, email, 'password', ip)

3. RESPONSE:
   → 200 { user: { id, email, full_name, ... }, access_token: "eyJ..." }
```

### 3.3 Google OAuth Flow (GET /api/v1/auth/google → callback)

```
Step A: INITIATION (googleAuth controller)
  1. Build origin from request (protocol + host)
  2. AuthService.getGoogleAuthUrl(origin, frontendUrl):
     a. Generate CSRF token: crypto.randomBytes(16).toString('hex')
     b. Encode state: base64(JSON.stringify({csrf, redirect: frontendUrl}))
     c. Store CSRF: INSERT INTO user_auth_tokens (token_type='oauth_csrf', 10min expiry)
     d. Build Google URL:
        https://accounts.google.com/o/oauth2/v2/auth
          ?client_id=...
          &redirect_uri={origin}/api/v1/auth/google/callback
          &response_type=code
          &scope=email%20profile%20openid
          &access_type=offline
          &prompt=consent
          &state={encoded_state}
  3. Redirect user to Google consent screen (302)

Step B: CALLBACK (googleCallback controller)
  1. Extract code + state from query params
  2. Validate state CSRF:
     a. Decode base64 → JSON.parse → extract csrf + redirect
     b. Query user_auth_tokens for CSRF token (not expired, not used)
     c. Mark token used (single-use)
  3. Exchange Google code for tokens:
     POST https://oauth2.googleapis.com/token
       { code, client_id, client_secret, redirect_uri, grant_type: 'authorization_code' }
     → { access_token, refresh_token, id_token, expires_in }
  4. Get Google user info:
     GET https://www.googleapis.com/oauth2/v2/userinfo
       Authorization: Bearer {access_token}
     → { email, id: googleId, name, picture }
  5. Find or create user:
     a. Check if email exists in users
     b. If YES: update user_oauth connection + profile (if empty fields)
     c. If NO: create user with password_hash='GOOGLE_OAUTH', email_verified=true
               create user_oauth record, update profile, send welcome email
  6. Generate service JWT:
     jwt.sign({ sub: userId, email, role }, JWT_SECRET, { expiresIn: '1h' })
  7. Set cookies (auth-token, refresh-token)
  8. Generate one-time auth code:
     AuthService.generateAuthCode(userId) → 64-char hex, 60s expiry
  9. Redirect to frontend with code:
     302 → {frontendUrl}/login?code={authCode}
```

### 3.4 OAuth 2.0 Provider Flow ("Continue with Starviel")

This is the **third-party auth flow** — where an external app uses the Auth service as an identity provider.

```
PHASE 1: APP REGISTRATION
  Developer registers app via:
    POST /api/v1/auth/developer/apps
    { client_name, redirect_uris, scopes, is_confidential }
  → Returns client_id (sauth_...) + client_secret (shown once)
  → client_secret stored as bcrypt hash

PHASE 2: AUTHORIZATION REQUEST
  User clicks "Continue with Starviel" on third-party app:
    GET {auth-service}/oauth/authorize
      ?client_id=sauth_...
      &redirect_uri=https://app.com/callback
      &response_type=code
      &scope=profile%20email
      &state=random-csrf-token
      &code_challenge=SHA256(verifier)     ← PKCE (optional)
      &code_challenge_method=S256

  Server:
    1. Validate client_id is active
    2. Validate redirect_uri is in client's registered list
    3. Validate scopes against client's allowed scopes
    4. Render consent page (server-side HTML):
       - Client name + logo
       - Scope descriptions (Profile, Email)
       - Login form (email + password)
       - Approve/Deny buttons

PHASE 3: USER CONSENT
  User enters email/password and clicks "Approve":
    POST /oauth/authorize
      { email, password, client_id, redirect_uri, scopes,
        state, code_challenge, code_challenge_method, action: 'approve' }

  Server:
    1. If action='deny' → redirect with error=access_denied
    2. Validate client again
    3. AuthService.signIn(email, password) → authenticate user
    4. Generate authorization code:
       OAuthService.generateAuthorizationCode(userId, clientId, redirectUri,
                                              scopes, codeChallenge, method, state)
       → INSERT INTO oauth_authorization_codes
          (code=64-char-hex, 60s expiry, single-use)
    5. Audit: OAUTH_CODE_ISSUED
    6. Redirect back to client:
       302 → {redirect_uri}?code={authCode}&state={state}

PHASE 4: TOKEN EXCHANGE
  Third-party app's backend:
    POST {auth-service}/oauth/token
      { grant_type: 'authorization_code', code, client_id,
        client_secret, redirect_uri }
    (or with code_verifier instead of client_secret for PKCE)

  Server (OAuthService.exchangeCode):
    1. Find authorization code (not expired, not used)
    2. Verify client_id matches
    3. Verify credentials:
       a. client_secret present → bcrypt.compare against stored hash
       b. code_verifier present → SHA256(verifier) === code_challenge
       c. neither → error
    4. Mark code as used (one-time use)
    5. Get user from users_complete view
    6. Build JWT payload:
       { sub: user.id, iss: 's-auth', aud: clientId,
         scopes: [...scope names...],
         email: (if email scope granted),
         name: (if profile scope granted),
         picture: (if profile scope granted) }
    7. Sign JWT with JWT_SECRET (1h expiry)
    8. Return:
       { access_token: "eyJ...", token_type: "Bearer",
         expires_in: 3600, scope: "profile email" }

PHASE 5: USER INFO (for the third-party app)
    GET {auth-service}/oauth/userinfo
      Authorization: Bearer {access_token}

    Server:
    1. Verify Bearer token
    2. jwt.verify(token, JWT_SECRET)
    3. Check iss === 's-auth' (must be OAuth-issued token, not direct login)
    4. Return based on scopes:
       { sub: user-id }
       + { email } if 'email' scope
       + { name, picture } if 'profile' scope
```

---

## 4. Security Architecture

### 4.1 Password Hashing

```
Raw Password: "SecurePass123!"
     │
     ▼
bcrypt.hash(password, 12)
     │
     ├─ Generates unique salt: $2b$12$Wn0Gc5Y0zX8Qf3M2p1Ht.O
     │  (22 chars of base64 = 128 bits of salt)
     ├─ Blowfish cipher: 2^12 = 4096 iterations
     │  (cost factor 12 → ~250ms on modern CPU)
     └─ Output: $2b$12$Wn0Gc5Y0zX8Qf3M2p1Ht.O3H7Gd9jK2m5L8qR4sT1vX6yZ0A3B4C5D
```

**Why bcrypt:**
- SHA-256 is ASIC-friendly (billions of hashes/sec on GPU)
- bcrypt uses expensive key setup phase (Blowfish) — resists GPU/ASIC
- argon2 is stronger but requires careful parameter tuning
- bcrypt is simpler, widely audited, ~250ms/hash acceptable for auth

### 4.2 Account Lockout System

```
┌──────────────────────────────────────────────────────────────────────┐
│  LOGIN TRACKER STATE MACHINE                                          │
├──────────────────────────────────────────────────────────────────────┤
│                                                                        │
│  Normal State                    Locked State                          │
│  ┌──────────────┐               ┌──────────────┐                     │
│  │ count: 0      │  5 failures  │ count: 5      │                     │
│  │ lockedUntil:  │─────────────►│ lockedUntil:  │                     │
│  │ null          │  in 15 min   │ now + 15min   │                     │
│  └──────┬───────┘               └──────┬───────┘                     │
│         │                              │                              │
│         │ successful login             │ 15 min passes                │
│         │ clears counter               │ or 1 hour since last attempt │
│         ▼                              ▼                              │
│  ┌──────────────┐               ┌──────────────┐                     │
│  │ count: 0      │              │ count: 0      │                     │
│  │ lockedUntil:  │◄─────────────│ lockedUntil:  │                     │
│  │ null          │   reset       │ null          │                     │
│  └──────────────┘               └──────────────┘                     │
│                                                                        │
│  Dual persistence:                                                     │
│  • In-memory Map (fast reads, survives per-instance)                   │
│  • login_attempts table (survives restarts, shared across instances)   │
└──────────────────────────────────────────────────────────────────────┘
```

### 4.3 CORS Dynamic Whitelist

```
Tier 1 (env var fallback):  CORS_WHITELIST env var
Tier 2 (dynamic, DB):       Extracted from all active oauth_clients redirect_uris

Merged at startup + on-demand via POST /admin/refresh-cors

Origin extraction from redirect_uri:
  "https://myapp.com/auth/callback"  →  "https://myapp.com"
  "http://localhost:5173/callback"   →  "http://localhost:5173"

Dev mode: all origins allowed (NODE_ENV=development)
Prod mode: must match one of the merged origins
```

---

## 5. JWT Token Structure

### Direct Login JWT (from `auth.service.js` signIn)

```json
HEADER:  { "alg": "HS256", "typ": "JWT" }
PAYLOAD: {
  "sub": "550e8400-e29b-41d4-a716-446655440000",
  "email": "user@example.com",
  "role": "user",
  "iat": 1700000000,
  "exp": 1700003600
}
```

### OAuth JWT (from `oauth.service.js` exchangeCode)

```json
PAYLOAD: {
  "sub": "550e8400-...",
  "iss": "s-auth",
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

## 6. Request Routing Summary

```
Path                                Method  Auth   Handler
───                                ──────  ────   ───────
/api/v1/auth/signup                POST    None   authController.register
/api/v1/auth/signin                POST    None   authController.login
/api/v1/auth/verify-email          GET     None   authController.verifyEmail
/api/v1/auth/resend-verification   POST    None   authController.resendVerification
/api/v1/auth/google                GET     None   authController.googleAuth
/api/v1/auth/google/callback       GET     None   authController.googleCallback
/api/v1/auth/exchange-code         POST    None   authController.exchangeCode
/api/v1/auth/complete-verification  POST    JWT    authController.completeVerification
/api/v1/auth/profile               GET     JWT    authController.getProfile
/api/v1/auth/profile               PUT     JWT    authController.updateProfile
/api/v1/auth/delete-account        DELETE  JWT    authController.removeAccount
/api/v1/auth/admin/users           GET     Admin  authController.getAllUsers
/api/v1/auth/admin/refresh-cors    POST    Admin  authController.refreshCors
/api/v1/auth/developer/apps        POST    JWT    authController.devRegisterApp
/api/v1/auth/developer/apps        GET     JWT    authController.devListApps
/api/v1/auth/developer/apps/:id    DELETE  JWT    authController.devDeleteApp
/oauth/authorize                   GET     None   oauthController.authorize
/oauth/authorize                   POST    None   oauthController.authorizeSubmit
/oauth/token                       POST    None   oauthController.token
/oauth/userinfo                    GET     Bearer oauthController.userinfo
```

---

## 7. Performance Characteristics

| Operation | Typical Latency | DB Queries | External Calls |
|-----------|----------------|------------|----------------|
| signup | 300-500ms | 3 | 1 (Brevo email) |
| signin | 200-400ms | 2-3 | 0 |
| Google OAuth init | 50ms | 1 | 0 |
| Google OAuth callback | 600-1200ms | 4-6 | 2 (Google) |
| OAuth authorize (GET) | 50ms | 1 | 0 |
| OAuth authorize (POST) | 300-500ms | 4 | 0 |
| OAuth token exchange | 100-200ms | 3-4 | 0 |
| OAuth userinfo | 20ms | 0 (JWT decode only) | 0 |

**JWT verify (protect middleware):** <1ms (pure CPU, no DB)

---

## 8. Security Layers Summary

| Layer | Mechanism | Protection |
|-------|-----------|------------|
| 1 | bcrypt (cost 12) | Password brute force |
| 2 | Account lockout (5 attempts/15min) | Online brute force |
| 3 | Email verification | Email ownership proof |
| 4 | JWT HS256 + 1h expiry | Token forgery + replay |
| 5 | OAuth authorization code (60s, single-use) | Authorization code interception |
| 6 | PKCE (SHA256 code_verifier) | Authorization code interception (public clients) |
| 7 | CSRF state parameter (10min) | OAuth CSRF attack |
| 8 | Open redirect validation | URL-based attacks |
| 9 | CORS whitelist | Cross-origin API access |
| 10 | Helmet security headers | XSS, clickjacking, MIME sniffing |
| 11 | httpOnly + secure + sameSite cookies | XSS + CSRF |
| 12 | Audit logging | Security incident reconstruction |
| 13 | Input validation (express-validator) | SQL injection, XSS |
