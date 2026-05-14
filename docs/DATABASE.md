# Database Schema Documentation

**Version:** 2.0.0  
**Last Updated:** April 30, 2026

---

## 📋 Table of Contents
1. [Overview](#overview)
2. [Database Provider](#database-provider)
3. [Tables Structure](#tables-structure)
4. [Migrations](#migrations)
5. [Security & Access Control](#security--access-control)

---

## Overview

S-Auth uses **PostgreSQL (Neon)** for all authentication and user data. Unlike the previous version which relied on Supabase Auth, this service manages its own authentication tables, providing full control over the user lifecycle and data structure.

---

## Database Provider

- **Provider**: Neon PostgreSQL
- **Connection Strategy**: Connection Pooling via `pg.Pool`
- **Security**: SSL enabled for all connections
- **Migrations**: SQL-based migrations tracked in the `migrations/` directory

---

## Tables Structure

### 1. `public.users`

**Purpose:** Core authentication and account data.

| Column | Type | Description |
|--------|------|-------------|
| id | uuid | Primary key (generated via gen_random_uuid()) |
| email | text | User email (Unique, Indexed) |
| password_hash | text | Bcrypt hashed password |
| role | text | User role (admin/user) |
| account_status | text | active, suspended, deleted |
| email_verified | boolean | Verification status |
| email_verified_at| timestamptz | When email was verified |
| last_signin_at | timestamptz | Last successful login |
| created_at | timestamptz | Account creation time |
| updated_at | timestamptz | Record last update time |

---

### 2. `public.user_profiles`

**Purpose:** Extended profile information. Linked 1:1 with `users`.

| Column | Type | Description |
|--------|------|-------------|
| user_id | uuid | Foreign key (references users.id, ON DELETE CASCADE) |
| full_name | text | User's full name |
| display_name | text | Public display name |
| avatar_url | text | Profile picture URL |
| bio | text | User biography |
| phone_number | text | Contact number |
| country | text | Country code/name |
| city | text | City name |
| website_url | text | Personal/company website |
| created_at | timestamptz | Profile creation time |
| updated_at | timestamptz | Last update time |

---

### 3. `public.user_auth_tokens`

**Purpose:** Email verification and password reset tokens.

| Column | Type | Description |
|--------|------|-------------|
| id | uuid | Primary key |
| user_id | uuid | Foreign key (references users.id) |
| token_type | text | email_verification, password_reset |
| token | text | Unique random token |
| expires_at | timestamptz | Token expiration time |
| used_at | timestamptz | When the token was consumed |
| created_at | timestamptz | Token generation time |

---

### 4. `public.user_oauth`

**Purpose:** Third-party authentication connections (e.g., Google).

| Column | Type | Description |
|--------|------|-------------|
| id | uuid | Primary key |
| user_id | uuid | Foreign key (references users.id) |
| provider | text | e.g., 'google' |
| provider_user_id | text | External ID from provider |
| provider_email | text | Email from provider |
| access_token | text | OAuth access token |
| refresh_token | text | OAuth refresh token |
| token_expires_at| timestamptz | Token expiration |
| created_at | timestamptz | Connection time |

---

### 5. `public.audit_logs` & `login_attempts`

**Purpose:** Security monitoring and brute-force protection.
These tables track security-sensitive events (logins, failures, deletions) and manage temporary IP/Account lockouts.

---

## Migrations

### Migration Files
1. **`001_security_tables.sql`**: Initial setup of audit and tracking tables.
2. **`004_relational_users_tables.sql`**: Core authentication schema (users, profiles, tokens, oauth).

### Execution
Run these scripts in your PostgreSQL client (e.g., Neon SQL Editor).

---

## Security & Access Control

### Authorization Model
- **No RLS**: Row Level Security is NOT used in the database layer.
- **Application Logic**: Authorization is enforced in the `AuthService` and `auth.middleware.js`.
- **Ownership Check**: For sensitive operations (e.g., `updateProfile`), the backend uses the `sub` (User ID) from the verified JWT.

### Password Security
- **Algorithm**: bcrypt
- **Salt Rounds**: 10 (configured in `AuthService.js`)
- **Storage**: `users.password_hash`

---

**For more information:**
- [SECURITY.md](SECURITY.md) - S-Auth security features
- [API Documentation](api.md) - API endpoints and examples
