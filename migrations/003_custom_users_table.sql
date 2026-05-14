    -- ===================================================================
-- Migration 003: Custom Users Table (Clean Install)
-- ===================================================================
-- Run this in Supabase Dashboard → SQL Editor
-- ===================================================================

-- TABLE: users
CREATE TABLE public.users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  email_verified BOOLEAN DEFAULT FALSE NOT NULL,
  email_verified_at TIMESTAMPTZ,
  verification_token TEXT,
  verification_token_expires_at TIMESTAMPTZ,
  reset_token TEXT,
  reset_token_expires_at TIMESTAMPTZ,
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
  google_id TEXT UNIQUE,
  provider TEXT DEFAULT 'email' NOT NULL CHECK (provider IN ('email', 'google')),
  account_status TEXT DEFAULT 'active' NOT NULL CHECK (account_status IN ('active', 'suspended', 'deleted')),
  suspended_at TIMESTAMPTZ,
  suspended_reason TEXT,
  deleted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  last_signin_at TIMESTAMPTZ
);

-- INDEXES
CREATE INDEX idx_users_email ON public.users(email);
CREATE INDEX idx_users_google_id ON public.users(google_id) WHERE google_id IS NOT NULL;
CREATE INDEX idx_users_verification_token ON public.users(verification_token) WHERE verification_token IS NOT NULL;
CREATE INDEX idx_users_reset_token ON public.users(reset_token) WHERE reset_token IS NOT NULL;
CREATE INDEX idx_users_account_status ON public.users(account_status);
CREATE INDEX idx_users_created_at ON public.users(created_at DESC);
CREATE INDEX idx_users_email_verified ON public.users(email_verified) WHERE email_verified = false;

-- ROW LEVEL SECURITY
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own profile"
  ON public.users FOR SELECT
  USING (auth.uid() = id);

CREATE POLICY "Users can update own profile"
  ON public.users FOR UPDATE
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

-- FUNCTIONS
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION public.generate_verification_token()
RETURNS TEXT AS $$
BEGIN
  RETURN encode(gen_random_bytes(32), 'hex');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- TRIGGERS
CREATE TRIGGER update_users_updated_at
  BEFORE UPDATE ON public.users
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- COMMENTS
COMMENT ON TABLE public.users IS 'Custom users table with authentication and profile data';
COMMENT ON COLUMN public.users.password_hash IS 'bcrypt hashed password (12 rounds) - NEVER expose in API';
COMMENT ON COLUMN public.users.verification_token IS 'Email verification token - expires in 24 hours';
COMMENT ON COLUMN public.users.reset_token IS 'Password reset token - expires in 1 hour';

-- PERMISSIONS
GRANT SELECT, UPDATE ON public.users TO authenticated;
GRANT INSERT ON public.users TO anon;
