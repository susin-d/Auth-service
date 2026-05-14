/**
 * Auth Middleware - v1.0.2
 * JWT token verification for protected routes
 */

const jwt = require('jsonwebtoken');

const protect = (req, res, next) => {
  const authHeader = req.headers.authorization;
  
  if (!authHeader) {
    return res.status(401).json({ 
      error: 'Access token required. Please sign in to get an access token.',
      code: 'NO_AUTH_HEADER'
    });
  }
  
  if (!authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ 
      error: 'Invalid authorization format. Use: Authorization: Bearer <token>',
      code: 'INVALID_AUTH_FORMAT'
    });
  }

  const token = authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ 
      error: 'Access token is missing. Please sign in to get an access token.',
      code: 'NO_TOKEN'
    });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = decoded; // Contains sub (id), email, role
    next();
  } catch (error) {
    console.error('Token verification error:', error.message);
    
    let errorMessage = 'Invalid or expired access token.';
    let errorCode = 'TOKEN_INVALID';
    
    if (error.name === 'TokenExpiredError') {
      errorMessage = 'Access token has expired. Please sign in again to get a new token.';
      errorCode = 'TOKEN_EXPIRED';
    } else if (error.name === 'JsonWebTokenError') {
      errorMessage = 'Invalid access token format. Please sign in again.';
      errorCode = 'TOKEN_MALFORMED';
    } else if (error.name === 'NotBeforeError') {
      errorMessage = 'Token is not yet valid. Please check your system time.';
      errorCode = 'TOKEN_NOT_ACTIVE';
    }
    
    res.status(401).json({ 
      error: errorMessage,
      code: errorCode,
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

const requireAdmin = (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({ 
      error: 'Authentication required',
      code: 'NO_AUTH'
    });
  }

  if (req.user.role !== 'admin') {
    return res.status(403).json({ 
      error: 'Access denied. Admin privileges required.',
      code: 'INSUFFICIENT_PERMISSIONS'
    });
  }

  next();
};

module.exports = { protect, requireAdmin };