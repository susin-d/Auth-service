-- Migration: Add user roles support
-- Created: 2026-02-13
-- Description: Adds role column to users table for admin/user distinction

-- Add role column to users table
ALTER TABLE users 
ADD COLUMN IF NOT EXISTS role VARCHAR(20) DEFAULT 'user' CHECK (role IN ('user', 'admin'));

-- Create index for faster role lookups
CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);

-- Add comment
COMMENT ON COLUMN users.role IS 'User role: user (default) or admin';

-- Update existing users to have 'user' role
UPDATE users SET role = 'user' WHERE role IS NULL;

-- Drop and recreate users_complete view to include role
DROP VIEW IF EXISTS public.users_complete;

CREATE VIEW public.users_complete AS
SELECT 
  u.id,
  u.email,
  u.email_verified,
  u.email_verified_at,
  u.account_status,
  u.role,
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

COMMENT ON VIEW public.users_complete IS 'Complete user data with profile, OAuth info, and role (excludes sensitive fields)';

