const OAuthService = require('../services/oauth.service');

const config = {
  // Password policy
  password: {
    minLength: 8,
    requireUppercase: true,
    requireLowercase: true,
    requireNumbers: true,
    requireSymbols: false
  },

  // Failed login tracking
  failedLoginAttempts: {
    maxAttempts: 5,
    lockoutDuration: 15 * 60 * 1000,
    resetAfter: 60 * 60 * 1000
  },

  // JWT settings
  jwt: {
    accessTokenExpiry: '1h',
    refreshTokenExpiry: '30d'
  },

  // Cookie settings
  cookie: {
    httpOnly: true,
    sameSite: process.env.NODE_ENV === 'production' ? 'strict' : 'lax',
    secure: process.env.NODE_ENV === 'production',
    domain: process.env.COOKIE_DOMAIN || undefined
  },

  // CORS origins — starts with env var, refreshed from DB on startup
  corsWhitelist: process.env.CORS_WHITELIST
    ? process.env.CORS_WHITELIST.split(',').map(url => url.trim())
    : [],

  isDevelopment: process.env.NODE_ENV !== 'production',

  // Refresh allowed origins from registered OAuth clients in DB
  async refreshCorsOrigins() {
    try {
      const dbOrigins = await OAuthService.getAllowedOrigins();
      const envOrigins = process.env.CORS_WHITELIST
        ? process.env.CORS_WHITELIST.split(',').map(url => url.trim()).filter(Boolean)
        : [];
      this.corsWhitelist = [...new Set([...envOrigins, ...dbOrigins])];
      console.log(`✅ CORS origins refreshed: ${this.corsWhitelist.length} origins`);
    } catch (err) {
      console.warn('⚠️ Could not refresh CORS origins from DB:', err.message);
    }
  }
};

module.exports = config;
