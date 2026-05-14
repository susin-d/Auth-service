/**
 * OAuth Provider Service - v1.0.0
 * Handles OAuth2 Authorization Server logic for "Sign in with Starviel"
 */

const db = require('../config/db');
const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcrypt');

const AUTH_CODE_EXPIRY = 60 * 1000; // 60 seconds
const OAUTH_TOKEN_EXPIRY = '1h';

class OAuthService {
  /**
   * Generate a cryptographically random string
   */
  generateRandomString(length = 32) {
    return crypto.randomBytes(length).toString('hex');
  }

  /**
   * Register a new OAuth client application
   */
  async registerClient({ clientName, clientDescription, logoUrl, redirectUris, scopes, isConfidential, createdBy }) {
    const clientId = `sauth_${this.generateRandomString(16)}`;
    const clientSecretRaw = this.generateRandomString(32);
    // Store hashed secret
    const clientSecretHash = await bcrypt.hash(clientSecretRaw, 10);

    const result = await db.query(
      `INSERT INTO oauth_clients 
        (client_id, client_secret, client_name, client_description, logo_url, redirect_uris, scopes, is_confidential, created_by) 
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) 
       RETURNING id, client_id, client_name, client_description, logo_url, redirect_uris, scopes, is_confidential, created_at`,
      [clientId, clientSecretHash, clientName, clientDescription || null, logoUrl || null, redirectUris, scopes || ['profile', 'email'], isConfidential !== false, createdBy || null]
    );

    return {
      ...result.rows[0],
      client_secret: clientSecretRaw // Only returned once, on creation
    };
  }

  /**
   * Get all registered OAuth clients (admin)
   */
  async listClients() {
    const result = await db.query(
      `SELECT id, client_id, client_name, client_description, logo_url, redirect_uris, scopes, is_active, is_confidential, created_at 
       FROM oauth_clients 
       ORDER BY created_at DESC`
    );
    return result.rows;
  }

  /**
   * Delete an OAuth client
   */
  async deleteClient(clientId) {
    const result = await db.query(
      'DELETE FROM oauth_clients WHERE client_id = $1 RETURNING client_id, client_name',
      [clientId]
    );
    if (result.rows.length === 0) {
      throw new Error('OAuth client not found');
    }
    return result.rows[0];
  }

  /**
   * List OAuth clients created by a specific user (developer self-service)
   */
  async listClientsByUser(userId) {
    const result = await db.query(
      `SELECT id, client_id, client_name, client_description, logo_url, redirect_uris, scopes, is_active, is_confidential, created_at 
       FROM oauth_clients 
       WHERE created_by = $1
       ORDER BY created_at DESC`,
      [userId]
    );
    return result.rows;
  }

  /**
   * Delete an OAuth client only if owned by the user (developer self-service)
   */
  async deleteClientByUser(clientId, userId) {
    const result = await db.query(
      'DELETE FROM oauth_clients WHERE client_id = $1 AND created_by = $2 RETURNING client_id, client_name',
      [clientId, userId]
    );
    if (result.rows.length === 0) {
      throw new Error('OAuth client not found or you do not own it');
    }
    return result.rows[0];
  }


  /**
   * Validate a client_id and redirect_uri pair
   */
  async validateClient(clientId, redirectUri) {
    const result = await db.query(
      'SELECT * FROM oauth_clients WHERE client_id = $1 AND is_active = true LIMIT 1',
      [clientId]
    );

    const client = result.rows[0];
    if (!client) {
      throw new Error('Invalid client_id or client is inactive');
    }

    // Validate redirect URI is in the registered list
    if (!client.redirect_uris.includes(redirectUri)) {
      throw new Error('Invalid redirect_uri. It must match a registered URI for this client.');
    }

    return client;
  }

  /**
   * Validate requested scopes against client's allowed scopes
   */
  validateScopes(requestedScopes, clientScopes) {
    const requested = requestedScopes ? requestedScopes.split(' ').filter(Boolean) : ['profile', 'email'];
    const allowed = clientScopes || ['profile', 'email'];

    for (const scope of requested) {
      if (!allowed.includes(scope)) {
        throw new Error(`Scope "${scope}" is not allowed for this client`);
      }
    }

    return requested;
  }

  /**
   * Generate an authorization code after user consent
   */
  async generateAuthorizationCode(userId, clientId, redirectUri, scopes, codeChallenge, codeChallengeMethod, state) {
    const code = this.generateRandomString(32);
    const expiresAt = new Date(Date.now() + AUTH_CODE_EXPIRY);

    await db.query(
      `INSERT INTO oauth_authorization_codes 
        (code, client_id, user_id, redirect_uri, scopes, code_challenge, code_challenge_method, state, expires_at) 
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
      [code, clientId, userId, redirectUri, scopes, codeChallenge || null, codeChallengeMethod || 'S256', state || null, expiresAt]
    );

    return code;
  }

  /**
   * Exchange an authorization code for an access token
   */
  async exchangeCode(code, clientId, clientSecret, codeVerifier) {
    // 1. Find the code
    const codeResult = await db.query(
      'SELECT * FROM oauth_authorization_codes WHERE code = $1 AND used_at IS NULL LIMIT 1',
      [code]
    );

    const authCode = codeResult.rows[0];
    if (!authCode) {
      throw new Error('Invalid or expired authorization code');
    }

    // 2. Check expiry
    if (new Date() > new Date(authCode.expires_at)) {
      throw new Error('Authorization code has expired');
    }

    // 3. Verify client_id matches
    if (authCode.client_id !== clientId) {
      throw new Error('client_id does not match the authorization code');
    }

    // 4. Verify client credentials (either client_secret or PKCE code_verifier)
    if (clientSecret) {
      // Confidential client: verify client_secret
      const clientResult = await db.query(
        'SELECT client_secret FROM oauth_clients WHERE client_id = $1 LIMIT 1',
        [clientId]
      );
      const client = clientResult.rows[0];
      if (!client) {
        throw new Error('Client not found');
      }

      const isValid = await bcrypt.compare(clientSecret, client.client_secret);
      if (!isValid) {
        throw new Error('Invalid client_secret');
      }
    } else if (codeVerifier) {
      // Public client: verify PKCE code_verifier
      if (!authCode.code_challenge) {
        throw new Error('Code challenge was not provided during authorization');
      }

      const expectedChallenge = crypto
        .createHash('sha256')
        .update(codeVerifier)
        .digest('base64url');

      if (expectedChallenge !== authCode.code_challenge) {
        throw new Error('Invalid code_verifier — PKCE validation failed');
      }
    } else {
      throw new Error('Either client_secret or code_verifier is required');
    }

    // 5. Mark code as used
    await db.query(
      'UPDATE oauth_authorization_codes SET used_at = $1 WHERE id = $2',
      [new Date().toISOString(), authCode.id]
    );

    // 6. Get user data
    const userResult = await db.query(
      'SELECT * FROM users_complete WHERE id = $1 LIMIT 1',
      [authCode.user_id]
    );
    const user = userResult.rows[0];

    if (!user) {
      throw new Error('User not found');
    }

    // 7. Build token payload based on scopes
    const tokenPayload = {
      sub: user.id,
      iss: 's-auth',
      aud: clientId,
      scopes: authCode.scopes
    };

    if (authCode.scopes.includes('email')) {
      tokenPayload.email = user.email;
    }
    if (authCode.scopes.includes('profile')) {
      tokenPayload.name = user.full_name || user.display_name;
      tokenPayload.picture = user.avatar_url;
    }

    // 8. Sign JWT
    const accessToken = jwt.sign(
      tokenPayload,
      process.env.JWT_SECRET,
      { expiresIn: OAUTH_TOKEN_EXPIRY }
    );

    return {
      access_token: accessToken,
      token_type: 'Bearer',
      expires_in: 3600,
      scope: authCode.scopes.join(' ')
    };
  }

  /**
   * Get user info from a valid access token (for /oauth/userinfo)
   */
  /**
   * Get allowed CORS origins from all active OAuth clients.
   * Extracts origin (protocol + host) from each redirect_uri.
   */
  async getAllowedOrigins() {
    const result = await db.query(
      `SELECT redirect_uris FROM oauth_clients WHERE is_active = true`
    );
    const origins = new Set();
    for (const row of result.rows) {
      for (const uri of row.redirect_uris) {
        try {
          const url = new URL(uri);
          origins.add(`${url.protocol}//${url.hostname}${url.port ? `:${url.port}` : ''}`);
        } catch {
          // skip invalid URIs
        }
      }
    }
    return [...origins];
  }

  getUserInfoFromToken(decoded) {
    const userInfo = {
      sub: decoded.sub
    };

    if (decoded.scopes && decoded.scopes.includes('email')) {
      userInfo.email = decoded.email;
    }
    if (decoded.scopes && decoded.scopes.includes('profile')) {
      userInfo.name = decoded.name;
      userInfo.picture = decoded.picture;
    }

    return userInfo;
  }
}

module.exports = new OAuthService();
