-- ===================================================================
-- Starviel Auth: Final Consolidated Schema
-- Version: 1.2.0
-- Description: Complete database structure for the authentication microservice.
-- Includes: Users, Profiles, OAuth, Audit Logs, and Security Tracking.
-- ===================================================================

-- 0. CLEANUP (Optional - Uncomment if you want a fresh start)
/*
DROP VIEW IF EXISTS public.users_complete CASCADE;
DROP TABLE IF EXISTS public.login_attempts CASCADE;
DROP TABLE IF EXISTS public.audit_logs CASCADE;
DROP TABLE IF EXISTS public.user_oauth CASCADE;
DROP TABLE IF EXISTS public.user_auth_tokens CASCADE;
DROP TABLE IF EXISTS public.user_profiles CASCADE;
DROP TABLE IF EXISTS public.users CASCADE;
DROP FUNCTION IF EXISTS public.create_user_profile() CASCADE;
DROP FUNCTION IF EXISTS public.generate_auth_token() CASCADE;
DROP FUNCTION IF EXISTS public.update_updated_at_column() CASCADE;
*/

-- 1. EXTENSIONS
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- 2. CORE AUTHENTICATION: users
CREATE TABLE public.users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  role VARCHAR(20) DEFAULT 'user' CHECK (role IN ('user', 'admin')),
  email_verified BOOLEAN DEFAULT FALSE NOT NULL,
  email_verified_at TIMESTAMPTZ,
  account_status TEXT DEFAULT 'active' NOT NULL CHECK (account_status IN ('active', 'suspended', 'deleted')),
  suspended_at TIMESTAMPTZ,
  suspended_reason TEXT,
  deleted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  last_signin_at TIMESTAMPTZ
);

-- 3. USER PROFILES
CREATE TABLE public.user_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  full_name TEXT,
  display_name TEXT,
  avatar_url TEXT,
  bio TEXT,
  date_of_birth DATE,
  gender TEXT CHECK (gender IN ('male', 'female', 'non-binary', 'prefer-not-to-say')),
  phone_number TEXT,
  country TEXT,
  city TEXT,
  website_url TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  UNIQUE(user_id)
);

-- 4. AUTH TOKENS (Verification, Reset, OAuth)
CREATE TABLE public.user_auth_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES public.users(id) ON DELETE CASCADE, -- NULL allowed for OAuth CSRF
  token_type TEXT NOT NULL CHECK (token_type IN ('email_verification', 'password_reset', 'oauth_csrf', 'oauth_code')),
  token TEXT NOT NULL UNIQUE,
  expires_at TIMESTAMPTZ NOT NULL,
  used_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- 5. OAUTH CONNECTIONS
CREATE TABLE public.user_oauth (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  provider TEXT NOT NULL CHECK (provider IN ('google', 'github', 'facebook', 'apple')),
  provider_user_id TEXT NOT NULL,
  provider_email TEXT,
  provider_avatar_url TEXT,
  provider_name TEXT,
  access_token TEXT,
  refresh_token TEXT,
  token_expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  UNIQUE(provider, provider_user_id),
  UNIQUE(user_id, provider)
);

-- 6. SECURITY: Audit Logs
CREATE TABLE public.audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event TEXT NOT NULL,
  data JSONB,
  timestamp TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  ip_address INET,
  user_id UUID REFERENCES public.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- 7. SECURITY: Login Attempts
CREATE TABLE public.login_attempts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT NOT NULL,
  ip_address INET,
  success BOOLEAN DEFAULT FALSE NOT NULL,
  attempted_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- 8. INDEXES
-- Users
CREATE INDEX idx_users_email ON public.users(email);
CREATE INDEX idx_users_role ON public.users(role);
CREATE INDEX idx_users_account_status ON public.users(account_status);
CREATE INDEX idx_users_created_at ON public.users(created_at DESC);

-- Profiles
CREATE INDEX idx_user_profiles_user_id ON public.user_profiles(user_id);
CREATE INDEX idx_user_profiles_full_name ON public.user_profiles(full_name);

-- Tokens
CREATE INDEX idx_user_auth_tokens_token ON public.user_auth_tokens(token);
CREATE INDEX idx_user_auth_tokens_type_expires ON public.user_auth_tokens(token_type, expires_at) WHERE used_at IS NULL;

-- OAuth
CREATE INDEX idx_user_oauth_user_id ON public.user_oauth(user_id);
CREATE INDEX idx_user_oauth_provider_uid ON public.user_oauth(provider, provider_user_id);

-- Audit & Login Tracking
CREATE INDEX idx_audit_logs_event ON public.audit_logs(event);
CREATE INDEX idx_audit_logs_timestamp ON public.audit_logs(timestamp DESC);
CREATE INDEX idx_login_attempts_email_time ON public.login_attempts(email, attempted_at DESC);

-- 9. FUNCTIONS & TRIGGERS
-- Update updated_at timestamp
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Auto-create profile on user creation
CREATE OR REPLACE FUNCTION public.create_user_profile()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.user_profiles (user_id)
  VALUES (NEW.id);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Assign Triggers
CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON public.users FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_user_profiles_updated_at BEFORE UPDATE ON public.user_profiles FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_user_oauth_updated_at BEFORE UPDATE ON public.user_oauth FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER create_profile_on_user_insert AFTER INSERT ON public.users FOR EACH ROW EXECUTE FUNCTION public.create_user_profile();

-- 10. VIEWS
CREATE OR REPLACE VIEW public.users_complete AS
SELECT 
  u.id,
  u.email,
  u.role,
  u.email_verified,
  u.email_verified_at,
  u.account_status,
  u.last_signin_at,
  u.created_at,
  p.full_name,
  p.display_name,
  p.avatar_url,
  p.bio,
  p.phone_number,
  p.country,
  p.city,
  (SELECT json_agg(json_build_object(
    'provider', o.provider,
    'provider_user_id', o.provider_user_id
  )) FROM public.user_oauth o WHERE o.user_id = u.id) as oauth_providers
FROM public.users u
LEFT JOIN public.user_profiles p ON u.id = p.user_id;

-- 11. COMMENTS
COMMENT ON TABLE public.users IS 'Core authentication data';
COMMENT ON TABLE public.user_profiles IS 'Detailed user profile information';
COMMENT ON TABLE public.audit_logs IS 'Security and administrative audit trail';
COMMENT ON VIEW public.users_complete IS 'Unified view of user and profile data (excluding sensitive hashes)';

-- ===================================================================
-- 12. OAUTH PROVIDER TABLES
-- ===================================================================

-- Registered external applications
CREATE TABLE public.oauth_clients (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id VARCHAR(64) UNIQUE NOT NULL,
  client_secret VARCHAR(128) NOT NULL,
  client_name VARCHAR(255) NOT NULL,
  client_description TEXT,
  logo_url TEXT,
  redirect_uris TEXT[] NOT NULL,
  scopes TEXT[] DEFAULT ARRAY['profile', 'email'],
  is_active BOOLEAN DEFAULT TRUE NOT NULL,
  is_confidential BOOLEAN DEFAULT TRUE NOT NULL,
  created_by UUID REFERENCES public.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- Temporary authorization codes
CREATE TABLE public.oauth_authorization_codes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code VARCHAR(128) UNIQUE NOT NULL,
  client_id VARCHAR(64) NOT NULL REFERENCES public.oauth_clients(client_id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  redirect_uri TEXT NOT NULL,
  scopes TEXT[] NOT NULL,
  code_challenge VARCHAR(128),
  code_challenge_method VARCHAR(10) DEFAULT 'S256',
  state TEXT,
  expires_at TIMESTAMPTZ NOT NULL,
  used_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

CREATE INDEX idx_oauth_clients_client_id ON public.oauth_clients(client_id);
CREATE INDEX idx_oauth_auth_codes_code ON public.oauth_authorization_codes(code);
CREATE INDEX idx_oauth_auth_codes_expires ON public.oauth_authorization_codes(expires_at) WHERE used_at IS NULL;

CREATE TRIGGER update_oauth_clients_updated_at BEFORE UPDATE ON public.oauth_clients FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

COMMENT ON TABLE public.oauth_clients IS 'Registered OAuth2 client applications for "Sign in with S-Auth"';
COMMENT ON TABLE public.oauth_authorization_codes IS 'Temporary authorization codes for the OAuth2 consent flow';
