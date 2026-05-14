-- Migration: Add OAuth token types
-- Created: 2026-05-01
-- Description: Adds oauth_csrf and oauth_code token types for secure OAuth flow

-- Update the token_type constraint to include new types
ALTER TABLE user_auth_tokens
DROP CONSTRAINT IF EXISTS user_auth_tokens_token_type_check;

ALTER TABLE user_auth_tokens
ADD CONSTRAINT user_auth_tokens_token_type_check
CHECK (token_type IN ('email_verification', 'password_reset', 'oauth_csrf', 'oauth_code'));

-- Add index for faster cleanup of expired OAuth tokens
CREATE INDEX IF NOT EXISTS idx_user_auth_tokens_type_expires
ON user_auth_tokens(token_type, expires_at)
WHERE used_at IS NULL;

-- Clean up expired tokens periodically (optional scheduled job)
COMMENT ON INDEX idx_user_auth_tokens_type_expires IS 'Supports cleanup of expired OAuth CSRF and code tokens';
