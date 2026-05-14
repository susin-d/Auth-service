/**
 * Security Tables Migration - v1.0.1
 * Database schema for audit logging and login tracking
 * Run this in your Neon SQL editor
 */

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 1. Audit Logs Table
CREATE TABLE IF NOT EXISTS audit_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  event TEXT NOT NULL,
  data JSONB,
  timestamp TIMESTAMPTZ NOT NULL,
  ip_address TEXT,
  user_id UUID,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_audit_logs_event ON audit_logs(event);
CREATE INDEX IF NOT EXISTS idx_audit_logs_user_id ON audit_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_timestamp ON audit_logs(timestamp DESC);

-- 2. Login Attempts Table
CREATE TABLE IF NOT EXISTS login_attempts (
  email TEXT PRIMARY KEY,
  attempts INTEGER DEFAULT 0,
  first_attempt TIMESTAMPTZ NOT NULL,
  last_attempt TIMESTAMPTZ NOT NULL,
  locked_until TIMESTAMPTZ,
  ip_address TEXT,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_login_attempts_locked_until ON login_attempts(locked_until);

-- 3. Enable Row Level Security (RLS) - REMOVED for Neon
-- ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE login_attempts ENABLE ROW LEVEL SECURITY;

-- 6. Add full_name and avatar_url to profiles if not exists
DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_name='profiles' AND column_name='full_name') THEN
    ALTER TABLE profiles ADD COLUMN full_name TEXT;
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_name='profiles' AND column_name='avatar_url') THEN
    ALTER TABLE profiles ADD COLUMN avatar_url TEXT;
  END IF;
END $$;
