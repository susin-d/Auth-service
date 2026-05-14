const db = require('../config/db');

class TokenBlacklist {
  constructor() {
    this.blacklist = new Set();
  }

  async init() {
    try {
      const result = await db.query(
        "SELECT token FROM user_auth_tokens WHERE token_type = 'jwt_blacklist' AND expires_at > NOW()"
      );
      for (const row of result.rows) {
        this.blacklist.add(row.token);
      }
      console.log(`🔒 Loaded ${this.blacklist.size} blacklisted tokens`);
    } catch (err) {
      console.warn('⚠️ Could not load blacklisted tokens:', err.message);
    }
  }

  async add(jti, expiresAt) {
    this.blacklist.add(jti);
    try {
      await db.query(
        "INSERT INTO user_auth_tokens (user_id, token_type, token, expires_at) VALUES ($1, $2, $3, $4) ON CONFLICT DO NOTHING",
        ['00000000-0000-0000-0000-000000000000', 'jwt_blacklist', jti, expiresAt]
      );
    } catch (err) {
      console.error('Failed to persist token blacklist:', err.message);
    }
  }

  isBlacklisted(jti) {
    return this.blacklist.has(jti);
  }
}

module.exports = new TokenBlacklist();
