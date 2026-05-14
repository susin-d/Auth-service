# Quick Start Guide - S-Auth v1.0.1

Complete setup guide for S-Auth authentication microservice with React test frontend.

## 🚀 Quick Setup (5 minutes)

### 1. Install Backend Dependencies
```bash
npm install
```

### 2. Configure Environment
Create `.env` file in the project root:
```env
PORT=3000
NODE_ENV=development
FRONTEND_URL=http://localhost:3000

# Neon PostgreSQL (Get from https://neon.tech)
DATABASE_URL=postgres://user:password@hostname.neon.tech/neondb?sslmode=require

# JWT Secret (Generate: openssl rand -base64 32)
JWT_SECRET=your_strong_random_secret

# Google OAuth (Get from https://console.cloud.google.com)
GOOGLE_CLIENT_ID=your_client_id
GOOGLE_CLIENT_SECRET=your_client_secret

# Brevo Email (Get from https://www.brevo.com)
BREVO_API_KEY=your_brevo_api_key
BREVO_SENDER_EMAIL=noreply@yourdomain.com
BREVO_SENDER_NAME="Your Service"
```

### 3. Setup Database
1. Go to Neon Dashboard → SQL Editor
2. Copy content from `migrations/001_security_tables.sql`
3. Execute the SQL to create tables
4. Execute `migrations/004_relational_users_tables.sql`

### 4. Start Backend Server
```bash
npm start
```
Server runs on `http://localhost:3000`

### 5. Setup React Test Frontend
**Windows (PowerShell):**
```powershell
.\setup-react-test.ps1
cd react-test
npm run dev
```

**Linux/Mac:**
```bash
chmod +x setup-react-test.sh
./setup-react-test.sh
cd react-test
npm run dev
```

**Manual Setup:**
```bash
cd react-test
npm install
npm run dev
```

Frontend runs on `http://localhost:3000`

### 6. Test the APIs 🎉
Open `http://localhost:3000` in your browser to see the landing page.
Open `http://localhost:3000/dashboard` for the user dashboard (sign in, manage profile, OAuth apps, security settings).

Test endpoints:
- ✅ User Signup
- ✅ User Signin
- ✅ User Dashboard
- ✅ Google OAuth
- ✅ Delete Account

---

## 📋 Detailed Setup

### Prerequisites
- Node.js 18+ ([Download](https://nodejs.org/))
- Neon PostgreSQL account ([Sign up](https://neon.tech))
- Google OAuth credentials ([Console](https://console.cloud.google.com))
- Brevo account ([Sign up](https://www.brevo.com))

### Backend Configuration

#### 1. Neon PostgreSQL Setup
1. Create a new project at [neon.tech](https://neon.tech)
2. Go to Dashboard and copy the connection string.
3. Add it to `.env` as `DATABASE_URL`.

#### 2. Google OAuth Setup
1. Go to [Google Cloud Console](https://console.cloud.google.com)
2. Create a new project (or select existing)
3. Enable Google+ API
4. Go to Credentials > Create Credentials > OAuth 2.0 Client ID
5. Application type: Web application
6. Authorized redirect URIs:
   - `http://localhost:3000/api/v1/auth/google/callback` (development)
   - `https://yourdomain.com/api/v1/auth/google/callback` (production)
7. Copy:
   - Client ID → `GOOGLE_CLIENT_ID`
   - Client Secret → `GOOGLE_CLIENT_SECRET`

#### 3. Brevo Email Setup
1. Create account at [brevo.com](https://www.brevo.com)
2. Go to SMTP & API > API Keys
3. Create new API key
4. Copy API key → `BREVO_API_KEY`
5. Verify your sender email in Senders section

#### 4. Generate JWT Secret
```bash
# Linux/Mac
openssl rand -base64 32

# Windows PowerShell
[Convert]::ToBase64String((1..32 | ForEach-Object { Get-Random -Maximum 256 }))
```

### Database Migration

1. Open Neon SQL Editor
2. Copy content from `migrations/001_security_tables.sql` and `004_relational_users_tables.sql`
3. Run the SQL scripts
4. Verify tables created:
   - `audit_logs`
   - `login_attempts`
   - `users`
   - `user_profiles`

---

## 🧪 Testing

### Automated Tests
```bash
# Run all API tests
npm test

# Test email service
npm run test:email
```

### Manual Testing Options

**Option 1: React Frontend (Recommended)**
```bash
cd react-test
npm run dev
```
Open `http://localhost:3000`

**Option 2: API Tester**
Open `http://localhost:3000/api-tester.html` in browser — interactive tool to test all endpoints

**Option 3: Simple HTML**
Open `public/index.html` in browser

**Option 4: cURL/Postman**
Use API documentation from `docs/api.md`

---

## 🔒 Security Checklist

Before going to production:

- [ ] Generate strong JWT_SECRET (256-bit)
- [ ] Set `NODE_ENV=production`
- [ ] Update CORS whitelist in `src/config/security.config.js`
- [ ] Set `NODE_ENV=production`
- [ ] Set up SSL/TLS certificates
- [ ] Configure monitoring/alerting
- [ ] Review `docs/SECURITY.md`
- [ ] Test all endpoints with production credentials
- [ ] Set up database backups

---

## 📁 Project Structure

```
S-auth/
├── server.js                 # Entry point
├── package.json              # Backend dependencies
├── .env                      # Configuration (create this)
├── QUICK-START.md           # This file
├── setup-react-test.ps1     # Windows setup script
├── setup-react-test.sh      # Linux/Mac setup script
│
├── src/                     # Backend source code
│   ├── server.js
│   ├── config/
│   ├── controllers/
│   ├── middleware/
│   ├── routes/
│   ├── services/
│   └── utils/
│
├── react-test/              # React test frontend
│   ├── src/
│   │   ├── App.jsx
│   │   ├── main.jsx
│   │   └── index.css
│   ├── package.json
│   └── vite.config.js
│
├── migrations/              # Database migrations
├── docs/                    # Documentation
├── public/                  # HTML test pages
└── test.js                 # Automated tests
```

---

## 🆘 Troubleshooting

### Backend won't start
- Check `.env` file exists and has all required variables
- Verify Database credentials are correct
- Ensure port 3000 is not in use

### React frontend shows "Server Offline"
- Ensure backend is running on port 3000
- Check `npm start` in main directory
- Verify health endpoint: `http://localhost:3000/health`

### CORS errors
- Add `http://localhost:3000` to CORS whitelist for development
- Check `src/config/security.config.js`

### Google OAuth fails
- Verify redirect URI in Google Console matches exactly
- Check `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET` in `.env`
- Ensure callback URL: `http://localhost:3000/api/v1/auth/google/callback`

### Email not sending
- Verify `BREVO_API_KEY` is valid
- Check sender email is verified in Brevo dashboard
- Look for error logs in backend console

### Database errors
- Check Neon connection in dashboard
- Verify `DATABASE_URL` is correct

---

## 📚 Documentation

- [README.md](README.md) - Complete project documentation
- [LLM-GUIDE.md](LLM-GUIDE.md) - Guide for AI assistants (debugging, patterns, best practices)
- [API Documentation](docs/api.md) - API endpoints and examples
- [Security Guide](docs/SECURITY.md) - Security features and best practices
- [Version History](VERSION.md) - Changelog and releases
- [React Frontend README](react-test/README.md) - Frontend documentation

---

## 🎯 Next Steps

After setup:

1. **Test all endpoints** using React frontend
2. **Review security settings** in `docs/SECURITY.md`
3. **Customize CORS whitelist** for your domains
4. **Set up production environment** with strong secrets
5. **Configure monitoring** and alerting
6. **Deploy to production** following deployment guide

---

## 💡 Tips

- Use React frontend for comprehensive testing
- Keep `.env` file secure (never commit to git)
- Monitor `audit_logs` table for security events
- Check `login_attempts` for potential attacks
- Review logs regularly for suspicious activity
- Generate new JWT_SECRET for production
- Use environment-specific `.env` files

---

## 📞 Support

For issues and questions:
- Check [docs/api.md](docs/api.md) for API details
- Review [SECURITY.md](docs/SECURITY.md) for security features
- Check database logs in `audit_logs` table
- Review console logs for detailed errors

---

**Version:** 1.0.1  
**Status:** Production Ready ✅  
**Last Updated:** February 12, 2026
