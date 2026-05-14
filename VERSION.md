# S-Auth Microservice - Version History

## Version 2.0.0 (Current)
**Release Date:** April 30, 2026  
**Status:** Production Ready ✅

### Major Architectural Change: Supabase to Neon PostgreSQL
This version marks a major shift from Supabase-managed authentication to a self-managed PostgreSQL architecture using Neon. This provides full control over the database schema, avoids vendor lock-in with Supabase-specific features (like RLS and built-in auth), and allows for complex relational queries using standard SQL.

### Changes from v1.1.0
- **Database Migration:** Completely removed `@supabase/supabase-js` and migrated to `pg` (node-postgres).
  - Database provider: **Neon PostgreSQL**
  - Connection strategy: Managed connection pooling with SSL
  - Logic: All interactions refactored to **Raw SQL queries** with parameterization
- **Self-Managed Authentication:**
  - Moved from `auth.users` (Supabase-managed) to a custom `public.users` table.
  - Implemented bcrypt-based password hashing within the application service layer.
  - Migrated email verification and password reset tokens to a custom `user_auth_tokens` table.
- **Improved Data Model:**
  - Split user data into `users` (auth) and `user_profiles` (metadata).
  - Added `user_oauth` table for cleaner third-party connection management.
- **Security Enhancements:**
  - **SQL Injection Protection:** All queries use parameterized values.
  - **Application-Level Authorization:** Access control moved from DB-level RLS to application middleware and service checks.
  - **Audit Logging Enhanced:** Refactored for standard PostgreSQL `INSERT` patterns.
- **Developer Tools & Scripts:**
  - Refactored `make-admin.js`, `list-users.js`, and `delete-auth-user.js` for PostgreSQL.
  - Added new migrations (`004_relational_users_tables.sql`) for the relational model.
- **Documentation Overhaul:**
  - Updated `README.md`, `QUICK-START.md`, `DATABASE.md`, and `SECURITY.md`.
  - Removed all Supabase-specific setup instructions.

### New Features
- 🐘 Native PostgreSQL support via `pg`
- 🔐 Self-managed bcrypt authentication
- 📊 Improved relational database schema
- 🚀 Optimized connection pooling for Neon
- 🛡️ Application-managed security policies

---

## Version 1.1.0
**Release Date:** February 13, 2026  
**Status:** Production Ready

### Changes from v1.0.1
- **Brevo SDK Updated:** Migrated from deprecated `sib-api-v3-sdk` to official `@getbrevo/brevo` package
  - Resolves TLS connection errors
  - Uses official Brevo API endpoints
  - Better error handling and logging
- **Email Service Enhanced:** v1.2.0 with retry logic and new email types
  - Added exponential backoff retry mechanism (3 attempts)
  - New password reset email template
  - New account deletion confirmation email
  - All email methods now use retry logic with configurable delays
- **Resend Verification Email Endpoint:** New `/api/v1/auth/resend-verification` (POST)
  - Request new verification email if original expired
  - Prevents spam with rate limiting (429 errors)
  - Validates user existence and verification status
  - Rate-limited per user
- **Updated API Documentation:** Added resend-verification endpoint reference
- **Validation Improvements:** Added resendVerificationValidation middleware

### New Features
- 📧 Email retry logic with exponential backoff
- 🔄 Resend verification email endpoint
- 🔐 Password reset email (template ready for implementation)
- 📝 Account deletion confirmation email
- ✅ Better error handling in email service

## Version 1.0.1
**Release Date:** February 12, 2026  
**Status:** Superseded by v1.1.0

### Changes from v1.0.0
- **Google OAuth Simplified:** OAuth flow now uses backend URL exclusively
  - Removed `frontendUrl` parameter from `/google` endpoint
  - Redirect URL controlled by `FRONTEND_URL` environment variable
  - More secure server-controlled redirects
  - Simpler API (no query parameters needed)
- **Signup unchanged:** Still accepts optional `frontendUrl` for email verification redirects
- **React Test Frontend Added:** Full-featured React test interface
  - Modern UI with real-time response display
  - Tests all API endpoints (signup, signin, OAuth, delete)
  - Health check monitoring
  - Token management
  - Built with React 18 + Vite
- **Development Tools Added:**
  - .gitignore for proper version control
  - LLM-GUIDE.md for AI assistant support
  - Setup scripts for React frontend (Windows & Linux)
  - QUICK-START.md for streamlined onboarding

## Version 1.0.0
**Release Date:** February 12, 2026  
**Status:** Superseded by v1.0.1

### Core Features
- ✅ JWT-based authentication with 1-hour token expiry
- ✅ Google OAuth 2.0 integration (direct API)
- ✅ Email verification with Brevo transactional emails
- ✅ User signup, signin, and account deletion
- ✅ Protected routes with JWT middleware

### Security Features (v1.0.0)
1. **Input Validation** - express-validator with password strength rules
   - Minimum 8 characters
   - Requires uppercase, lowercase, and numbers
   - Email normalization and sanitization
   - XSS prevention

2. **Failed Login Protection** - Account lockout mechanism
   - 5 failed attempts trigger 15-minute lockout
   - Automatic reset after 1 hour
   - In-memory cache + database persistence

3. **Audit Logging** - Security event tracking
   - Critical events logged to database
   - All events logged to console
   - Tracks: login failures, account locks, deletions, OAuth failures

4. **Error Sanitization** - Production-safe error messages
   - Generic error messages in production
   - Detailed errors only in development
   - No stack traces exposed

5. **CORS Whitelist** - Explicit domain validation
   - Configured via environment variables
   - Localhost allowed in development
   - No regex bypasses

6. **Secure Cookies** - Production-ready cookie configuration
   - httpOnly flag enabled
   - secure flag in production
   - sameSite: strict in production
   - Domain-scoped for subdomain sharing

7. **HTTPS Enforcement** - Required for all frontend URLs
   - Validates protocol on all redirects
   - Rejects http:// URLs

8. **Google OAuth Rollback** - Transaction safety
   - Deletes user if profile creation fails
   - Prevents orphaned records

9. **Helmet Security Headers** - HTTP security
   - HSTS with preload
   - Content Security Policy
   - XSS Protection

10. **Trust Proxy** - Production deployment support
    - Enabled in production for secure cookies
    - Supports reverse proxies and load balancers

### Database Schema
- **auth** - Supabase managed authentication table
- **profiles** - User profiles with email, full_name, avatar_url
- **audit_logs** - Security event tracking (v1.0.0)
- **login_attempts** - Failed login tracking (v1.0.0)

### API Endpoints
- `POST /api/v1/auth/signup` - User registration with email verification (accepts optional frontendUrl)
- `POST /api/v1/auth/signin` - Email/password authentication
- `GET /api/v1/auth/google` - Google OAuth redirect (uses FRONTEND_URL from environment)
- `GET /api/v1/auth/google/callback` - Google OAuth callback handler (redirects to FRONTEND_URL)
- `DELETE /api/v1/auth/delete-account` - Protected account deletion
- `GET /health` - Service health check

### Configuration
- **Environment Variables:** PORT, NODE_ENV, JWT_SECRET, SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, BREVO_API_KEY, FRONTEND_URL, CORS_WHITELIST, COOKIE_DOMAIN, REQUIRE_HTTPS
- **CORS Whitelist:** Configured via environment variable (comma-separated URLs)
- **JWT Expiry:** 1 hour for access tokens
- **Password Policy:** 8+ chars, mixed case, numbers

### File Structure (v1.0.0)
```
project/
├── server.js                    # Entry point (v1.0.0)
├── package.json                 # Dependencies and scripts (v1.0.0)
├── .env                         # Environment configuration
├── VERSION.md                   # This file
├── src/
│   ├── server.js                # Express app (v1.0.0)
│   ├── config/
│   │   ├── supabase.js          # Database client (v1.0.0)
│   │   └── security.config.js   # Security settings (v1.0.0)
│   ├── controllers/
│   │   └── auth.controller.js   # Request handlers (v1.0.0)
│   ├── middleware/
│   │   ├── auth.middleware.js   # JWT verification (v1.0.0)
│   │   └── validator.middleware.js # Input validation (v1.0.0)
│   ├── routes/
│   │   └── auth.routes.js       # API routes (v1.0.0)
│   ├── services/
│   │   ├── auth.service.js      # Auth logic (v1.0.0)
│   │   └── email.service.js     # Email service (v1.0.0)
│   └── utils/
│       ├── audit.logger.js      # Security logging (v1.0.0)
│       └── login.tracker.js     # Login tracking (v1.0.0)
├── migrations/
│   └── 001_security_tables.sql  # Security schema (v1.0.0)
├── docs/
│   ├── api.md                   # API documentation
│   └── SECURITY.md              # Security guide
├── public/
│   ├── index.html               # Local test UI
│   └── test.html                # Standalone test UI
├── scripts/
│   └── test-email.js            # Email test script (v1.0.0)
└── test.js                      # API test suite (v1.0.0)
```

### Dependencies (v1.0.0)
- **Express:** 5.2.1
- **@supabase/supabase-js:** ^2.95.3
- **jsonwebtoken:** ^9.0.3
- **axios:** ^1.13.5
- **express-validator:** ^7.3.1
- **validator:** ^13.15.26
- **helmet:** ^8.1.0
- **cookie-parser:** ^1.4.7
- **sib-api-v3-sdk:** ^8.5.0
- **cors:** ^2.8.6
- **morgan:** ^1.10.1
- **dotenv:** ^17.2.4

### Production Deployment Checklist
- [ ] Run `migrations/001_security_tables.sql` in Supabase
- [ ] Generate strong JWT_SECRET (256-bit random)
- [ ] Set NODE_ENV=production
- [ ] Update CORS whitelist with actual production domains
- [ ] Enable Supabase Row Level Security (RLS)
- [ ] Set up SSL/TLS certificates
- [ ] Configure monitoring and alerting
- [ ] Review and test all security features
- [ ] Set up database backups
- [ ] Configure rate limiting at infrastructure level (optional)

### Testing
- **Test Suite:** `npm test` - Runs comprehensive API tests
- **Email Test:** `npm run test:email` - Tests Brevo integration
- **Manual Testing:** Use public/index.html or public/test.html

### Known Limitations
- Rate limiting not implemented (recommend infrastructure-level solution)
- No refresh token rotation (future enhancement)
- Email verification not enforced on login (optional feature)

### Next Version (Planned)
- v1.1.0: Refresh token rotation
- v1.2.0: Email verification enforcement
- v1.3.0: Multi-factor authentication (MFA)
- v2.0.0: GraphQL API support
