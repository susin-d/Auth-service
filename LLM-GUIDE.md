# LLM Integration Guide: S-Auth v1.1.0

**Purpose:** Reference document for AI assistants integrating S-Auth into any frontend or backend project.  
**Last Updated:** May 1, 2026  
**Stack:** Node.js · Express 5 · Neon PostgreSQL · JWT · Google OAuth 2.0 · Brevo Email

---

## 1. What S-Auth Provides

S-Auth is a standalone authentication microservice. It handles **user registration, login, OAuth, email verification, profile management, and admin user management**. Your project talks to it over HTTP — you do NOT import its code.

```
┌──────────────────┐         HTTP/JSON          ┌──────────────────┐
│  Your Frontend   │  ◄────────────────────►   │     S-Auth       │
│  (React, Vue,    │    Bearer tokens,          │  POST :3000/api  │
│   Mobile, etc.)  │    cookies                 │                  │
└──────────────────┘                            └────────┬─────────┘
                                                         │
┌──────────────────┐         HTTP/JSON                   │
│  Your Backend    │  ◄──────────────────────────────────┘
│  (FastAPI, Go,   │    JWT verification
│   Rails, etc.)   │    (validate with same JWT_SECRET)
└──────────────────┘
```

### What It Handles (You Don't Need To Build)
- User signup with email/password (bcrypt, 12 rounds)
- Email verification (Brevo transactional emails)
- Login with brute-force protection (5 attempts → 15-min lockout)
- Google OAuth 2.0 (complete server-side flow)
- JWT access tokens (1-hour expiry)
- User profile CRUD
- Admin user management (list, view, update, delete users)
- Broadcast emails to all users
- Audit logging of all security events

### What You Still Need To Build
- Refresh token rotation (not yet implemented)
- Password reset UI (backend methods exist, no routes exposed yet)
- Rate limiting (recommended: add `express-rate-limit`)
- Your application's business logic

---

## 2. Quick Setup

### Prerequisites
- Node.js 18+
- Neon PostgreSQL database
- Google OAuth credentials (Google Cloud Console)
- Brevo API key (for transactional emails)

### Install & Run
```bash
git clone <repo-url> auth-service
cd auth-service
npm install

# Configure environment
cp .env.example .env
# Edit .env with your credentials (see Section 10)

# Run database migrations in Neon SQL editor (in order):
# 1. migrations/001_security_tables.sql
# 2. migrations/004_relational_users_tables.sql
# 3. migrations/005_audit_and_login_tables.sql
# 4. migrations/006_add_user_roles.sql
# 5. migrations/007_add_oauth_token_types.sql

# Start
npm start   # Runs on port 3000
```

### Verify It Works
```bash
curl http://localhost:3000/health
# → {"status":"UP","service":"auth-service"}
```

---

## 3. Complete API Reference

**Base URL:** `http://localhost:3000/api/v1/auth`

### Public Endpoints (No Auth Required)

#### POST `/signup`
Create a new user account. Sends verification email automatically.

```json
// Request
{
  "email": "user@example.com",
  "password": "SecurePass123!",
  "frontendUrl": "https://yourapp.com"  // optional, must be HTTPS
}

// Response 201
{
  "message": "User created",
  "user_id": "uuid-here"
}
```

**Password rules:** min 8 chars, 1 uppercase, 1 lowercase, 1 number.

---

#### POST `/signin`
Authenticate with email and password. Returns JWT access token.

```json
// Request
{
  "email": "user@example.com",
  "password": "SecurePass123!"
}

// Response 200
{
  "user": {
    "id": "uuid",
    "email": "user@example.com",
    "email_verified": true,
    "role": "user",
    "full_name": "John Doe",
    "avatar_url": null,
    "created_at": "2026-05-01T..."
  },
  "access_token": "eyJhbG..."
}

// Error 401 (wrong password)
{ "error": "Invalid email or password" }

// Error 401 (Google-only account)
{ "error": "This account uses Google Sign-In. Please sign in with Google instead." }

// Error 429 (locked out)
{ "error": "Account temporarily locked", "remainingMinutes": 12 }
```

---

#### GET `/google?frontend_url=https://yourapp.com`
Initiates Google OAuth flow. Redirects the browser to Google.

```javascript
// Frontend: redirect the browser to this URL
window.location.href = 'http://localhost:3000/api/v1/auth/google?frontend_url=https://yourapp.com';
```

**Flow:**
1. Browser → S-Auth `/google` endpoint
2. S-Auth → Google consent screen (with CSRF state token)
3. Google → S-Auth `/google/callback` (with auth code)
4. S-Auth → validates CSRF, exchanges code, creates/updates user
5. S-Auth → sets `auth-token` cookie + redirects to `frontend_url?code=<one-time-code>`
6. Frontend → exchanges code via `POST /exchange-code`

---

#### POST `/exchange-code`
Exchange the one-time code from OAuth redirect for a JWT access token.

```json
// Request
{
  "code": "abc123..."  // from ?code= query parameter after OAuth redirect
}

// Response 200
{
  "success": true,
  "user": { "id": "uuid", "email": "user@gmail.com", ... },
  "access_token": "eyJhbG..."
}
```

**Important:** The code expires in 60 seconds and can only be used once.

---

#### GET `/verify-email?token=<token>`
User clicks this link from their email. Returns an HTML page (not JSON).

---

#### POST `/resend-verification`
Resend the verification email.

```json
// Request
{ "email": "user@example.com" }

// Response 200
{ "message": "Verification link has been sent to your email." }
```

---

### Protected Endpoints (Require `Authorization: Bearer <token>`)

#### GET `/profile`
Get the authenticated user's complete profile.

```json
// Response 200
{
  "id": "uuid",
  "email": "user@example.com",
  "email_verified": true,
  "role": "user",
  "full_name": "John Doe",
  "display_name": "johnd",
  "avatar_url": "https://...",
  "bio": "Hello world",
  "date_of_birth": "1990-01-15",
  "gender": "male",
  "phone_number": "+1234567890",
  "country": "US",
  "city": "New York",
  "website_url": "https://johndoe.com",
  "oauth_providers": [{"provider": "google", ...}]
}
```

---

#### PUT `/profile`
Update profile fields. Only allowed fields are accepted.

```json
// Request (all fields optional)
{
  "full_name": "Jane Doe",
  "display_name": "janed",
  "avatar_url": "https://...",
  "bio": "Updated bio",
  "date_of_birth": "1990-01-15",
  "gender": "female",       // male | female | non-binary | prefer-not-to-say
  "phone_number": "+1234567890",
  "country": "US",
  "city": "New York",
  "website_url": "https://janedoe.com"
}

// Response 200
{ "message": "Profile updated successfully", "profile": {...}, "success": true }
```

---

#### POST `/complete-verification`
Check if the user's email is verified and return their profile.

```json
// Response 200
{ "success": true, "message": "Email verified successfully!", "profile": {...} }
```

---

#### DELETE `/delete-account`
Soft-delete the authenticated user's account. Sends confirmation email.

```json
// Response 200
{ "message": "Account deleted successfully", "success": true }
```

---

### Admin Endpoints (Require `Authorization: Bearer <admin-token>`)

Admin endpoints require the JWT to contain `role: "admin"`. Promote a user via:
```bash
node scripts/make-admin.js admin@example.com
```

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/admin/users` | List all users |
| `GET` | `/admin/users/:userId` | Get user by ID |
| `PUT` | `/admin/users/:userId` | Update user (fields: `email`, `role`, `account_status`, `email_verified`) |
| `DELETE` | `/admin/users/:userId` | Delete user (cannot delete self) |
| `POST` | `/broadcast-email` | Send email to all active, verified users |

#### Broadcast Email Example
```json
// Request
{
  "subject": "Important Update",
  "message": "Hello everyone...",      // plain text (auto-wrapped in HTML)
  "htmlContent": "<h1>Or HTML</h1>"    // optional, overrides message
}

// Response 200
{
  "success": true,
  "message": "Broadcast email sent successfully",
  "stats": { "totalRecipients": 150, "successful": 148, "failed": 2 }
}
```

---

## 4. Frontend Integration Patterns

### React / Next.js

```javascript
// lib/auth.js — Auth helper module

const AUTH_API = 'http://localhost:3000/api/v1/auth';

export async function signup(email, password) {
  const res = await fetch(`${AUTH_API}/signup`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password })
  });
  if (!res.ok) throw new Error((await res.json()).error);
  return res.json();
}

export async function signin(email, password) {
  const res = await fetch(`${AUTH_API}/signin`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password })
  });
  if (!res.ok) throw new Error((await res.json()).error);
  const data = await res.json();
  localStorage.setItem('access_token', data.access_token);
  localStorage.setItem('user', JSON.stringify(data.user));
  return data;
}

export function googleSignIn() {
  const frontendUrl = window.location.origin;
  window.location.href = `${AUTH_API}/google?frontend_url=${encodeURIComponent(frontendUrl)}`;
}

// Call this on your callback/landing page after Google redirect
export async function handleOAuthCallback() {
  const params = new URLSearchParams(window.location.search);
  const code = params.get('code');
  if (!code) return null;

  const res = await fetch(`${AUTH_API}/exchange-code`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ code })
  });
  if (!res.ok) throw new Error((await res.json()).error);
  const data = await res.json();
  localStorage.setItem('access_token', data.access_token);
  localStorage.setItem('user', JSON.stringify(data.user));

  // Clean URL
  window.history.replaceState({}, '', window.location.pathname);
  return data;
}

export async function getProfile() {
  const token = localStorage.getItem('access_token');
  const res = await fetch(`${AUTH_API}/profile`, {
    headers: { 'Authorization': `Bearer ${token}` }
  });
  if (!res.ok) throw new Error((await res.json()).error);
  return res.json();
}

export function logout() {
  localStorage.removeItem('access_token');
  localStorage.removeItem('user');
}

export function isAuthenticated() {
  return !!localStorage.getItem('access_token');
}

export function getToken() {
  return localStorage.getItem('access_token');
}
```

### React Component Example

```jsx
import { useState, useEffect } from 'react';
import { signin, signup, googleSignIn, handleOAuthCallback, getProfile, logout, isAuthenticated } from './lib/auth';

function App() {
  const [user, setUser] = useState(null);

  useEffect(() => {
    // Handle OAuth callback on page load
    handleOAuthCallback().then(data => {
      if (data) setUser(data.user);
    });

    // Load existing session
    if (isAuthenticated()) {
      getProfile().then(setUser).catch(() => logout());
    }
  }, []);

  if (user) {
    return (
      <div>
        <p>Welcome, {user.full_name || user.email}</p>
        <button onClick={() => { logout(); setUser(null); }}>Sign Out</button>
      </div>
    );
  }

  return (
    <div>
      <button onClick={googleSignIn}>Sign in with Google</button>
      {/* Or build your own email/password form calling signin() */}
    </div>
  );
}
```

---

## 5. Backend Integration (Validating JWTs in Your Own Server)

If your project has a separate backend (FastAPI, Go, Rails, etc.), you can validate S-Auth JWTs directly without calling S-Auth on every request.

### Shared JWT Secret
Your backend needs the same `JWT_SECRET` that S-Auth uses. The JWT payload contains:

```json
{
  "sub": "user-uuid",          // User ID
  "email": "user@example.com", // Email
  "role": "user",              // "user" or "admin"
  "iat": 1714567890,           // Issued at
  "exp": 1714571490            // Expires (1 hour after iat)
}
```

### Python (FastAPI)

```python
# middleware/auth.py
import jwt
import os
from fastapi import Request, HTTPException

JWT_SECRET = os.environ["JWT_SECRET"]  # Same secret as S-Auth

async def verify_token(request: Request):
    auth = request.headers.get("Authorization", "")
    if not auth.startswith("Bearer "):
        raise HTTPException(401, "Missing authorization header")

    token = auth.split(" ")[1]
    try:
        payload = jwt.decode(token, JWT_SECRET, algorithms=["HS256"])
        request.state.user_id = payload["sub"]
        request.state.email = payload["email"]
        request.state.role = payload.get("role", "user")
    except jwt.ExpiredSignatureError:
        raise HTTPException(401, "Token expired")
    except jwt.InvalidTokenError:
        raise HTTPException(401, "Invalid token")

# Usage in route
@app.get("/api/my-data")
async def get_data(request: Request):
    await verify_token(request)
    user_id = request.state.user_id
    # Your business logic here...
```

### Go

```go
package middleware

import (
    "net/http"
    "strings"
    "github.com/golang-jwt/jwt/v5"
)

var jwtSecret = []byte(os.Getenv("JWT_SECRET"))

func AuthMiddleware(next http.Handler) http.Handler {
    return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
        auth := r.Header.Get("Authorization")
        if !strings.HasPrefix(auth, "Bearer ") {
            http.Error(w, "Unauthorized", 401)
            return
        }

        tokenStr := strings.TrimPrefix(auth, "Bearer ")
        token, err := jwt.Parse(tokenStr, func(t *jwt.Token) (interface{}, error) {
            return jwtSecret, nil
        })

        if err != nil || !token.Valid {
            http.Error(w, "Invalid token", 401)
            return
        }

        claims := token.Claims.(jwt.MapClaims)
        ctx := context.WithValue(r.Context(), "user_id", claims["sub"])
        ctx = context.WithValue(ctx, "email", claims["email"])
        next.ServeHTTP(w, r.WithContext(ctx))
    })
}
```

---

## 6. Database Schema

S-Auth uses **Neon PostgreSQL** with a normalized relational schema. If your app needs to query user data directly (instead of via API), here is the schema:

### Tables

```
┌──────────────────────┐     ┌───────────────────────┐
│       users          │     │    user_profiles      │
├──────────────────────┤     ├───────────────────────┤
│ id (UUID, PK)        │◄───┤ user_id (FK, UNIQUE)  │
│ email (UNIQUE)       │     │ full_name             │
│ password_hash        │     │ display_name          │
│ email_verified       │     │ avatar_url, bio       │
│ email_verified_at    │     │ date_of_birth, gender │
│ account_status       │     │ phone_number          │
│ role (user|admin)    │     │ country, city         │
│ last_signin_at       │     │ website_url           │
│ created_at           │     └───────────────────────┘
│ updated_at           │
└──────────┬───────────┘
           │
    ┌──────┴───────┐
    │              │
┌───▼──────────┐ ┌─▼──────────────────┐
│ user_oauth   │ │ user_auth_tokens   │
├──────────────┤ ├────────────────────┤
│ provider     │ │ token_type         │
│ provider_id  │ │ token (UNIQUE)     │
│ access_token │ │ expires_at         │
│ refresh_token│ │ used_at            │
└──────────────┘ └────────────────────┘

┌──────────────────┐   ┌──────────────────┐
│   audit_logs     │   │  login_attempts  │
├──────────────────┤   ├──────────────────┤
│ event            │   │ email (PK)       │
│ data (JSONB)     │   │ attempts         │
│ timestamp        │   │ locked_until     │
│ ip_address       │   │ ip_address       │
│ user_id          │   └──────────────────┘
└──────────────────┘
```

### Convenience View: `users_complete`
S-Auth uses a SQL view that joins `users` + `user_profiles` + `user_oauth`. This is what the API returns. It **excludes** `password_hash`.

```sql
SELECT * FROM users_complete WHERE id = $1;
-- Returns: id, email, email_verified, role, full_name, avatar_url, bio, ..., oauth_providers (JSON)
```

### Token Types in `user_auth_tokens`
| Type | Purpose | Expiry |
|------|---------|--------|
| `email_verification` | Verify email address | 24 hours |
| `password_reset` | Reset password (planned) | 1 hour |
| `oauth_csrf` | CSRF token for OAuth state | 10 minutes |
| `oauth_code` | One-time code after OAuth redirect | 60 seconds |

---

## 7. Project Architecture & File Map

```
S-Auth/
├── src/
│   ├── server.js                     ← Express app setup, middleware, error handling
│   ├── config/
│   │   ├── db.js                     ← PostgreSQL pool (Neon, SSL enabled)
│   │   └── security.config.js        ← CORS, cookies, JWT, lockout settings
│   ├── controllers/
│   │   └── auth.controller.js        ← HTTP handlers (935 lines)
│   ├── middleware/
│   │   ├── auth.middleware.js         ← JWT verify (protect) + admin check (requireAdmin)
│   │   └── validator.middleware.js    ← express-validator rules
│   ├── routes/
│   │   └── auth.routes.js            ← Route definitions
│   ├── services/
│   │   ├── auth.service.js           ← Core business logic (650 lines)
│   │   └── email.service.js          ← Brevo email templates + retry
│   └── utils/
│       ├── audit.logger.js           ← DB-backed security event logger
│       └── login.tracker.js          ← In-memory + DB brute-force tracker
├── migrations/                       ← SQL files, run in Neon SQL editor
│   ├── 001_security_tables.sql
│   ├── 004_relational_users_tables.sql
│   ├── 005_audit_and_login_tables.sql
│   ├── 006_add_user_roles.sql
│   └── 007_add_oauth_token_types.sql
├── scripts/
│   ├── make-admin.js                 ← Promote user to admin role
│   ├── list-users.js                 ← List all users
│   ├── delete-auth-user.js           ← Delete user by email
│   ├── test-email.js                 ← Test Brevo email delivery
│   └── test-production.js            ← Smoke test all endpoints
├── package.json                      ← Entry: src/server.js
├── .env.example                      ← Template for environment variables
└── LLM-GUIDE.md                      ← This file
```

### Request Flow
```
Request → Helmet → CORS → Morgan → JSON Parser → Cookie Parser
  → Router → Validator Middleware → [protect middleware] → Controller → Service → PostgreSQL
  → Response (sanitized errors in production)
```

---

## 8. Security Features (Active)

| Feature | Implementation |
|---------|---------------|
| Password hashing | bcrypt, 12 salt rounds |
| JWT tokens | HS256, 1-hour expiry |
| Brute-force protection | 5 attempts → 15-min lockout (in-memory + DB) |
| CORS | Explicit whitelist, no regex |
| Cookies | httpOnly, secure (prod), sameSite: strict (prod) |
| Helmet headers | HSTS preload, CSP, X-XSS-Protection |
| Input validation | express-validator on all public endpoints |
| SSL/TLS | `rejectUnauthorized: true` on DB connection |
| OAuth CSRF | Random token in state parameter, DB-validated |
| Open redirect protection | Redirect URLs validated against CORS whitelist |
| Admin field whitelisting | Only `email, role, account_status, email_verified` modifiable |
| Audit logging | Critical events persisted to `audit_logs` table |
| Error sanitization | Stack traces hidden in production |
| One-time OAuth codes | Access tokens never exposed in URLs |

---

## 9. Code Patterns (Follow These When Extending)

### Adding a New Endpoint

**1. Route** (`src/routes/auth.routes.js`):
```javascript
router.post('/my-endpoint', protect, authController.myHandler);
```

**2. Controller** (`src/controllers/auth.controller.js`):
```javascript
exports.myHandler = async (req, res) => {
  try {
    const result = await AuthService.myMethod(req.user.sub, req.body);

    await auditLogger.log('MY_EVENT', {
      userId: req.user.sub,
      ip: req.ip || req.connection.remoteAddress
    });

    res.status(200).json({ success: true, data: result });
  } catch (err) {
    console.error('My handler error:', err);
    res.status(400).json({
      error: err.message || 'Operation failed',
      details: process.env.NODE_ENV === 'development' ? err.message : undefined
    });
  }
};
```

**3. Service** (`src/services/auth.service.js`):
```javascript
async myMethod(userId, data) {
  // Always use parameterized queries ($1, $2...)
  const result = await db.query(
    'SELECT * FROM my_table WHERE user_id = $1 AND status = $2',
    [userId, 'active']
  );
  return result.rows;
}
```

### Database Query Pattern
```javascript
// ALWAYS parameterized — never concatenate user input into SQL
const result = await db.query(
  'INSERT INTO table (col1, col2) VALUES ($1, $2) RETURNING *',
  [value1, value2]
);
const row = result.rows[0];
```

### Audit Logging Pattern
```javascript
// Standard call — first arg is event name string, second is data object
await auditLogger.log('EVENT_NAME', {
  userId: user.id,
  email: user.email,
  ip: req.ip
});

// Helper methods for common events
await auditLogger.logSuccessfulAuth(userId, email, method, ip);
await auditLogger.logFailedLogin(email, ip);
await auditLogger.logAccountDeletion(userId, email, ip);
```

---

## 10. Environment Variables

```env
# ── Server ──
PORT=3000
NODE_ENV=development           # or "production"
BACKEND_URL=http://localhost:3000
FRONTEND_URL=http://localhost:3000
REQUIRE_HTTPS=false            # set "true" for production

# ── CORS ──
CORS_WHITELIST=http://localhost:3000,http://localhost:5173
COOKIE_DOMAIN=                 # empty for localhost, ".yourdomain.com" for production

# ── Database (Neon PostgreSQL) ──
DATABASE_URL=postgres://user:password@hostname.neon.tech/neondb?sslmode=require

# ── JWT ──
JWT_SECRET=<512-bit-random-hex>
# Generate: node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"

# ── Google OAuth ──
GOOGLE_CLIENT_ID=xxx.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=GOCSPX-xxx

# ── Brevo Email ──
BREVO_API_KEY=xkeysib-xxx
BREVO_SENDER_EMAIL=noreply@yourdomain.com
BREVO_SENDER_NAME="Your App Name"
```

---

## 11. Common Integration Scenarios

### Scenario A: React SPA + S-Auth Only
```
React (Vite) on :5173  ◄──►  S-Auth on :3000
```
- Add `http://localhost:5173` to `CORS_WHITELIST`
- Set `FRONTEND_URL=http://localhost:5173`
- Use the React integration code from Section 4
- Store JWT in `localStorage`, send as `Authorization: Bearer <token>`

### Scenario B: React + Your Backend + S-Auth
```
React (:5173) ◄──► Your API (:8000) ◄──► S-Auth (:3000)
                        │
                  validates JWT using
                  shared JWT_SECRET
```
- Your backend shares `JWT_SECRET` with S-Auth
- Your backend validates JWTs directly (see Section 5)
- Your backend does NOT need to call S-Auth for every request
- Your backend can call S-Auth's admin endpoints for user management

### Scenario C: Mobile App + S-Auth
```
iOS/Android App ◄──► S-Auth on :3000
```
- Use S-Auth's REST API directly from the mobile app
- Store JWT in secure storage (Keychain/Keystore)
- CORS allows requests with no origin (mobile apps, Postman)

---

## 12. Troubleshooting

| Error | Cause | Fix |
|-------|-------|-----|
| `Not allowed by CORS` | Origin not whitelisted | Add to `CORS_WHITELIST` in `.env` |
| `Account temporarily locked` | 5+ failed logins | Wait 15 min or clear `login_attempts` table |
| `Token expired` | JWT older than 1 hour | Sign in again |
| `Invalid or expired access token` | Wrong `JWT_SECRET` | Ensure same secret across environments |
| `This account uses Google Sign-In` | User tried password login on OAuth account | Use Google Sign-In button |
| `Redirect URL is not in the allowed whitelist` | `frontend_url` not in CORS list | Add URL to `CORS_WHITELIST` |
| `Email not sending` | Bad Brevo API key | Check `BREVO_API_KEY` in Brevo dashboard |
| `Database connection error` | Wrong `DATABASE_URL` | Verify Neon connection string |
| `OAuth state validation failed` | CSRF token expired or replayed | Retry the Google sign-in from scratch |

### Debug Commands
```bash
# Health check
curl http://localhost:3000/health

# Test signup
curl -X POST http://localhost:3000/api/v1/auth/signup \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"Password123!"}'

# Test signin
curl -X POST http://localhost:3000/api/v1/auth/signin \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"Password123!"}'

# Test protected route
curl http://localhost:3000/api/v1/auth/profile \
  -H "Authorization: Bearer <your-jwt-token>"

# Run production smoke tests
npm run test:production

# Promote user to admin
node scripts/make-admin.js admin@example.com
```

---

## 13. Production Deployment Checklist

- [ ] Set `NODE_ENV=production`
- [ ] Generate strong `JWT_SECRET` (512-bit random)
- [ ] Set `REQUIRE_HTTPS=true`
- [ ] Set `FRONTEND_URL` to production HTTPS domain
- [ ] Update `CORS_WHITELIST` with production domains only
- [ ] Set `COOKIE_DOMAIN=.yourdomain.com`
- [ ] Run all migrations in Neon SQL editor
- [ ] Update Google OAuth redirect URIs in Google Console
- [ ] Verify Brevo sender email
- [ ] Run `npm run test:production` against deployed URL
- [ ] Consider adding `express-rate-limit` (not built-in)
- [ ] Set up monitoring (Sentry, Datadog, etc.)

```bash
# Production start
NODE_ENV=production npm start

# With PM2
pm2 start src/server.js --name s-auth --env production
```

---

**Maintained by:** Susindran  
**Version:** 1.1.0  
**Guide Version:** 3.0.0
