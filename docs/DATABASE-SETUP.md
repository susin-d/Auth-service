# 🚀 Database Enhancement Guide

**Status:** ✅ Complete  
**Version:** 1.0.2  
**Date:** February 12, 2026

---

## ✨ What Was Added

### 1. Enhanced Profiles Table

**New Fields:**
- ✅ `full_name` - User's full name
- ✅ `phone_number` - Contact number
- ✅ `avatar_url` - Profile picture URL
- ✅ `date_of_birth` - Birth date
- ✅ `address` - JSON address object
- ✅ `bio` - User biography
- ✅ `provider` - Auth method (password/google)
- ✅ `email_verified` - Verification status
- ✅ `last_login_at` - Last login timestamp
- ✅ `updated_at` - Auto-updated timestamp

### 2. New Endpoints

- `GET /api/v1/auth/profile` - Get user profile (protected)
- `PUT /api/v1/auth/profile` - Update user profile (protected)

### 3. Documentation

- 📄 `DATABASE.md` - Complete database schema documentation
- 📄 `002_enhanced_profiles.sql` - Migration file

---

## 🔒 Password Storage Explained

### ⚠️ IMPORTANT: Where Passwords Are Stored

**Passwords ARE NOT in the `user_profiles` table!**

| Table | Purpose | Security |
|-------|---------|----------|
| `users` | **Passwords stored here** | Bcrypt hashed, application managed |
| `user_profiles` | User profile info | Linked 1:1 with users |

**Password Column:** `users.password_hash` (bcrypt hashed)

---

## 📋 Step-by-Step Setup

### Step 1: Run the Migration

1. Open **Neon Dashboard**
2. Go to **SQL Editor**
3. Copy contents of `migrations/001_security_tables.sql` and `migrations/004_relational_users_tables.sql`
4. Click **Run**

### Step 2: Verify the Migration

```sql
-- Check new columns exist
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'profiles' 
ORDER BY ordinal_position;
```

You should see all the new fields listed! ✅

### Step 3: Restart Your Backend

```powershell
# Stop the current server (Ctrl+C)
# Then restart
node src/server.js
```

---

## 🧪 Testing the New Features

### Test 1: Get Your Profile

```bash
# First, sign in to get a token
curl -X POST http://localhost:3000/api/v1/auth/signin \
  -H "Content-Type: application/json" \
  -d '{"email":"your@email.com","password":"yourPassword"}'

# Copy the access_token from response

# Then get your profile
curl http://localhost:3000/api/v1/auth/profile \
  -H "Authorization: Bearer YOUR_TOKEN_HERE"
```

**Expected Response:**
```json
{
  "id": "uuid-here",
  "email": "your@email.com",
  "full_name": null,
  "phone_number": null,
  "avatar_url": null,
  "date_of_birth": null,
  "address": null,
  "bio": null,
  "provider": "password",
  "email_verified": false,
  "last_login_at": "2026-02-12T08:30:00.000Z",
  "created_at": "2026-02-12T08:28:00.000Z",
  "updated_at": "2026-02-12T08:30:00.000Z"
}
```

### Test 2: Update Your Profile

```bash
curl -X PUT http://localhost:3000/api/v1/auth/profile \
  -H "Authorization: Bearer YOUR_TOKEN_HERE" \
  -H "Content-Type: application/json" \
  -d '{
    "full_name": "John Doe",
    "phone_number": "+1-555-0123",
    "bio": "Full-stack developer",
    "address": {
      "street": "123 Main St",
      "city": "San Francisco",
      "state": "CA",
      "zip": "94102",
      "country": "USA"
    }
  }'
```

**Expected Response:**
```json
{
  "message": "Profile updated",
  "profile": {
    "id": "uuid-here",
    "email": "your@email.com",
    "full_name": "John Doe",
    "phone_number": "+1-555-0123",
    "bio": "Full-stack developer",
    "address": {
      "street": "123 Main St",
      "city": "San Francisco",
      "state": "CA",
      "zip": "94102",
      "country": "USA"
    },
    "updated_at": "2026-02-12T08:35:00.000Z"
  }
}
```

### Test 3: View in Neon Dashboard

1. Go to **Table Editor**
2. Select **users** and **user_profiles** tables
3. See all your records! 🎉

---

## 🔍 View Password Information

### In Neon SQL Editor

```sql
-- See which users have passwords set
SELECT 
  id, 
  email, 
  password_hash IS NOT NULL as has_password,
  email_verified,
  last_signin_at,
  created_at
FROM users;
```

**What you'll see:**
- `has_password: true` ✅ - User has password
- `email_verified: true/false` - Email confirmation status
- `auth_provider: "email"` or `"google"` - Sign-up method

**Example Output:**
```
id                  | email                     | has_password | email_verified | auth_provider
--------------------|---------------------------|--------------|----------------|---------------
ca5256e0-17e1-44    | demo@insphere.com         | true         | false          | email
f6dfcd4b-4ef9-4d    | test@gmail.com            | true         | true           | email
fca683a3-947e-49    | susindran@gmail.com       | true         | false          | google
```

---

## 📱 React Frontend Testing

Add profile management to your React frontend:

```jsx
// Get Profile
const getProfile = async () => {
  try {
    const response = await axios.get('/api/v1/auth/profile', {
      headers: { Authorization: `Bearer ${token}` },
      withCredentials: true
    });
    setProfile(response.data);
  } catch (err) {
    console.error('Failed to get profile:', err);
  }
};

// Update Profile
const updateProfile = async (updates) => {
  try {
    const response = await axios.put('/api/v1/auth/profile', updates, {
      headers: { Authorization: `Bearer ${token}` },
      withCredentials: true
    });
    alert('Profile updated successfully!');
    setProfile(response.data.profile);
  } catch (err) {
    alert('Failed to update profile: ' + err.message);
  }
};
```

---

## 🎯 Common Use Cases

### Use Case 1: Complete User Registration

```javascript
// 1. Sign up
await axios.post('/api/v1/auth/signup', {
  email: 'user@example.com',
  password: 'SecurePass123!'
});

// 2. User verifies email (clicks link)

// 3. User signs in
const { data } = await axios.post('/api/v1/auth/signin', {
  email: 'user@example.com',
  password: 'SecurePass123!'
});

// 4. Complete profile
await axios.put('/api/v1/auth/profile', {
  full_name: 'Jane Smith',
  phone_number: '+1-555-9876',
  date_of_birth: '1990-05-15'
}, {
  headers: { Authorization: `Bearer ${data.access_token}` }
});
```

### Use Case 2: Google Sign-In with Auto-Profile

When users sign in with Google:
- ✅ Profile automatically created
- ✅ `full_name` populated from Google
- ✅ `avatar_url` populated with Google profile picture
- ✅ `provider` set to 'google'
- ✅ `email_verified` set to true

---

## 🗄️ Database Queries

### Get Complete User Info

```sql
SELECT 
  *
FROM users_complete
WHERE email = 'user@example.com';
```

### Update Profile Fields

```sql
UPDATE profiles
SET 
  full_name = 'John Doe',
  phone_number = '+1-555-0123',
  address = '{"street": "123 Main St", "city": "SF", "state": "CA", "zip": "94102", "country": "USA"}'::jsonb,
  bio = 'Software Engineer'
WHERE id = 'user-uuid-here';
```

### Find Users by Provider

```sql
-- Find all Google users
SELECT * FROM profiles WHERE provider = 'google';

-- Find all email/password users
SELECT * FROM profiles WHERE provider = 'password';
```

---

## 🔧 Maintenance

### Clean Up Old Login Attempts

```sql
DELETE FROM login_attempts 
WHERE last_attempt < NOW() - INTERVAL '30 days';
```

### Update Email Verification Status

```sql
-- Sync email_verified from auth.users
UPDATE profiles p
SET email_verified = (u.email_confirmed_at IS NOT NULL)
FROM auth.users u
WHERE p.id = u.id;
```

---

## 📚 Documentation References

- [DATABASE.md](DATABASE.md) - Full database schema documentation
- [SECURITY.md](SECURITY.md) - Security features
- [api.md](api.md) - API endpoints and parameters
- [LLM-GUIDE.md](LLM-GUIDE.md) - Developer guide

---

## ✅ Checklist

- [ ] Run migration `002_enhanced_profiles.sql` in Supabase
- [ ] Verify new columns exist in profiles table
- [ ] Restart backend server
- [ ] Test GET /profile endpoint
- [ ] Test PUT /profile endpoint
- [ ] Update React frontend with profile management
- [ ] Verify password storage in auth.users (SQL query)
- [ ] Test complete registration workflow

---

## 🆘 Troubleshooting

### Can't see new columns?

**Solution:** Re-run the migration file in Supabase SQL Editor

### Profile update fails?

**Check:**
1. JWT token is valid
2. User is updating their own profile (RLS policy)
3. Field names match exactly (case-sensitive)

### Can't find passwords?

**Remember:** Passwords are in `auth.users.encrypted_password`, not `profiles`!

---

**All set! Your database now has:**
- ✅ Enhanced user profiles with 10+ fields
- ✅ Automatic password hashing in auth.users
- ✅ Profile GET/PUT endpoints
- ✅ Complete documentation
- ✅ Ready for production! 🚀
