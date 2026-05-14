-- ===================================================================
-- Migration 005: Audit and Login Tracking Tables
-- ===================================================================
-- Adds security audit logs and login attempt tracking
-- Run this in Supabase Dashboard → SQL Editor
-- ===================================================================

-- TABLE 1: audit_logs (security event logging)
CREATE TABLE public.audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event TEXT NOT NULL,
  data JSONB,
  timestamp TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  ip_address INET,
  user_id UUID REFERENCES public.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- TABLE 2: login_attempts (failed login tracking)
CREATE TABLE public.login_attempts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT NOT NULL,
  ip_address INET,
  success BOOLEAN DEFAULT FALSE NOT NULL,
  attempted_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- INDEXES: audit_logs
CREATE INDEX idx_audit_logs_event ON public.audit_logs(event);
CREATE INDEX idx_audit_logs_user_id ON public.audit_logs(user_id);
CREATE INDEX idx_audit_logs_timestamp ON public.audit_logs(timestamp DESC);
CREATE INDEX idx_audit_logs_ip_address ON public.audit_logs(ip_address);

-- INDEXES: login_attempts
CREATE INDEX idx_login_attempts_email ON public.login_attempts(email);
CREATE INDEX idx_login_attempts_ip_address ON public.login_attempts(ip_address);
CREATE INDEX idx_login_attempts_attempted_at ON public.login_attempts(attempted_at DESC);
CREATE INDEX idx_login_attempts_email_time ON public.login_attempts(email, attempted_at DESC);

-- ROW LEVEL SECURITY
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.login_attempts ENABLE ROW LEVEL SECURITY;

-- RLS POLICIES: audit_logs (backend/admin only)
CREATE POLICY "No direct access to audit logs"
  ON public.audit_logs FOR ALL
  USING (false);

-- RLS POLICIES: login_attempts (backend/admin only)
CREATE POLICY "No direct access to login attempts"
  ON public.login_attempts FOR ALL
  USING (false);

-- COMMENTS
COMMENT ON TABLE public.audit_logs IS 'Security event audit trail for compliance and monitoring';
COMMENT ON TABLE public.login_attempts IS 'Failed login tracking for brute-force protection';

COMMENT ON COLUMN public.audit_logs.data IS 'JSON object containing event details and context';
COMMENT ON COLUMN public.audit_logs.ip_address IS 'IP address of the request (INET type for efficient indexing and querying)';

COMMENT ON COLUMN public.login_attempts.ip_address IS 'IP address of the login attempt (INET type)';
COMMENT ON COLUMN public.login_attempts.success IS 'Whether the login attempt succeeded';

-- PERMISSIONS
GRANT INSERT ON public.audit_logs TO authenticated, anon;
GRANT INSERT ON public.login_attempts TO authenticated, anon;
