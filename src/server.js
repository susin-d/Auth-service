/**
 * S-Auth Server - v1.0.1
 * Express server with comprehensive security features
 */

require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const cookieParser = require('cookie-parser');

const db = require('./config/db');
const authRoutes = require('./routes/auth.routes');
const oauthRoutes = require('./routes/oauth.routes');
const securityConfig = require('./config/security.config');

const app = express();

// 1. GLOBAL MIDDLEWARE
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      scriptSrc: ["'self'", "'unsafe-inline'"],
      imgSrc: ["'self'", "data:", "https:"]
    }
  },
  hsts: {
    maxAge: 31536000,
    includeSubDomains: true,
    preload: true
  }
})); // Security headers

app.use(cors({
  origin: (origin, callback) => {
    // Always allow for development - no CORS restrictions
    if (securityConfig.isDevelopment) {
      return callback(null, true);
    }

    // Production: Allow requests with no origin (mobile apps, Postman, etc.)
    if (!origin) return callback(null, true);
    
    // Check against whitelist
    if (securityConfig.corsWhitelist && securityConfig.corsWhitelist.includes(origin)) {
      return callback(null, true);
    }
    
    // Reject other origins
    callback(new Error('Not allowed by CORS'));
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
})); // Enable CORS with whitelist

app.use(morgan('dev')); // Request logging
app.use(express.json({ limit: '1mb' })); // Body parser with size limit
app.use(express.urlencoded({ extended: true })); // For OAuth consent form
app.use(cookieParser()); // Cookie parser
app.use(express.static('public')); // Serve static files from public/

// Trust proxy for secure cookies behind reverse proxy
if (process.env.NODE_ENV === 'production') {
  app.set('trust proxy', 1);
}

// 2. DATABASE INITIALIZATION / CONNECTION CHECK
const initDB = async () => {
  try {
    // Simple query to verify connection
    await db.query('SELECT NOW()');
    console.log('✅ Database Connection: Verified (Neon PostgreSQL)');
    // Load CORS origins from registered OAuth clients
    await securityConfig.refreshCorsOrigins();
  } catch (err) {
    console.error('❌ Database Connection Error:', err.message);
    process.exit(1);
  }
};

// 3. ROUTES
app.use('/api/v1/auth', authRoutes);
app.use('/oauth', oauthRoutes);

// Developer Console SPA routing
app.get(/^\/console/, (req, res) => {
  res.sendFile(require('path').join(__dirname, '../public/console/index.html'));
});


// Health Check Endpoint (Essential for Microservices/Load Balancers)
app.get('/health', (req, res) => {
  res.status(200).json({ status: 'UP', service: 'auth-service' });
});

// 4. 404 HANDLER
app.use((req, res) => {
  res.status(404).json({ 
    error: `Route not found: ${req.method} ${req.path}`,
    message: 'The requested endpoint does not exist. Please check the API documentation.',
    available_routes: {
      auth: '/api/v1/auth',
      oauth: '/oauth',
      health: '/health'
    }
  });
});

// 5. GLOBAL ERROR HANDLER
app.use((err, req, res, next) => {
  console.error('[ERROR]', err);
  
  // Don't expose stack traces in production
  const isDev = process.env.NODE_ENV === 'development';
  
  // Sanitize error messages
  let message = 'An unexpected error occurred. Please try again.';
  let status = 500;
  
  if (err.message === 'Not allowed by CORS') {
    status = 403;
    message = 'Access forbidden. CORS policy does not allow access from your origin.';
  } else if (err.name === 'ValidationError') {
    status = 400;
    message = 'Invalid input data. ' + (err.message || 'Please check your request.');
  } else if (err.name === 'UnauthorizedError') {
    status = 401;
    message = 'Authentication required. Please provide a valid access token.';
  } else if (err.status) {
    status = err.status;
    message = err.message || message;
  } else if (isDev && err.message) {
    message = err.message;
  }
  
  res.status(status).json({
    error: message,
    code: err.code || 'INTERNAL_ERROR',
    ...(isDev && { 
      details: err.message,
      stack: err.stack 
    })
  });
});

// 6. START SERVER
const PORT = process.env.PORT || 3000;

const startServer = async () => {
  await initDB();
  app.listen(PORT, () => {
    console.log(`🚀 Auth Microservice running on port ${PORT}`);
  });
};

startServer();