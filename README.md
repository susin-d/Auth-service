# S-Auth Microservice v1.0.2

**Production-ready authentication microservice** with JWT, Google OAuth, email verification, and comprehensive security features.

## 🚀 Quick Start

**New to S-Auth? See [QUICK-START.md](QUICK-START.md) for complete setup guide!**

### Prerequisites
- Node.js 18+ installed
- Neon PostgreSQL account and database
- Google OAuth credentials
- Brevo (SendInBlue) API key

### Installation

```bash
# Install dependencies
npm install

# Create .env file from example
cp .env.example .env
# Edit .env and add your credentials

# Run database migrations
# 1. Execute migrations/001_security_tables.sql in your Neon SQL editor
# 2. Execute migrations/004_relational_users_tables.sql in your Neon SQL editor

# Start backend server (port 3000)
npm start

# In another terminal, start React test frontend (port 5173)
cd react-test
npm install
npm run dev
```

### Configuration

Copy `.env.example` to `.env` and fill in your credentials:

```bash
cp .env.example .env
```

Required variables:

```env
PORT=3000
NODE_ENV=development

# Frontend URL for redirects
FRONTEND_URL=http://localhost:3000

# Neon PostgreSQL Configuration
DATABASE_URL=postgres://user:password@hostname.neon.tech/neondb?sslmode=require

# JWT Secret (Generate: node -e "console.log(require('crypto').randomBytes(32).toString('hex'))")
JWT_SECRET=your_jwt_secret

# Google OAuth
GOOGLE_CLIENT_ID=your_google_client_id
GOOGLE_CLIENT_SECRET=your_google_client_secret

# Brevo Email Service
BREVO_API_KEY=your_brevo_api_key
BREVO_SENDER_EMAIL=noreply@yourdomain.com
BREVO_SENDER_NAME="Your App Name"
```

## 📚 API Documentation

### Base URL
```
http://localhost:3000/api/v1/auth
```

### Endpoints

#### 1. User Signup
```http
POST /signup
Content-Type: application/json

{
  "email": "user@example.com",
  "password": "Password123!",
  "frontendUrl": "https://yourdomain.com" // optional
}
```

**Response:**
```json
{
  "message": "User created",
  "user_id": "uuid"
}
```

#### 2. User Signin
```http
POST /signin
Content-Type: application/json

{
  "email": "user@example.com",
  "password": "Password123!"
}
```

**Response:**
```json
{
  "user": { "id": "uuid", "email": "user@example.com" },
  "access_token": "jwt_token",
  "refresh_token": "refresh_token"
}
```

#### 3. Google OAuth
```http
GET /google?frontend_url=https://yourdomain.com
```

**Flow:**
1. Frontend makes GET request to `/google` endpoint with `frontend_url` query parameter
2. Backend redirects browser to Google OAuth consent screen
3. User authenticates with Google
4. Google redirects back to backend callback URL: `http://localhost:3000/api/v1/auth/google/callback`
5. Backend validates token, sets authentication cookies
6. Backend redirects to the `frontend_url` provided in the request

**Example Frontend Implementation:**
```javascript
// Redirect user to Google OAuth endpoint with frontend URL
window.location.href = 'http://localhost:3000/api/v1/auth/google?frontend_url=https://yourdomain.com';
```

After redirect, cookies are set and user is authenticated on the frontend.

#### 4. Verify Email (Public)
```http
GET /verify-email?token=<verification_token>
```

**Automatic endpoint** - User clicks verification link from email.

**What happens:**
- Token verified in PostgreSQL
- Profile `email_verified` field updated
- Welcome email sent automatically
- Beautiful HTML success page displayed

**Response:** HTML page (not JSON)
- Success: Animated confirmation page
- Error: Styled error page with details

#### 5. Complete Email Verification (Protected)
```http
POST /complete-verification
Authorization: Bearer <access_token>
```

**Optional endpoint** - Verification now happens automatically via email link (endpoint #4).

After user verifies email via the link sent to their inbox, call this endpoint to:
- Check verification status
- Update profile's email_verified field
- Send welcome email

**Response:**
```json
{
  "success": true,
  "message": "Email verified successfully! Welcome email sent.",
  "profile": { ... }
}
```

**Note:** This is kept for backwards compatibility. The primary verification is now GET /verify-email.

#### 6. Delete Account (Protected)
```http
DELETE /delete-account
Authorization: Bearer <access_token>
```

**Response:**
```json
{
  "message": "Account deleted"
}
```

#### 7. Health Check
```http
GET /health
```

**Response:**
```json
{
  "status": "UP",
  "service": "auth-service"
}
```

## 🔒 Security Features

### 1. Input Validation
- Password strength requirements (8+ chars, mixed case, numbers)
- Email normalization and sanitization
- XSS prevention with validator library

### 2. Failed Login Protection
- 5 failed attempts trigger 15-minute lockout
- Automatic reset after 1 hour
- Persistent tracking across server restarts

### 3. Audit Logging
- Critical security events logged to database
- Tracks failed logins, account locks, deletions
- IP address and timestamp tracking

### 4. Secure Cookies
- httpOnly flag (prevents XSS)
- secure flag in production (HTTPS only)
- sameSite: strict in production (CSRF protection)

### 5. CORS Whitelist
- Explicit domain validation
- No regex bypasses
- Localhost allowed in development

### 6. Error Sanitization
- Generic error messages in production
- No stack traces exposed to clients
- Detailed logging for debugging

### 7. HTTPS Enforcement
- All frontend URLs must use HTTPS
- Validates protocol on redirects

### 8. Helmet Security Headers
- HSTS with preload
- Content Security Policy
- XSS Protection

See [SECURITY.md](docs/SECURITY.md) for complete security documentation.

## 🧪 Testing

### Run All Tests
```bash
npm test
```

### Test Email Service
```bash
npm run test:email
```

### Test Production Site (All Endpoints)
```bash
# Set production URL first (PowerShell)
$env:PRODUCTION_SITE_URL="https://your-backend-domain.com"
npm run test:production
```

### Manual Testing

**React Test Frontend (Recommended):**
```bash
cd react-test
npm install
npm run dev
```
Then open `http://localhost:3000` in your browser.

**Simple HTML Test:**
Open `public/index.html` in a browser for basic testing.

## 📁 Project Structure

```
S-auth/
├── server.js                    # Entry point
├── package.json                 # Dependencies
├── .env                         # Environment variables
├── VERSION.md                   # Version history
├── README.md                    # This file
├── src/
│   ├── server.js                # Express application
│   ├── config/
│   │   ├── db.js                # Database client (Neon/PG)
│   │   └── security.config.js   # Security settings
│   ├── controllers/
│   │   └── auth.controller.js   # Request handlers
│   ├── middleware/
│   │   ├── auth.middleware.js   # JWT verification
│   │   └── validator.middleware.js # Input validation
│   ├── routes/
│   │   └── auth.routes.js       # API routes
│   ├── services/
│   │   ├── auth.service.js      # Auth business logic
│   │   └── email.service.js     # Email service
│   └── utils/
│   react-test/                  # React test frontend (NEW v1.0.1)
│   ├── src/
│   │   ├── App.jsx              # Main React component
│   │   ├── main.jsx             # React entry
│   │   └── index.css            # Styles
│   ├── index.html               # HTML template
│   ├── vite.config.js           # Vite config
│   ├── package.json             # Frontend dependencies
│   └── README.md                # Frontend docs
├──     ├── audit.logger.js      # Security logging
│       └── login.tracker.js     # Login tracking
├── migrations/
│   └── 001_security_tables.sql  # Database schema
├── docs/
│   ├── api.md                   # Detailed API docs
│   └── SECURITY.md              # Security guide
├── public/
│   ├── index.html               # Local test UI
│   └── test.html                # Standalone test UI
├── scripts/
│   └── test-email.js            # Email testing
└── test.js                      # API test suite
```

## 🗄️ Database Schema

### Tables

#### users (PostgreSQL)
- Core user authentication records
- Managed by this microservice

#### profiles
```sql
id UUID PRIMARY KEY
email TEXT UNIQUE NOT NULL
full_name TEXT
avatar_url TEXT
created_at TIMESTAMPTZ
```

#### audit_logs (v1.0.0)
```sql
id UUID PRIMARY KEY
event TEXT NOT NULL
data JSONB
timestamp TIMESTAMPTZ NOT NULL
ip_address TEXT
user_id UUID
created_at TIMESTAMPTZ
```

#### login_attempts (v1.0.0)
```sql
email TEXT PRIMARY KEY
attempts INTEGER
first_attempt TIMESTAMPTZ
last_attempt TIMESTAMPTZ
locked_until TIMESTAMPTZ
ip_address TEXT
updated_at TIMESTAMPTZ
```

## 🚢 Production Deployment

### Pre-Deployment Checklist

1. **Database Migration**
   - Run all scripts in the `migrations/` folder in your Neon SQL editor.

2. **Environment Variables**
   - Generate strong JWT_SECRET (256-bit random)
   - Set NODE_ENV=production
   - Update FRONTEND_URL with production domain

3. **CORS Configuration**
   - Update `src/config/security.config.js` with actual domains
   - Remove test domains from whitelist

4. **Security Review**
   - Configure database backups in Neon dashboard
   - Set up SSL/TLS certificates
   - Configure monitoring and alerting
   - Set up database backups

5. **Testing**
   - Run full test suite: `npm test`
   - Test all endpoints with production credentials
   - Verify email delivery
   - Test Google OAuth flow

### Deployment Commands

```bash
# Production start
NODE_ENV=production npm start

# With PM2 (recommended)
pm2 start server.js --name s-auth --env production

# Docker (optional)
docker build -t s-auth .
docker run -p 3000:3000 --env-file .env s-auth
```

# React Test Frontend
cd react-test
npm install     # Install frontend dependencies
npm run dev     # Start React dev server on port 3000
npm run build   # Build for production

## 🛠️ Development

### Available Scripts

```bash
npm start       # Start server
npm run dev     # Start in development mode
npm test        # Run API tests
npm run test:email  # Test email service
npm run test:production  # Test production endpoint coverage
```

### Adding New Features

1. **New Route:** Add to `src/routes/auth.routes.js`
2. **New Controller:** Add handler to `src/controllers/auth.controller.js`
3. **New Service:** Add business logic to `src/services/auth.service.js`
4. **New Middleware:** Create in `src/middleware/`
5. **Update Tests:** Add test cases to `test.js`

## 📊 Monitoring

### Key Metrics to Track

- Request rate and response time
- Failed login attempts (audit_logs table)
- Account lockouts (login_attempts table)
- Error rates and types
- Database query performance
- JWT token generation/validation time

### Logging

- **Console:** All requests via morgan
- **Database:** Critical security events in audit_logs
- **Production:** Configure external logging service (e.g., Datadog, Sentry)

## 🐛 Troubleshooting

### Common Issues

**Error: "Not allowed by CORS"**
- Check CORS whitelist in `src/config/security.config.js`
- Ensure origin matches exactly (including protocol and subdomain)

**Error: "Account temporarily locked"**
- Failed 5+ login attempts
- Wait 15 minutes or clear login_attempts table

**Error: "Token failed"**
- JWT token expired (1 hour lifetime)
- JWT_SECRET mismatch between environments

**Email not sending**
- Check BREVO_API_KEY is valid
- Verify sender email is verified in Brevo
- Check spam folder

### Debug Mode

```bash
NODE_ENV=development npm start
```

Enables:
- Detailed error messages
- Stack traces in responses
- CORS for localhost

## 📝 License

ISC

## 👥 Author

Susindran

## 🔗 Related Documentation

- [QUICK-START.md](QUICK-START.md) - Complete setup guide for new users
- [LLM-GUIDE.md](LLM-GUIDE.md) - Guide for AI assistants working with this codebase
- [DATABASE.md](docs/DATABASE.md) - Complete database schema and password storage details
- [DATABASE-SETUP.md](docs/DATABASE-SETUP.md) - Step-by-step database enhancement guide
- [API Documentation](docs/api.md) - Complete API reference
- [Security Guide](docs/SECURITY.md) - Security features and best practices
- [Version History](VERSION.md) - Changelog and version details
- [React Frontend Docs](react-test/README.md) - Test frontend documentation

## 🤝 Contributing

1. Create feature branch
2. Add tests for new features
3. Update documentation
4. Submit pull request

## 📞 Support

For issues and questions:
- Check [docs/api.md](docs/api.md) for API details
- Review [SECURITY.md](docs/SECURITY.md) for security features
- Check database logs in audit_logs table
