/**
 * Security Configuration - v1.0.1
 * Centralized security settings for production deployment
 */

module.exports = {
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
    lockoutDuration: 15 * 60 * 1000, // 15 minutes in milliseconds
    resetAfter: 60 * 60 * 1000 // Reset counter after 1 hour
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

  // CORS whitelist - comma-separated list from environment
  corsWhitelist: process.env.CORS_WHITELIST 
    ? process.env.CORS_WHITELIST.split(',').map(url => url.trim())
    : [],

  // Add localhost for development
  isDevelopment: process.env.NODE_ENV !== 'production'
};
