# Starviel Authentication API Reference

Complete API documentation for the Starviel Authentication Microservice.

## Base URL

- **Development:** `http://localhost:3000`
- **Production:** `https://auth.starviel.io`

## Authentication

Most endpoints require a Bearer token in the `Authorization` header:

```
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

---

## Public Endpoints

### Sign Up
**`POST /api/v1/auth/signup`**

Create a new user account.

**Request:**
```json
{
  "email": "user@example.com",
  "password": "SecurePassword123!",
  "fullName": "John Doe"
}
```

**Response (201):**
```json
{
  "success": true,
  "message": "Account created successfully. Check your email to verify.",
  "user": {
    "id": "66fcc4b2-70f8-4fd2-9976-55d118e3f488",
    "email": "user@example.com",
    "full_name": "John Doe",
    "email_verified": false,
    "account_status": "active",
    "created_at": "2026-05-14T12:00:00Z"
  }
}
```

**Errors:**
- `400` - Email already exists or invalid password
- `500` - Server error

---

### Sign In
**`POST /api/v1/auth/signin`**

Authenticate with email and password.

**Request:**
```json
{
  "email": "user@example.com",
  "password": "SecurePassword123!"
}
```

**Response (200):**
```json
{
  "user": {
    "id": "66fcc4b2-70f8-4fd2-9976-55d118e3f488",
    "email": "user@example.com",
    "role": "user",
    "email_verified": true,
    "account_status": "active",
    "created_at": "2026-05-14T11:52:48.712Z"
  },
  "access_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiI2NmZjYzRiMi03MGY4LTRmZDItOTk3Ni01NWQxMThlM2Y0ODgiLCJlbWFpbCI6ImRoYW5heWVuZHJhbkBnbWFpbC5jb20iLCJyb2xlIjoidXNlciIsImlhdCI6MTc3ODc1OTY5NSwiZXhwIjoxNzc4NzYzMjk1fQ.8E1VFWea8eN5d3A5C5KT3jZceLDVQY6FYpIsBCJ1uZ8"
}
```

**Errors:**
- `401` - Invalid credentials
- `423` - Account locked (too many failed attempts)

---

### Verify Email
**`GET /api/v1/auth/verify-email?token=VERIFICATION_TOKEN`**

Verify user email address.

**Response (200):**
```json
{
  "success": true,
  "message": "Email verified successfully"
}
```

---

### Resend Verification Email
**`POST /api/v1/auth/resend-verification`**

Request a new verification email.

**Request:**
```json
{
  "email": "user@example.com"
}
```

**Response (200):**
```json
{
  "success": true,
  "message": "Verification email sent"
}
```

---

## Protected Endpoints

All require `Authorization: Bearer TOKEN` header.

### Get Profile
**`GET /api/v1/auth/profile`**

Retrieve current user's profile.

**Response (200):**
```json
{
  "user": {
    "id": "66fcc4b2-70f8-4fd2-9976-55d118e3f488",
    "email": "dhanayendran@gmail.com",
    "full_name": "John Doe",
    "display_name": "jdoe",
    "avatar_url": "https://...",
    "bio": "Software engineer",
    "phone_number": "+1-555-0100",
    "country": "USA",
    "city": "San Francisco",
    "created_at": "2026-05-14T11:52:48.712Z"
  }
}
```

---

### Update Profile
**`PUT /api/v1/auth/profile`**

Update user profile information.

**Request:**
```json
{
  "full_name": "Jane Doe",
  "display_name": "janedoe",
  "bio": "Product designer",
  "phone_number": "+1-555-0100",
  "country": "USA",
  "city": "New York"
}
```

**Response (200):**
```json
{
  "success": true,
  "message": "Profile updated successfully",
  "user": { /* updated user object */ }
}
```

---

### Delete Account
**`DELETE /api/v1/auth/delete-account`**

Permanently delete user account and all associated data.

**Response (200):**
```json
{
  "success": true,
  "message": "Account deleted successfully"
}
```

---

## OAuth 2.0 Provider Endpoints

### Start Authorization
**`GET /oauth/authorize`**

Initiate OAuth authorization flow.

**Parameters:**
- `client_id` (required) - Your app's client ID
- `redirect_uri` (required) - Callback URL
- `response_type` (required) - Must be `code`
- `scope` (optional) - Space-separated: `profile email`
- `state` (recommended) - CSRF protection token

**Response:**
HTML login and consent page.

---

### Request Token
**`POST /oauth/token`**

Exchange authorization code for access token.

**Request:**
```json
{
  "grant_type": "authorization_code",
  "code": "119bfe990c2caa45bc786d492f70400c9b6e39f3de2930fe85a9b25173fb76eb",
  "client_id": "sauth_a3a6fc028c0ab7a200f4fedaac189eb9",
  "client_secret": "10a94eccf3242a59e8fe7b7153f932db8a6683054313fdab3896782a1b468f8f"
}
```

**Response (200):**
```json
{
  "access_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "token_type": "Bearer",
  "expires_in": 3600,
  "scope": "profile email"
}
```

---

### Get User Info
**`GET /oauth/userinfo`**

Retrieve authenticated user's profile.

**Headers:**
```
Authorization: Bearer ACCESS_TOKEN
```

**Response (200):**
```json
{
  "sub": "66fcc4b2-70f8-4fd2-9976-55d118e3f488",
  "email": "dhanayendran@gmail.com",
  "name": "John Doe",
  "picture": "https://..."
}
```

---

## Developer Endpoints

### Register OAuth App
**`POST /api/v1/auth/developer/apps`**

Create a new OAuth application (requires authentication).

**Request:**
```json
{
  "client_name": "My Test App",
  "redirect_uris": ["http://localhost:3000/callback"]
}
```

**Response (201):**
```json
{
  "success": true,
  "message": "App created! Save the client_secret — it will not be shown again.",
  "client": {
    "client_id": "sauth_a3a6fc028c0ab7a200f4fedaac189eb9",
    "client_secret": "10a94eccf3242a59e8fe7b7153f932db8a6683054313fdab3896782a1b468f8f",
    "client_name": "My Test App",
    "redirect_uris": ["http://localhost:3000/callback"],
    "created_at": "2026-05-14T12:00:00Z"
  }
}
```

---

### List Your Apps
**`GET /api/v1/auth/developer/apps`**

Get all OAuth apps registered by current user.

**Response (200):**
```json
{
  "apps": [
    {
      "client_id": "sauth_a3a6fc028c0ab7a200f4fedaac189eb9",
      "client_name": "My Test App",
      "redirect_uris": ["http://localhost:3000/callback"],
      "created_at": "2026-05-14T12:00:00Z"
    }
  ]
}
```

---

### Delete App
**`DELETE /api/v1/auth/developer/apps/:clientId`**

Remove an OAuth application.

**Response (200):**
```json
{
  "success": true,
  "message": "App deleted successfully"
}
```

---

## Admin Endpoints

Requires `admin` role.

### List Users
**`GET /api/v1/auth/admin/users?page=1&limit=20`**

Get paginated list of all users.

**Response (200):**
```json
{
  "users": [
    {
      "id": "66fcc4b2-70f8-4fd2-9976-55d118e3f488",
      "email": "user@example.com",
      "role": "user",
      "account_status": "active",
      "created_at": "2026-05-14T11:52:48.712Z"
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 150
  }
}
```

---

### Get User Details
**`GET /api/v1/auth/admin/users/:userId`**

Get detailed information about a specific user.

**Response (200):**
```json
{
  "user": {
    "id": "66fcc4b2-70f8-4fd2-9976-55d118e3f488",
    "email": "user@example.com",
    "full_name": "John Doe",
    "role": "user",
    "account_status": "active",
    "email_verified": true,
    "created_at": "2026-05-14T11:52:48.712Z",
    "last_signin_at": "2026-05-14T12:00:00Z"
  }
}
```

---

## Error Responses

All errors follow this format:

```json
{
  "error": "invalid_request",
  "error_description": "Missing required parameter: email",
  "code": 400
}
```

### Common Error Codes

| Code | Error | Description |
|------|-------|-------------|
| 400 | `invalid_request` | Missing or invalid parameters |
| 401 | `unauthorized` | Missing or invalid token |
| 403 | `forbidden` | Insufficient permissions |
| 404 | `not_found` | Resource not found |
| 409 | `conflict` | Resource already exists |
| 423 | `locked` | Account locked (failed logins) |
| 500 | `server_error` | Internal server error |

---

## Rate Limiting

- **Sign Up/Sign In:** 5 requests per 15 minutes per IP
- **Verify Email:** 3 requests per hour
- **General API:** 100 requests per minute

---

## Security Headers

All responses include security headers:

```
X-Content-Type-Options: nosniff
X-Frame-Options: SAMEORIGIN
X-XSS-Protection: 1; mode=block
Strict-Transport-Security: max-age=31536000; includeSubDomains
```

---

## CORS

In development, all localhost origins are allowed. In production, specific origins must be whitelisted via `CORS_WHITELIST` environment variable.

---

## Support

For API issues or questions:
- Email: api-support@starviel.io
- Docs: https://docs.starviel.io
- Status: https://status.starviel.io
