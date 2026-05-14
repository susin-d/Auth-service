const db = require('../config/db');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const axios = require('axios');
const crypto = require('crypto');
const EmailService = require('./email.service');
const securityConfig = require('../config/security.config');
const auditLogger = require('../utils/audit.logger');

const SALT_ROUNDS = 12;
const VERIFICATION_TOKEN_EXPIRY = 24 * 60 * 60 * 1000;
const RESET_TOKEN_EXPIRY = 60 * 60 * 1000;
const REFRESH_TOKEN_EXPIRY = 30 * 24 * 60 * 60 * 1000;

const generateToken = () => crypto.randomBytes(32).toString('hex');

const isStrongPassword = (password) => {
  if (!password || password.length < 8) return false;
  if (!/[A-Z]/.test(password)) return false;
  if (!/[a-z]/.test(password)) return false;
  if (!/[0-9]/.test(password)) return false;
  return true;
};

const validateHttpsUrl = (frontendUrl) => {
  if (!frontendUrl) return null;
  try {
    const parsedUrl = new URL(frontendUrl);
    const isLocalhost = parsedUrl.hostname === 'localhost' ||
                        parsedUrl.hostname === '127.0.0.1' ||
                        parsedUrl.hostname.endsWith('.localhost');

    if (parsedUrl.protocol === 'http:' && !isLocalhost) {
      throw new Error('frontendUrl must be a valid https:// URL (http only allowed for localhost)');
    }

    if (parsedUrl.protocol !== 'https:' && parsedUrl.protocol !== 'http:') {
      throw new Error('frontendUrl must be a valid http:// or https:// URL');
    }

    return frontendUrl.replace(/\/+$/, '');
  } catch (error) {
    throw new Error(error.message || 'frontendUrl must be a valid https:// URL');
  }
};

class AuthService {
  async signUp(email, password, frontendUrl) {
    const existingResult = await db.query(
      'SELECT id FROM users WHERE email = $1 LIMIT 1',
      [email]
    );

    if (existingResult.rows.length > 0) {
      const error = new Error('A user with this email address has already been registered');
      error.code = 'email_exists';
      error.status = 422;
      throw error;
    }

    const password_hash = await bcrypt.hash(password, SALT_ROUNDS);

    const userResult = await db.query(
      'INSERT INTO users (email, password_hash, email_verified, account_status) VALUES ($1, $2, $3, $4) RETURNING *',
      [email, password_hash, false, 'active']
    );

    const newUser = userResult.rows[0];

    const token = generateToken();
    const expires_at = new Date(Date.now() + VERIFICATION_TOKEN_EXPIRY);

    await db.query(
      'INSERT INTO user_auth_tokens (user_id, token_type, token, expires_at) VALUES ($1, $2, $3, $4)',
      [newUser.id, 'email_verification', token, expires_at]
    );

    const backendUrl = process.env.BACKEND_URL || 'http://localhost:3000';
    const verificationLink = `${backendUrl}/api/v1/auth/verify-email?token=${token}`;

    EmailService
      .sendVerificationEmail(email, verificationLink)
      .catch(err => console.error('Email failed', err));

    return {
      id: newUser.id,
      email: newUser.email,
      created_at: newUser.created_at
    };
  }

  async signIn(email, password) {
    const userResult = await db.query(
      'SELECT * FROM users_complete WHERE email = $1 AND account_status = $2 LIMIT 1',
      [email, 'active']
    );

    const user = userResult.rows[0];

    if (!user) {
      throw new Error('Invalid email or password');
    }

    const authResult = await db.query(
      'SELECT password_hash FROM users WHERE id = $1 LIMIT 1',
      [user.id]
    );
    const authData = authResult.rows[0];

    if (authData.password_hash === 'GOOGLE_OAUTH') {
      throw new Error('This account uses Google Sign-In. Please sign in with Google instead.');
    }

    if (!user.email_verified) {
      throw new Error('Please verify your email before signing in. Check your inbox for the verification link.');
    }

    const isPasswordValid = await bcrypt.compare(password, authData.password_hash);
    if (!isPasswordValid) {
      throw new Error('Invalid email or password');
    }

    await db.query(
      'UPDATE users SET last_signin_at = $1 WHERE id = $2',
      [new Date().toISOString(), user.id]
    );

    const jti = crypto.randomUUID();
    const token = jwt.sign(
      { sub: user.id, email: user.email, role: user.role || 'user', jti },
      process.env.JWT_SECRET,
      { expiresIn: securityConfig.jwt.accessTokenExpiry }
    );

    const refreshToken = await this.generateRefreshToken(user.id);

    await auditLogger.logSuccessfulAuth(user.id, email, 'email', null);

    return {
      user,
      access_token: token,
      refresh_token: refreshToken
    };
  }

  async generateRefreshToken(userId) {
    const token = generateToken();
    const expires_at = new Date(Date.now() + REFRESH_TOKEN_EXPIRY);
    await db.query(
      'INSERT INTO user_auth_tokens (user_id, token_type, token, expires_at) VALUES ($1, $2, $3, $4)',
      [userId, 'refresh_token', token, expires_at]
    );
    return token;
  }

  async exchangeRefreshToken(refreshToken) {
    const tokenResult = await db.query(
      'SELECT * FROM user_auth_tokens WHERE token = $1 AND token_type = $2 AND used_at IS NULL AND expires_at > NOW() LIMIT 1',
      [refreshToken, 'refresh_token']
    );

    const tokenData = tokenResult.rows[0];
    if (!tokenData) {
      throw new Error('Invalid or expired refresh token');
    }

    await db.query(
      'UPDATE user_auth_tokens SET used_at = $1 WHERE id = $2',
      [new Date().toISOString(), tokenData.id]
    );

    const userResult = await db.query(
      'SELECT * FROM users_complete WHERE id = $1 LIMIT 1',
      [tokenData.user_id]
    );

    const user = userResult.rows[0];
    if (!user) {
      throw new Error('User not found');
    }

    const jti = crypto.randomUUID();
    const accessToken = jwt.sign(
      { sub: user.id, email: user.email, role: user.role || 'user', jti },
      process.env.JWT_SECRET,
      { expiresIn: securityConfig.jwt.accessTokenExpiry }
    );

    const newRefreshToken = await this.generateRefreshToken(user.id);

    return {
      user,
      access_token: accessToken,
      refresh_token: newRefreshToken
    };
  }

  async verifyEmailFromToken(token, type) {
    const tokenResult = await db.query(
      'SELECT * FROM user_auth_tokens WHERE token = $1 AND token_type = $2 AND used_at IS NULL LIMIT 1',
      [token, 'email_verification']
    );

    const tokenData = tokenResult.rows[0];

    if (!tokenData) {
      throw new Error('Invalid or expired verification token');
    }

    if (new Date() > new Date(tokenData.expires_at)) {
      throw new Error('Verification token has expired. Please request a new one.');
    }

    const userResult = await db.query(
      'SELECT id, email FROM users WHERE id = $1 LIMIT 1',
      [tokenData.user_id]
    );
    const userData = userResult.rows[0];

    await db.query(
      'UPDATE user_auth_tokens SET used_at = $1 WHERE id = $2',
      [new Date().toISOString(), tokenData.id]
    );

    await db.query(
      'UPDATE users SET email_verified = $1, email_verified_at = $2 WHERE id = $3',
      [true, new Date().toISOString(), tokenData.user_id]
    );

    const completeUserResult = await db.query(
      'SELECT * FROM users_complete WHERE id = $1 LIMIT 1',
      [tokenData.user_id]
    );
    const user = completeUserResult.rows[0];

    EmailService
      .sendWelcomeEmail(userData.email, user.full_name)
      .catch(err => console.error('Welcome email failed', err));

    await auditLogger.log('EMAIL_VERIFIED', {
      userId: tokenData.user_id,
      email: userData.email
    });

    return {
      verified: true,
      email: userData.email,
      user
    };
  }

  async resendVerificationEmail(email, frontendUrl) {
    const userResult = await db.query(
      'SELECT id, email, email_verified FROM users WHERE email = $1 LIMIT 1',
      [email]
    );

    const user = userResult.rows[0];

    if (!user) {
      throw new Error('User with this email not found. Please sign up first.');
    }

    if (user.email_verified) {
      throw new Error('Email is already verified. You can sign in now.');
    }

    await db.query(
      "DELETE FROM user_auth_tokens WHERE user_id = $1 AND token_type = $2 AND used_at IS NULL",
      [user.id, 'email_verification']
    );

    const token = generateToken();
    const expires_at = new Date(Date.now() + VERIFICATION_TOKEN_EXPIRY);

    await db.query(
      'INSERT INTO user_auth_tokens (user_id, token_type, token, expires_at) VALUES ($1, $2, $3, $4)',
      [user.id, 'email_verification', token, expires_at]
    );

    const backendUrl = process.env.BACKEND_URL || 'http://localhost:3000';
    const verificationLink = `${backendUrl}/api/v1/auth/verify-email?token=${token}`;

    EmailService
      .sendVerificationEmail(email, verificationLink)
      .catch(err => console.error('Resend verification email failed', err));

    return {
      email,
      verificationLink: process.env.NODE_ENV === 'development' ? verificationLink : undefined
    };
  }

  async deleteAccount(userId) {
    await db.query(
      'UPDATE users SET account_status = $1, deleted_at = $2 WHERE id = $3',
      ['deleted', new Date().toISOString(), userId]
    );

    return { success: true };
  }

  async getGoogleAuthUrl(origin, frontendUrl) {
    const callbackUrl = new URL('/api/v1/auth/google/callback', origin);

    const csrfToken = crypto.randomBytes(16).toString('hex');
    const statePayload = JSON.stringify({
      csrf: csrfToken,
      redirect: frontendUrl || ''
    });
    const state = Buffer.from(statePayload).toString('base64');

    await db.query(
      'INSERT INTO user_auth_tokens (user_id, token_type, token, expires_at) VALUES ($1, $2, $3, $4)',
      ['00000000-0000-0000-0000-000000000000', 'oauth_csrf', csrfToken, new Date(Date.now() + 10 * 60 * 1000)]
    );

    const googleAuthUrl = new URL('https://accounts.google.com/o/oauth2/v2/auth');
    googleAuthUrl.searchParams.set('client_id', process.env.GOOGLE_CLIENT_ID);
    googleAuthUrl.searchParams.set('redirect_uri', callbackUrl.toString());
    googleAuthUrl.searchParams.set('response_type', 'code');
    googleAuthUrl.searchParams.set('scope', 'email profile openid');
    googleAuthUrl.searchParams.set('access_type', 'offline');
    googleAuthUrl.searchParams.set('prompt', 'consent');
    googleAuthUrl.searchParams.set('state', state);
    return googleAuthUrl.toString();
  }

  async exchangeGoogleCode(code, origin) {
    const tokenUrl = 'https://oauth2.googleapis.com/token';
    const callbackUrl = new URL('/api/v1/auth/google/callback', origin);

    const tokenResponse = await axios.post(tokenUrl, {
      code,
      client_id: process.env.GOOGLE_CLIENT_ID,
      client_secret: process.env.GOOGLE_CLIENT_SECRET,
      redirect_uri: callbackUrl.toString(),
      grant_type: 'authorization_code'
    });

    const { access_token, refresh_token, id_token, expires_in } = tokenResponse.data;
    const token_expires_at = expires_in ? new Date(Date.now() + expires_in * 1000).toISOString() : null;

    const userInfoResponse = await axios.get('https://www.googleapis.com/oauth2/v2/userinfo', {
      headers: { Authorization: `Bearer ${access_token}` }
    });

    const { email, id: googleId, name, picture } = userInfoResponse.data;

    const existingResult = await db.query(
      'SELECT id, email, email_verified FROM users WHERE email = $1 LIMIT 1',
      [email]
    );

    const existingUser = existingResult.rows[0];
    let userId;

    if (existingUser) {
      userId = existingUser.id;

      await db.query(
        'UPDATE users SET last_signin_at = $1 WHERE id = $2',
        [new Date().toISOString(), userId]
      );

      const oauthResult = await db.query(
        'SELECT id FROM user_oauth WHERE user_id = $1 AND provider = $2 LIMIT 1',
        [userId, 'google']
      );

      const oauthConn = oauthResult.rows[0];

      if (oauthConn) {
        await db.query(
          `UPDATE user_oauth SET 
            access_token = $1, 
            refresh_token = $2, 
            token_expires_at = $3, 
            provider_avatar_url = $4, 
            provider_name = $5,
            updated_at = NOW()
           WHERE id = $6`,
          [access_token, refresh_token, token_expires_at, picture, name, oauthConn.id]
        );
      } else {
        await db.query(
          `INSERT INTO user_oauth (user_id, provider, provider_user_id, provider_email, provider_avatar_url, provider_name, access_token, refresh_token, token_expires_at)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
          [userId, 'google', googleId, email, picture, name, access_token, refresh_token, token_expires_at]
        );
      }

      await db.query(
        'UPDATE user_profiles SET full_name = $1, avatar_url = $2 WHERE user_id = $3 AND full_name IS NULL',
        [name, picture, userId]
      );

    } else {
      try {
        const createResult = await db.query(
          `INSERT INTO users (email, password_hash, email_verified, email_verified_at, account_status, last_signin_at)
           VALUES ($1, $2, $3, $4, $5, $6)
           RETURNING *`,
          [email, 'GOOGLE_OAUTH', true, new Date().toISOString(), 'active', new Date().toISOString()]
        );
        const newUser = createResult.rows[0];
        userId = newUser.id;

        await db.query(
          `INSERT INTO user_oauth (user_id, provider, provider_user_id, provider_email, provider_avatar_url, provider_name, access_token, refresh_token, token_expires_at)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
          [userId, 'google', googleId, email, picture, name, access_token, refresh_token, token_expires_at]
        );

        await db.query(
          'UPDATE user_profiles SET full_name = $1, avatar_url = $2 WHERE user_id = $3',
          [name, picture, userId]
        );

        EmailService
          .sendWelcomeEmail(email, name)
          .catch(err => console.error('Welcome email failed', err));

      } catch (createError) {
        if (createError.code === '23505') {
          throw new Error('An account with this email already exists. Please sign in with your email and password.');
        }
        throw createError;
      }
    }

    const completeResult = await db.query(
      'SELECT * FROM users_complete WHERE id = $1 LIMIT 1',
      [userId]
    );
    const user = completeResult.rows[0];

    const jti = crypto.randomUUID();
    const serviceToken = jwt.sign(
      { sub: userId, email, role: user.role || 'user', jti },
      process.env.JWT_SECRET,
      { expiresIn: securityConfig.jwt.accessTokenExpiry }
    );

    const appRefreshToken = await this.generateRefreshToken(userId);

    await auditLogger.logSuccessfulAuth(userId, email, 'google', null);

    return {
      access_token: serviceToken,
      refresh_token: appRefreshToken,
      google_access_token: access_token,
      user
    };
  }

  async validateOAuthState(state) {
    if (!state) {
      throw new Error('Missing OAuth state parameter');
    }

    let statePayload;
    try {
      statePayload = JSON.parse(Buffer.from(state, 'base64').toString('utf-8'));
    } catch (err) {
      throw new Error('Invalid OAuth state parameter');
    }

    const { csrf, redirect } = statePayload;

    if (!csrf) {
      throw new Error('Missing CSRF token in OAuth state');
    }

    const tokenResult = await db.query(
      "SELECT id FROM user_auth_tokens WHERE token = $1 AND token_type = $2 AND used_at IS NULL AND expires_at > NOW() LIMIT 1",
      [csrf, 'oauth_csrf']
    );

    if (tokenResult.rows.length === 0) {
      throw new Error('Invalid or expired CSRF token');
    }

    await db.query(
      'UPDATE user_auth_tokens SET used_at = $1 WHERE id = $2',
      [new Date().toISOString(), tokenResult.rows[0].id]
    );

    return redirect || null;
  }

  async generateAuthCode(userId, sessionData) {
    const code = crypto.randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + 60 * 1000);

    await db.query(
      'INSERT INTO user_auth_tokens (user_id, token_type, token, expires_at) VALUES ($1, $2, $3, $4)',
      [userId, 'oauth_code', code, expiresAt]
    );

    return code;
  }

  async exchangeAuthCode(code) {
    const tokenResult = await db.query(
      'SELECT * FROM user_auth_tokens WHERE token = $1 AND token_type = $2 AND used_at IS NULL LIMIT 1',
      [code, 'oauth_code']
    );

    const tokenData = tokenResult.rows[0];
    if (!tokenData) {
      throw new Error('Invalid or expired authorization code');
    }

    if (new Date() > new Date(tokenData.expires_at)) {
      throw new Error('Authorization code has expired');
    }

    await db.query(
      'UPDATE user_auth_tokens SET used_at = $1 WHERE id = $2',
      [new Date().toISOString(), tokenData.id]
    );

    const userResult = await db.query(
      'SELECT * FROM users_complete WHERE id = $1 LIMIT 1',
      [tokenData.user_id]
    );
    const user = userResult.rows[0];

    if (!user) {
      throw new Error('User not found');
    }

    const jti = crypto.randomUUID();
    const accessToken = jwt.sign(
      { sub: user.id, email: user.email, role: user.role || 'user', jti },
      process.env.JWT_SECRET,
      { expiresIn: securityConfig.jwt.accessTokenExpiry }
    );

    return { user, access_token: accessToken };
  }

  buildFrontendRedirect(frontendUrlParam) {
    const frontendUrl = frontendUrlParam || process.env.FRONTEND_URL;

    if (!frontendUrl) {
      throw new Error('FRONTEND_URL environment variable is required');
    }

    const validated = validateHttpsUrl(frontendUrl);
    if (!validated) {
      throw new Error('Invalid frontend URL format or protocol');
    }

    const normalizedUrl = frontendUrl.replace(/\/+$/, '');
    const isLocalhost = normalizedUrl.includes('localhost') || normalizedUrl.includes('127.0.0.1');

    if (securityConfig.isDevelopment && isLocalhost) {
      return normalizedUrl;
    }

    if (securityConfig.allowedCorsOrigins.length > 0 && !securityConfig.allowedCorsOrigins.includes(normalizedUrl)) {
      throw new Error('Redirect URL is not in the allowed whitelist');
    }

    return normalizedUrl;
  }

  async getProfile(userId) {
    const result = await db.query(
      'SELECT * FROM users_complete WHERE id = $1 LIMIT 1',
      [userId]
    );
    const user = result.rows[0];

    if (!user) {
      throw new Error('User not found');
    }

    return user;
  }

  async updateProfile(userId, updates) {
    const allowedFields = [
      'full_name', 'display_name', 'avatar_url', 'bio',
      'date_of_birth', 'gender', 'phone_number',
      'country', 'city', 'website_url'
    ];

    const setClauses = [];
    const values = [];
    let paramCount = 1;

    for (const field of allowedFields) {
      if (updates[field] !== undefined) {
        setClauses.push(`${field} = $${paramCount}`);
        values.push(updates[field]);
        paramCount++;
      }
    }

    if (setClauses.length === 0) {
      throw new Error('No valid fields to update');
    }

    values.push(userId);
    const query = `UPDATE user_profiles SET ${setClauses.join(', ')}, updated_at = NOW() WHERE user_id = $${paramCount}`;

    await db.query(query, values);

    return this.getProfile(userId);
  }

  async completeVerification(userId) {
    const userResult = await db.query(
      'SELECT id, email, email_verified FROM users WHERE id = $1 LIMIT 1',
      [userId]
    );
    const user = userResult.rows[0];

    if (!user) {
      throw new Error('User not found');
    }

    if (!user.email_verified) {
      throw new Error('Email is not yet verified. Please click the verification link in your email first.');
    }

    const profileResult = await db.query(
      'SELECT * FROM users_complete WHERE id = $1 LIMIT 1',
      [userId]
    );
    const profile = profileResult.rows[0];

    return { profile };
  }

  async requestPasswordReset(email) {
    const result = await db.query(
      'SELECT id, email FROM users WHERE email = $1 LIMIT 1',
      [email]
    );
    const user = result.rows[0];

    if (!user) {
      return { success: true };
    }

    const token = generateToken();
    const expires_at = new Date(Date.now() + RESET_TOKEN_EXPIRY);

    await db.query(
      'INSERT INTO user_auth_tokens (user_id, token_type, token, expires_at) VALUES ($1, $2, $3, $4)',
      [user.id, 'password_reset', token, expires_at]
    );

    const backendUrl = process.env.BACKEND_URL || 'http://localhost:3000';
    const resetLink = `${backendUrl}/api/v1/auth/reset-password?token=${token}`;

    EmailService
      .sendPasswordResetEmail(user.email, resetLink)
      .catch(err => console.error('Password reset email failed', err));

    return { success: true };
  }

  async resetPassword(token, newPassword) {
    if (!isStrongPassword(newPassword)) {
      throw new Error('Password must be at least 8 characters with uppercase, lowercase, and a number');
    }

    const tokenResult = await db.query(
      'SELECT * FROM user_auth_tokens WHERE token = $1 AND token_type = $2 AND used_at IS NULL LIMIT 1',
      [token, 'password_reset']
    );
    const tokenData = tokenResult.rows[0];

    if (!tokenData) {
      throw new Error('Invalid or expired reset token');
    }

    if (new Date() > new Date(tokenData.expires_at)) {
      throw new Error('Reset token has expired. Please request a new one.');
    }

    const password_hash = await bcrypt.hash(newPassword, SALT_ROUNDS);

    await db.query(
      'UPDATE users SET password_hash = $1 WHERE id = $2',
      [password_hash, tokenData.user_id]
    );

    await db.query(
      'UPDATE user_auth_tokens SET used_at = $1 WHERE id = $2',
      [new Date().toISOString(), tokenData.id]
    );

    return { success: true };
  }
}

module.exports = new AuthService();
