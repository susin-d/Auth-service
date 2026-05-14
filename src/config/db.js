/**
 * Database Configuration - v1.0.0
 * PostgreSQL client pool for Neon
 */

const { Pool } = require('pg');
require('dotenv').config();

if (!process.env.DATABASE_URL) {
  console.error('❌ DATABASE_URL is not defined in .env file');
  process.exit(1);
}

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: true // Validate SSL certificates for Neon connections
  },
  max: 20, // Maximum number of clients in the pool
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 10000, // Increased from 2000ms to allow slower connections
});

// Test connection
pool.on('connect', () => {
  if (process.env.NODE_ENV === 'development') {
    console.log('🐘 Database pool connected');
  }
});

pool.on('error', (err) => {
  console.error('❌ Unexpected error on idle database client', err);
  process.exit(-1);
});

module.exports = {
  query: (text, params) => pool.query(text, params),
  pool
};
