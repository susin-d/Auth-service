require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const cookieParser = require('cookie-parser');
const crypto = require('crypto');

const db = require('./config/db');
const authRoutes = require('./routes/auth.routes');
const oauthRoutes = require('./routes/oauth.routes');
const securityConfig = require('./config/security.config');
const tokenBlacklist = require('./utils/token.blacklist');

const app = express();

// 0. CORRELATION ID
app.use((req, res, next) => {
  req.correlationId = req.headers['x-request-id'] || crypto.randomUUID();
  res.setHeader('X-Request-Id', req.correlationId);
  next();
});

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
}));

app.use(cors({
  origin: (origin, callback) => {
    if (securityConfig.isDevelopment) {
      return callback(null, true);
    }

    if (!origin) return callback(null, true);
    
    if (securityConfig.allowedCorsOrigins && securityConfig.allowedCorsOrigins.includes(origin)) {
      return callback(null, true);
    }
    
    callback(new Error('Not allowed by CORS'));
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Request-Id']
}));

app.use(morgan('dev'));
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());
app.use(express.static('public'));

if (process.env.NODE_ENV === 'production') {
  app.set('trust proxy', 1);
}

// 2. DATABASE INITIALIZATION
const initDB = async () => {
  const result = await db.query('SELECT NOW()');
  console.log('✅ Database Connection: Verified (Neon PostgreSQL)');
  await securityConfig.refreshCorsOrigins();
  await tokenBlacklist.init();
};

// 3. ROUTES
app.use('/api/v1/auth', authRoutes);
app.use('/oauth', oauthRoutes);

app.get(/^\/console/, (req, res) => {
  res.sendFile(require('path').join(__dirname, '../public/console/index.html'));
});

app.get('/dashboard', (req, res) => {
  res.sendFile(require('path').join(__dirname, '../public/dashboard.html'));
});

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
  const cid = req.correlationId || 'unknown';
  console.error(`[${cid}] ERROR:`, err);
  
  const isDev = process.env.NODE_ENV === 'development';
  
  if (err.name === 'RateLimitError') {
    return res.status(429).json({ error: 'Too many requests. Please try again later.' });
  }
  
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
    correlationId: cid,
    ...(isDev && { 
      details: err.message,
      stack: err.stack 
    })
  });
});

// 6. START SERVER / EXPORT FOR VERCEL
const PORT = process.env.PORT || 3000;

const startServer = async (retries = 5) => {
  for (let i = 0; i < retries; i++) {
    try {
      await initDB();
      app.listen(PORT, () => {
        console.log(`🚀 Auth Microservice running on port ${PORT}`);
      });
      return;
    } catch (err) {
      console.error(`❌ Database Connection Error (attempt ${i + 1}/${retries}):`, err.message);
      if (i === retries - 1) {
        console.error('❌ Max retries reached. Exiting.');
        process.exit(1);
      }
      const delay = Math.min(1000 * Math.pow(2, i), 10000);
      console.log(`   Retrying in ${delay}ms...`);
      await new Promise(r => setTimeout(r, delay));
    }
  }
};

if (process.env.VERCEL !== '1') {
  startServer();
} else {
  initDB().catch(err => console.error('❌ Vercel DB init error:', err.message));
}

module.exports = app;
