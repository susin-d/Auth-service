# Starviel Authentication - Complete Setup & Integration Guide

Welcome to **Starviel Authentication** — a production-ready OAuth 2.0 provider and JWT-based authentication microservice.

## 📋 Table of Contents

1. [What is Starviel Auth?](#what-is-starviel-auth)
2. [Features](#features)
3. [Quick Start](#quick-start)
4. [For End Users](#for-end-users)
5. [For Developers](#for-developers)
6. [For DevOps](#for-devops)
7. [Troubleshooting](#troubleshooting)

---

## What is Starviel Auth?

Starviel Auth is a **centralized authentication service** that enables:

- **End Users:** Sign in with email/password or Google OAuth
- **Developers:** Build apps that use "Continue with Starviel" for user authentication
- **Organizations:** Unified identity management across multiple applications

### Real-World Use Case

```
┌─────────────────────────────────────────────────────────────┐
│                    User's Browser                            │
└─────────────────────────────────────────────────────────────┘
                          │
                          │ clicks "Continue with Starviel"
                          ▼
┌─────────────────────────────────────────────────────────────┐
│              Third-Party App (e.g., Blog, CMS)              │
│                  https://myblog.com                          │
└─────────────────────────────────────────────────────────────┘
                          │
                          │ redirects to
                          ▼
┌─────────────────────────────────────────────────────────────┐
│         Starviel OAuth Authorization Server                  │
│              http://localhost:3000/oauth/...                │
│     1. User logs in with dhanayendran@gmail.com             │
│     2. User grants "Blog App" permission to access profile  │
│     3. Server returns authorization code                    │
└─────────────────────────────────────────────────────────────┘
                          │
                          │ redirects back to
                          ▼
┌─────────────────────────────────────────────────────────────┐
│                   Blog App Callback                          │
│         /callback?code=119bfe990c2caa45...&state=xyz        │
└─────────────────────────────────────────────────────────────┘
                          │
                          │ backend sends code to Starviel
                          ▼
┌─────────────────────────────────────────────────────────────┐
│   Starviel Token Exchange: POST /oauth/token                │
│   Receives: client_id + client_secret + code                │
│   Returns: access_token                                      │
└─────────────────────────────────────────────────────────────┘
                          │
                          │ backend retrieves user info
                          ▼
┌─────────────────────────────────────────────────────────────┐
│   Starviel User Info: GET /oauth/userinfo                   │
│   Returns: {sub, email, name, picture}                      │
└─────────────────────────────────────────────────────────────┘
                          │
                          │ creates session/JWT
                          ▼
┌─────────────────────────────────────────────────────────────┐
│         User is now logged into Blog App!                   │
│     Access granted to all blog features                     │
└─────────────────────────────────────────────────────────────┘
```

---

## 🌟 Features

### ✅ User Authentication
- Email/password registration with validation
- Secure password hashing (bcrypt)
- JWT-based session tokens (1-hour expiration)
- Email verification required for account activation
- Failed login tracking with account lockout (15 min after 5 attempts)

### ✅ OAuth 2.0 Provider
- Authorization Code flow (RFC 6749)
- PKCE support for public clients (RFC 7636)
- Multiple redirect URI support
- Scope-based permission system (`profile`, `email`)
- Authorization code expires after 10 minutes (single-use)

### ✅ Google OAuth Integration
- "Sign in with Google" functionality
- Automatic user account creation
- Linked OAuth provider management

### ✅ Security
- HTTPS-ready with SSL certificate validation
- CORS protection with origin whitelist
- Helmet.js security headers
- Content Security Policy (CSP)
- CSRF tokens on forms
- SQL injection prevention via parameterized queries
- XSS protection

### ✅ Audit & Logging
- Login/logout event tracking
- Failed attempt logging
- Admin action audit trails
- Device/IP tracking

### ✅ Email Notifications
- Welcome email with verification link
- Verification expiration (24 hours)
- Integration with Brevo (SendInBlue)

---

## 🚀 Quick Start

### For Users: Sign Up & Test the System

1. **Open API Tester:**
   ```
   http://localhost:3000/api-tester.html
   ```

2. **Sign Up:**
   - Email: `your-email@example.com`
   - Password: `SecurePassword123!`
   - Click "Sign Up"

3. **Verify Email:**
   - Copy verification token from console/logs
   - Paste in "Verify Email" section
   - Click "Verify Email"

4. **Sign In:**
   - Use your email and password
   - Click "Sign In"
   - ✅ See your JWT access token!

### For Developers: Register an App

1. **Sign In** (complete steps above)

2. **Register OAuth App:**
   - Scroll to "Starviel OAuth Provider"
   - Enter App Name: `My Test App`
   - Enter Redirect URI: `http://localhost:3000/api-tester.html`
   - Click "Register App"
   - Save your `client_id` and `client_secret`!

3. **Test OAuth Flow:**
   - Click "Start OAuth Flow"
   - Log in and approve access
   - System returns authorization code
   - Click "Exchange Code" to get token
   - Click "Get User Info" to see profile

---

## 👥 For End Users

### Sign Up
1. Visit your app and click "Sign Up with Starviel"
2. Enter email and password
3. Check your email for verification link
4. Click link to verify account
5. ✅ You're ready to log in!

### Sign In Options
**Option A: Email & Password**
- Click "Sign In with Email"
- Enter credentials
- Approve device (if required)

**Option B: Google**
- Click "Sign In with Google"
- Approve Starviel access
- ✅ Automatically logged in!

### Manage Account
- View profile information
- Update name, bio, location
- Change password
- View connected accounts (Google, etc.)
- Delete account

---

## 👨‍💻 For Developers

### Step 1: Register Your App

**Via Dashboard (Recommended):**
1. Sign in to your Starviel account
2. Go to Developer Settings
3. Click "Create New App"
4. Fill in details and get credentials

**Via API:**
```bash
curl -X POST http://localhost:3000/api/v1/auth/developer/apps \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "client_name": "My App",
    "redirect_uris": ["http://localhost:3000/callback"]
  }'
```

### Step 2: Implement OAuth Button

**React Example:**
```jsx
function LoginPage() {
  const handleContinueWithStarviel = () => {
    const state = Math.random().toString(36).substring(7);
    sessionStorage.setItem('oauthState', state);

    const authUrl = new URL('http://localhost:3000/oauth/authorize');
    authUrl.searchParams.append('client_id', 'YOUR_CLIENT_ID');
    authUrl.searchParams.append('redirect_uri', 'http://localhost:3000/callback');
    authUrl.searchParams.append('response_type', 'code');
    authUrl.searchParams.append('scope', 'profile email');
    authUrl.searchParams.append('state', state);

    window.location.href = authUrl.toString();
  };

  return (
    <button 
      onClick={handleContinueWithStarviel}
      style={{ backgroundColor: '#a855f7', color: 'white' }}
    >
      Continue with Starviel
    </button>
  );
}
```

### Step 3: Handle Callback

**Backend (Node.js):**
```javascript
app.get('/callback', async (req, res) => {
  const { code, state } = req.query;

  // Verify state
  if (state !== req.session.oauthState) {
    return res.status(403).send('Invalid state');
  }

  // Exchange code for token
  const tokenRes = await axios.post('http://localhost:3000/oauth/token', {
    grant_type: 'authorization_code',
    code,
    client_id: 'YOUR_CLIENT_ID',
    client_secret: 'YOUR_CLIENT_SECRET'
  });

  const accessToken = tokenRes.data.access_token;

  // Get user info
  const userRes = await axios.get('http://localhost:3000/oauth/userinfo', {
    headers: { Authorization: `Bearer ${accessToken}` }
  });

  // Create session
  req.session.user = userRes.data;
  res.redirect('/dashboard');
});
```

### Complete Integration Examples
See [OAUTH-PROVIDER.md](./OAUTH-PROVIDER.md) for:
- Node.js/Express
- React/Next.js
- Python/Flask
- And more!

---

## 🛠 For DevOps

### Prerequisites
- Node.js 18+
- PostgreSQL 12+ (or Neon)
- Email service (Brevo/SendInBlue)
- Google OAuth credentials (optional)

### Installation

```bash
# Clone repo
git clone https://github.com/susindran/starviel.git
cd Auth

# Install dependencies
npm install

# Configure environment
cp .env.example .env
# Edit .env with your credentials

# Run migrations
psql -U postgres -d your_db -f migrations/001_security_tables.sql
psql -U postgres -d your_db -f migrations/004_relational_users_tables.sql

# Start service
npm start
```

### Environment Variables

```env
# Server
PORT=3000
NODE_ENV=production

# Database
DATABASE_URL=postgresql://user:pass@host/db

# JWT
JWT_SECRET=your-512-bit-random-secret

# Google OAuth
GOOGLE_CLIENT_ID=your-client-id
GOOGLE_CLIENT_SECRET=your-client-secret

# Email (Brevo)
BREVO_API_KEY=your-api-key
BREVO_EMAIL=noreply@yourdomain.com

# Security
CORS_WHITELIST=http://localhost:3000,https://myapp.com

# URLs
FRONTEND_URL=http://localhost:3000
```

### Production Deployment

```bash
# Build for production
npm run build

# Use process manager (PM2)
pm2 start src/server.js --name "starviel-auth" --watch

# Or use Docker
docker build -t starviel-auth .
docker run -p 3000:3000 \
  -e DATABASE_URL=postgresql://... \
  -e JWT_SECRET=... \
  starviel-auth
```

### Monitoring

```bash
# Check server health
curl http://localhost:3000/health

# View logs
pm2 logs starviel-auth

# Monitor performance
pm2 monit
```

### Database Backups

```bash
# Backup
pg_dump postgresql://user:pass@host/db > backup.sql

# Restore
psql postgresql://user:pass@host/db < backup.sql
```

---

## ⚠️ Troubleshooting

### "Email already exists"
- Email is registered
- Sign in with that email or use a different email

### "Invalid verification token"
- Token has expired (24-hour limit)
- Click "Resend Verification" to get new token

### "Account locked"
- Too many failed login attempts
- Wait 15 minutes then try again
- Or reset password via email

### "Connection timeout"
- Check database connectivity
- Verify `DATABASE_URL` is correct
- Ensure Neon database is running

### "Email not sending"
- Verify Brevo API key is correct
- Check email is from verified domain
- Review Brevo logs

### OAuth Flow Not Working
- Verify `client_id` is correct
- Check `redirect_uri` matches exactly
- Ensure scopes are: `profile` or `email`
- Verify browser allows popups

### CORS Errors
- Check `CORS_WHITELIST` includes your origin
- In development, localhost is automatically allowed
- Ensure exact protocol match (http vs https)

---

## 📞 Support

- **Docs:** https://docs.starviel.io
- **Email:** support@starviel.io
- **GitHub:** https://github.com/susindran/starviel
- **Status:** https://status.starviel.io

---

## 📜 License

This project is part of the Starviel platform and follows the project license.

---

**Ready to integrate? Start with [OAUTH-PROVIDER.md](./OAUTH-PROVIDER.md)!** 🚀
