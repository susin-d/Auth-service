-- ===================================================================
-- Migration 004: Relational Users Tables
-- ===================================================================
-- Splits single users table into normalized relational structure
-- Run this in your Neon SQL editor
-- ===================================================================

-- TABLE 1: users (core authentication)
CREATE TABLE public.users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
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

-- TABLE 2: user_profiles (profile information)
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

-- TABLE 3: user_auth_tokens (verification & reset tokens)
CREATE TABLE public.user_auth_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  token_type TEXT NOT NULL CHECK (token_type IN ('email_verification', 'password_reset')),
  token TEXT NOT NULL UNIQUE,
  expires_at TIMESTAMPTZ NOT NULL,
  used_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- TABLE 4: user_oauth (OAuth provider connections)
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

-- INDEXES: users
CREATE INDEX idx_users_email ON public.users(email);
CREATE INDEX idx_users_account_status ON public.users(account_status);
CREATE INDEX idx_users_created_at ON public.users(created_at DESC);
CREATE INDEX idx_users_email_verified ON public.users(email_verified) WHERE email_verified = false;

-- INDEXES: user_profiles
CREATE INDEX idx_user_profiles_user_id ON public.user_profiles(user_id);
CREATE INDEX idx_user_profiles_full_name ON public.user_profiles(full_name);

-- INDEXES: user_auth_tokens
CREATE INDEX idx_user_auth_tokens_user_id ON public.user_auth_tokens(user_id);
CREATE INDEX idx_user_auth_tokens_token ON public.user_auth_tokens(token);
CREATE INDEX idx_user_auth_tokens_type ON public.user_auth_tokens(token_type);
CREATE INDEX idx_user_auth_tokens_expires ON public.user_auth_tokens(expires_at) WHERE used_at IS NULL;

-- INDEXES: user_oauth
CREATE INDEX idx_user_oauth_user_id ON public.user_oauth(user_id);
CREATE INDEX idx_user_oauth_provider ON public.user_oauth(provider);
CREATE INDEX idx_user_oauth_provider_user_id ON public.user_oauth(provider_user_id);

-- ROW LEVEL SECURITY - REMOVED for Neon (Managed by Application Layer)
-- ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE public.user_profiles ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE public.user_auth_tokens ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE public.user_oauth ENABLE ROW LEVEL SECURITY;

-- FUNCTIONS
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION public.generate_auth_token()
RETURNS TEXT AS $$
BEGIN
  RETURN encode(gen_random_bytes(32), 'hex');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Auto-create profile when user is created
CREATE OR REPLACE FUNCTION public.create_user_profile()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.user_profiles (user_id)
  VALUES (NEW.id);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- TRIGGERS
CREATE TRIGGER update_users_updated_at
  BEFORE UPDATE ON public.users
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_user_profiles_updated_at
  BEFORE UPDATE ON public.user_profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_user_oauth_updated_at
  BEFORE UPDATE ON public.user_oauth
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER create_profile_on_user_insert
  AFTER INSERT ON public.users
  FOR EACH ROW
  EXECUTE FUNCTION public.create_user_profile();

-- COMMENTS
COMMENT ON TABLE public.users IS 'Core authentication data';
COMMENT ON TABLE public.user_profiles IS 'User profile information';
COMMENT ON TABLE public.user_auth_tokens IS 'Email verification and password reset tokens';
COMMENT ON TABLE public.user_oauth IS 'OAuth provider connections';

COMMENT ON COLUMN public.users.password_hash IS 'bcrypt hashed password (12 rounds) - NEVER expose in API';
COMMENT ON COLUMN public.user_auth_tokens.token IS 'Secure random token (64 hex chars)';
COMMENT ON COLUMN public.user_auth_tokens.used_at IS 'Timestamp when token was used (one-time use)';

-- PERMISSIONS
GRANT SELECT, UPDATE ON public.users TO authenticated;
GRANT INSERT ON public.users TO anon;
GRANT SELECT, INSERT, UPDATE ON public.user_profiles TO authenticated;
GRANT SELECT ON public.user_oauth TO authenticated;

-- VIEW: Complete user data (for convenience)
CREATE OR REPLACE VIEW public.users_complete AS
SELECT 
  u.id,
  u.email,
  u.email_verified,
  u.email_verified_at,
  u.account_status,
  u.last_signin_at,
  u.created_at,
  p.full_name,
  p.display_name,
  p.avatar_url,
  p.bio,
  p.date_of_birth,
  p.gender,
  p.phone_number,
  p.country,
  p.city,
  p.website_url,
  (SELECT json_agg(json_build_object(
    'provider', o.provider,
    'provider_user_id', o.provider_user_id,
    'provider_email', o.provider_email
  )) FROM public.user_oauth o WHERE o.user_id = u.id) as oauth_providers
FROM public.users u
LEFT JOIN public.user_profiles p ON u.id = p.user_id;

COMMENT ON VIEW public.users_complete IS 'Complete user data with profile and OAuth info (excludes sensitive fields)';
