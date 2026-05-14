const OAuthService = require('../services/oauth.service');

const config = {
  password: {
    minLength: 8,
    requireUppercase: true,
    requireLowercase: true,
    requireNumbers: true,
    requireSymbols: false
  },

  failedLoginAttempts: {
    maxAttempts: 5,
    lockoutDuration: 15 * 60 * 1000,
    resetAfter: 60 * 60 * 1000
  },

  jwt: {
    accessTokenExpiry: '1h',
    refreshTokenExpiry: '30d'
  },

  cookie: {
    httpOnly: true,
    sameSite: process.env.NODE_ENV === 'production' ? 'strict' : 'lax',
    secure: process.env.NODE_ENV === 'production',
    domain: process.env.COOKIE_DOMAIN || undefined
  },

  allowedCorsOrigins: process.env.CORS_WHITELIST
    ? process.env.CORS_WHITELIST.split(',').map(url => url.trim())
    : [],

  isDevelopment: process.env.NODE_ENV !== 'production',

  async refreshCorsOrigins() {
    try {
      const dbOrigins = await OAuthService.getAllowedOrigins();
      const envOrigins = process.env.CORS_WHITELIST
        ? process.env.CORS_WHITELIST.split(',').map(url => url.trim()).filter(Boolean)
        : [];
      this.allowedCorsOrigins = [...new Set([...envOrigins, ...dbOrigins])];
      console.log(`✅ CORS origins refreshed: ${this.allowedCorsOrigins.length} origins`);
    } catch (err) {
      console.warn('⚠️ Could not refresh CORS origins from DB:', err.message);
    }
  }
};

module.exports = config;
