/**
 * Enhanced Profiles Migration - v1.0.2
 * Adds comprehensive user profile fields
 * Run this in your Supabase SQL editor
 * 
 * NOTE: Passwords are NOT stored here!
 * Passwords are securely hashed and stored in auth.users (Supabase-managed)
 */

-- 1. Add additional profile fields
ALTER TABLE profiles 
  ADD COLUMN IF NOT EXISTS full_name TEXT,
  ADD COLUMN IF NOT EXISTS phone_number TEXT,
  ADD COLUMN IF NOT EXISTS avatar_url TEXT,
  ADD COLUMN IF NOT EXISTS date_of_birth DATE,
  ADD COLUMN IF NOT EXISTS address JSONB, -- {street, city, state, zip, country}
  ADD COLUMN IF NOT EXISTS bio TEXT,
  ADD COLUMN IF NOT EXISTS provider TEXT DEFAULT 'password', -- 'password', 'google', 'github'
  ADD COLUMN IF NOT EXISTS email_verified BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS last_login_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

-- 2. Add indexes for common queries
CREATE INDEX IF NOT EXISTS idx_profiles_email ON profiles(email);
CREATE INDEX IF NOT EXISTS idx_profiles_phone ON profiles(phone_number);
CREATE INDEX IF NOT EXISTS idx_profiles_provider ON profiles(provider);

-- 3. Create updated_at trigger function
CREATE OR REPLACE FUNCTION update_profiles_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 4. Create trigger for updated_at
DROP TRIGGER IF EXISTS profiles_updated_at_trigger ON profiles;
CREATE TRIGGER profiles_updated_at_trigger
  BEFORE UPDATE ON profiles
  FOR EACH ROW
  EXECUTE FUNCTION update_profiles_updated_at();

-- 5. Enable RLS on profiles (if not already enabled)
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

-- 6. Create RLS policies
-- Users can view their own profile
CREATE POLICY "Users can view own profile" 
  ON profiles 
  FOR SELECT 
  USING (auth.uid() = id);

-- Users can update their own profile
CREATE POLICY "Users can update own profile" 
  ON profiles 
  FOR UPDATE 
  USING (auth.uid() = id);

-- Service role can do everything
CREATE POLICY "Service role full access to profiles"
  ON profiles
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- 7. Grant permissions
GRANT ALL ON profiles TO service_role;
GRANT SELECT, UPDATE ON profiles TO authenticated;

-- 8. Add comments for documentation
COMMENT ON TABLE profiles IS 'User profile information. Passwords are stored in auth.users (Supabase-managed, bcrypt hashed).';
COMMENT ON COLUMN profiles.email IS 'User email (synced from auth.users)';
COMMENT ON COLUMN profiles.provider IS 'Auth provider: password, google, github, etc';
COMMENT ON COLUMN profiles.address IS 'JSON object: {street, city, state, zip, country}';
COMMENT ON COLUMN profiles.last_login_at IS 'Last successful login timestamp';

-- 9. Sample query to view password info (from auth.users)
-- NOTE: Run this separately if you want to see password metadata:
-- SELECT 
--   id, 
--   email, 
--   encrypted_password IS NOT NULL as has_password,
--   email_confirmed_at IS NOT NULL as email_verified,
--   last_sign_in_at,
--   created_at,
--   raw_app_meta_data->>'provider' as auth_provider
-- FROM auth.users;
