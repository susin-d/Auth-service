# S-Auth API Documentation v1.0.2

Complete API reference for S-Auth microservice endpoints, request/response formats, error handling, and security considerations.

## Table of Contents
- [Base URL](#base-url)
- [Authentication](#authentication)
- [Endpoints](#endpoints)
- [Error Handling](#error-handling)
- [Security](#security)
- [Rate Limiting](#rate-limiting)
- [Examples](#examples)

## Base URL

```
http://localhost:3000/api/v1/auth
```

Production environment uses HTTPS:
```
https://api.yourdomain.com/api/v1/auth
```

## Authentication

### JWT Token
Protected endpoints require a JWT token in the `Authorization` header:

```
Authorization: Bearer <access_token>
```

### Cookies
OAuth and session-based endpoints set authentication cookies:
- `auth-token`: Access token (httpOnly, 1 hour expiry)
- `refresh-token`: Refresh token (httpOnly, 30 day expiry)

## Endpoints

### 1. User Signup

Create a new user account with email and password.

```http
POST /signup
Content-Type: application/json

{
  "email": "user@example.com",
  "password": "Password123!",
  "frontendUrl": "https://yourdomain.com"
}
```

**Parameters:**
- `email` (required): Valid email address
- `password` (required): Minimum 8 characters, must contain uppercase, lowercase, and numbers
- `frontendUrl` (optional): Frontend URL for email verification redirects

**Response:** `201 Created`
```json
{
  "message": "User created",
  "user_id": "550e8400-e29b-41d4-a716-446655440000"
}
```

**Error Responses:**
```json
// Email already exists
{
  "error": "This email is already registered. Please sign in or use a different email."
}

// Invalid email format
{
  "error": "Invalid email format. Please provide a valid email address."
}

// Weak password
{
  "error": "Password must be at least 8 characters with uppercase, lowercase, and numbers."
}

// Rate limited
{
  "error": "Too many requests. Please try again in a few minutes.",
  "statusCode": 429
}
```

---

### 2. User Signin

Authenticate with email and password.

```http
POST /signin
Content-Type: application/json

{
  "email": "user@example.com",
  "password": "Password123!"
}
```

**Parameters:**
- `email` (required): Registered email address
- `password` (required): Account password

**Response:** `200 OK`
```json
{
  "user": {
    "id": "550e8400-e29b-41d4-a716-446655440000",
    "email": "user@example.com"
  },
  "access_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "refresh_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
}
```

**Cookies Set:**
- `auth-token`: JWT access token
- `refresh-token`: JWT refresh token

**Error Responses:**
```json
// Account locked after failed attempts
{
  "error": "Account temporarily locked",
  "remainingMinutes": 15
}

// Invalid credentials
{
  "error": "Invalid email or password"
}
```

---

### 3. Google OAuth

Initiate Google OAuth flow with optional redirect URL.

```http
GET /google?frontend_url=https://yourdomain.com
```

**Parameters:**
- `frontend_url` (optional): Frontend URL to redirect after OAuth. Falls back to `FRONTEND_URL` environment variable

**Flow:**
1. Frontend redirects to this endpoint with `frontend_url` parameter
2. Backend encodes frontend URL in OAuth state parameter (base64)
3. Backend redirects to Google OAuth consent screen
4. User authenticates with Google
5. Google redirects to `/google/callback` with code and state
6. Backend extracts frontendUrl from state, exchanges code for tokens
7. Backend sets authentication cookies
8. Backend redirects to frontend URL with user authenticated

**Response:** `302 Redirect` to Google OAuth

**Example Frontend Call:**
```javascript
const frontendUrl = window.location.origin;
window.location.href = `http://localhost:3000/api/v1/auth/google?frontend_url=${encodeURIComponent(frontendUrl)}`;
```

**Cookies Set After OAuth:**
- `auth-token`: JWT access token
- `refresh-token`: JWT refresh token

---

### 4. Google OAuth Callback

Handles Google OAuth callback (called by Google servers).

```http
GET /google/callback?code=<auth_code>&state=<encoded_frontend_url>
```

**Note:** This endpoint is called by Google servers automatically after user authentication.

**Parameters:**
- `code` (required): Authorization code from Google
- `state` (optional): Base64-encoded frontend URL from initial request

**Response:** `302 Redirect` to frontend with cookies set

**Error Responses:**
```json
// Missing authorization code
{
  "error": "Missing OAuth code"
}

// Authorization code expired/invalid
{
  "error": "Invalid or expired authorization code. Please try signing in again."
}

// User denied access
{
  "error": "You denied access to your Google account. Please try again and allow access."
}

// Account already exists
{
  "error": "An account with this email already exists. Please sign in instead.",
  "statusCode": 409
}
```

---

### 5. Verify Email (Public)

Verify email address with token from email link.

```http
GET /verify-email?token=<verification_token>
```

**Parameters:**
- `token` (required): Verification token from email link
- `type` (optional): Verification type (default: `email`)

**Response:** `200 OK` - HTML page
- Success: Animated confirmation page with styled success message
- Error: Styled error page with error details

**What Happens:**
1. Token is verified with Supabase
2. Profile `email_verified` field is updated
3. Welcome email is sent automatically
4. HTML success/error page is displayed

---

### 5.1. Resend Verification Email (Public)

Request a new verification email to be sent.

```http
POST /resend-verification
Content-Type: application/json

{
  "email": "user@example.com",
  "frontendUrl": "https://yourdomain.com"
}
```

**Parameters:**
- `email` (required): Email address associated with account
- `frontendUrl` (optional): Frontend URL for email verification redirects

**Response:** `200 OK`
```json
{
  "message": "Verification link has been sent to your email."
}
```

**Response (Development mode):**
```json
{
  "message": "Verification link has been sent to your email.",
  "details": "Verification link: http://localhost:3000/api/v1/auth/verify-email?token=abc123..."
}
```

**Error Responses:**
```json
// User not found
{
  "error": "User with this email not found. Please sign up first.",
  "statusCode": 404
}

// Email already verified
{
  "error": "Email is already verified. You can sign in now.",
  "statusCode": 200
}

// Rate limited
{
  "error": "Too many verification requests. Please try again in a few minutes.",
  "statusCode": 429
}

// Missing email
{
  "error": "Email is required to resend verification link."
}
```

**What Happens:**
1. User existence is checked
2. Email verification status is verified
3. Old verification tokens are deleted
4. New token is generated (24-hour expiry)
5. Verification email is sent to user
6. (Development) Token is returned in response

---

### 6. Get Profile (Protected)

Retrieve authenticated user's profile.

```http
GET /profile
Authorization: Bearer <access_token>
```

**Response:** `200 OK`
```json
{
  "id": "550e8400-e29b-41d4-a716-446655440000",
  "email": "user@example.com",
  "full_name": "John Doe",
  "avatar_url": "https://example.com/avatar.jpg",
  "email_verified": true,
  "email_verified_at": "2026-02-13T10:30:00Z",
  "created_at": "2026-02-13T09:00:00Z",
  "last_signin_at": "2026-02-13T10:30:00Z",
  "account_status": "active"
}
```

**Error Responses:**
```json
// Unauthorized - invalid/missing token
{
  "error": "No authorization token provided"
}

// Token expired
{
  "error": "Token expired"
}

// User not found
{
  "error": "User not found"
}
```

---

### 7. Update Profile (Protected)

Update user profile information.

```http
PUT /profile
Authorization: Bearer <access_token>
Content-Type: application/json

{
  "full_name": "John Doe",
  "avatar_url": "https://example.com/new-avatar.jpg"
}
```

**Parameters:**
- `full_name` (optional): User's full name
- `avatar_url` (optional): URL to user's avatar image

**Response:** `200 OK`
```json
{
  "id": "550e8400-e29b-41d4-a716-446655440000",
  "email": "user@example.com",
  "full_name": "John Doe",
  "avatar_url": "https://example.com/new-avatar.jpg",
  "updated_at": "2026-02-13T10:35:00Z"
}
```

---

### 8. Delete Account (Protected)

Permanently delete user account and all associated data.

```http
DELETE /delete-account
Authorization: Bearer <access_token>
```

**Response:** `200 OK`
```json
{
  "message": "Account deleted successfully",
  "success": true
}
```

**Error Responses:**
```json
// Unauthorized
{
  "error": "No authorization token provided"
}

// Account not found
{
  "error": "Account not found or already deleted.",
  "statusCode": 404
}
```

---

### 9. Health Check

Check API service health status.

```http
GET /health
```

**Response:** `200 OK`
```json
{
  "status": "UP",
  "service": "auth-service"
}
```

---

## Error Handling

### HTTP Status Codes

| Code | Meaning | Common Causes |
|------|---------|---------------|
| 200 | OK | Successful request |
| 201 | Created | Resource created successfully |
| 302 | Redirect | OAuth/email verification redirects |
| 400 | Bad Request | Invalid parameters, missing fields |
| 401 | Unauthorized | Invalid/missing token, invalid credentials |
| 403 | Forbidden | Permission denied |
| 404 | Not Found | Resource not found |
| 409 | Conflict | Email already exists, duplicate data |
| 429 | Too Many Requests | Rate limited, account locked |
| 500 | Internal Error | Server error |

### Error Response Format

```json
{
  "error": "Human-readable error message",
  "statusCode": 400,
  "details": "Technical details (development only)"
}
```

---

## Security

### Password Requirements

- Minimum 8 characters
- At least one uppercase letter (A-Z)
- At least one lowercase letter (a-z)
- At least one number (0-9)

### Failed Login Protection

- 5 consecutive failed attempts → 15-minute account lockout
- Automatic reset after 1 hour
- Persistent tracking across server restarts
- IP address logging for audit trail

### JWT Token Security

- **Algorithm:** HS256 (HMAC SHA-256)
- **Access Token Expiry:** 1 hour
- **Refresh Token Expiry:** 30 days
- **Secret:** 256-bit random string

### Cookie Security

| Flag | Value | Effect |
|------|-------|--------|
| httpOnly | true | Prevents XSS attacks |
| secure | true (prod) | HTTPS only in production |
| sameSite | strict (prod) | CSRF protection |

### CORS Configuration

- Explicit domain validation (no regex)
- No wildcard origins in production
- Localhost allowed only in development

---

## Rate Limiting

Current limits (per IP address):

- **Signup/Signin:** 5 requests per minute
- **Email Verification:** 10 requests per hour
- **General API:** 100 requests per minute
- **OAuth:** 10 initiations per hour

**Response on Rate Limit:**
```json
{
  "error": "Too many requests. Please try again in a few minutes.",
  "statusCode": 429
}
```

---

## Examples

### Example 1: Sign Up

```bash
curl -X POST http://localhost:3000/api/v1/auth/signup \
  -H "Content-Type: application/json" \
  -d '{
    "email": "user@example.com",
    "password": "SecurePass123!",
    "frontendUrl": "https://yourdomain.com"
  }'
```

### Example 2: Sign In

```bash
curl -X POST http://localhost:3000/api/v1/auth/signin \
  -H "Content-Type: application/json" \
  -d '{
    "email": "user@example.com",
    "password": "SecurePass123!"
  }'
```

### Example 3: Get Profile

```bash
curl -X GET http://localhost:3000/api/v1/auth/profile \
  -H "Authorization: Bearer <access_token>"
```

### Example 4: Google OAuth

```javascript
// Initiate OAuth flow
const frontendUrl = window.location.origin;
window.location.href = `http://localhost:3000/api/v1/auth/google?frontend_url=${encodeURIComponent(frontendUrl)}`;
```

### Example 5: Delete Account

```bash
curl -X DELETE http://localhost:3000/api/v1/auth/delete-account \
  -H "Authorization: Bearer <access_token>"
```

---

## References

- [Security Guide](SECURITY.md) - Complete security documentation
- [Database Schema](DATABASE.md) - Database structure
- [Main README](../README.md) - Project overview
