-- ===================================================================
-- Migration 008: OAuth Provider Tables
-- Created: 2026-05-01
-- Description: Adds tables for S-Auth to act as an OAuth2 Authorization Server
-- ===================================================================

-- TABLE 1: oauth_clients (registered external applications)
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

-- TABLE 2: oauth_authorization_codes (temporary auth codes during consent flow)
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

-- INDEXES
CREATE INDEX idx_oauth_clients_client_id ON public.oauth_clients(client_id);
CREATE INDEX idx_oauth_clients_active ON public.oauth_clients(is_active) WHERE is_active = true;
CREATE INDEX idx_oauth_auth_codes_code ON public.oauth_authorization_codes(code);
CREATE INDEX idx_oauth_auth_codes_expires ON public.oauth_authorization_codes(expires_at) WHERE used_at IS NULL;

-- TRIGGER: auto-update updated_at
CREATE TRIGGER update_oauth_clients_updated_at
  BEFORE UPDATE ON public.oauth_clients
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- COMMENTS
COMMENT ON TABLE public.oauth_clients IS 'Registered OAuth2 client applications that can use "Sign in with S-Auth"';
COMMENT ON TABLE public.oauth_authorization_codes IS 'Temporary authorization codes issued during the OAuth2 consent flow';
COMMENT ON COLUMN public.oauth_clients.redirect_uris IS 'Array of allowed redirect URIs for the client';
COMMENT ON COLUMN public.oauth_clients.is_confidential IS 'True for server-side apps (use client_secret), false for SPAs/mobile (use PKCE)';
COMMENT ON COLUMN public.oauth_authorization_codes.code_challenge IS 'PKCE code challenge for public clients';
