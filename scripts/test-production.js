/**
 * Production Endpoint Test
 * Validates that deployed service routes are reachable and enforce expected auth/validation behavior.
 */

require('dotenv').config();
const axios = require('axios');

const baseUrl = (process.env.PRODUCTION_SITE_URL || process.env.BACKEND_URL || '').replace(/\/$/, '');

if (!baseUrl) {
  console.error('Missing production base URL.');
  console.error('Set PRODUCTION_SITE_URL or BACKEND_URL in your environment.');
  process.exit(1);
}

const timeout = Number(process.env.PRODUCTION_TEST_TIMEOUT_MS || 10000);

const client = axios.create({
  baseURL: baseUrl,
  timeout,
  validateStatus: () => true
});

const tests = [
  {
    name: 'GET /health returns service UP',
    request: () => client.get('/health'),
    assert: (response) => response.status === 200 && response.data?.status === 'UP'
  },

  // Public auth routes
  {
    name: 'POST /api/v1/auth/signup rejects invalid payload',
    request: () => client.post('/api/v1/auth/signup', { email: 'invalid', password: 'x' }),
    expectedStatuses: [400],
    assert: (response) => response.status === 400
  },
  {
    name: 'POST /api/v1/auth/signin rejects invalid payload',
    request: () => client.post('/api/v1/auth/signin', { email: 'invalid', password: '' }),
    expectedStatuses: [400],
    assert: (response) => response.status === 400
  },
  {
    name: 'GET /api/v1/auth/verify-email without token fails',
    request: () => client.get('/api/v1/auth/verify-email'),
    expectedStatuses: [400],
    assert: (response) => response.status === 400
  },
  {
    name: 'POST /api/v1/auth/resend-verification rejects invalid payload',
    request: () => client.post('/api/v1/auth/resend-verification', { email: 'invalid' }),
    expectedStatuses: [400],
    assert: (response) => response.status === 400
  },
  {
    name: 'GET /api/v1/auth/google endpoint reachable',
    request: () => client.get('/api/v1/auth/google?frontend_url=https://example.com'),
    expectedStatuses: [302, 500],
    assert: (response) => response.status === 302 || response.status === 500
  },
  {
    name: 'GET /api/v1/auth/google/callback without code fails',
    request: () => client.get('/api/v1/auth/google/callback'),
    expectedStatuses: [400],
    assert: (response) => response.status === 400
  },

  // Protected routes (should reject missing auth)
  {
    name: 'POST /api/v1/auth/complete-verification requires auth',
    request: () => client.post('/api/v1/auth/complete-verification'),
    expectedStatuses: [401],
    assert: (response) => response.status === 401
  },
  {
    name: 'GET /api/v1/auth/profile requires auth',
    request: () => client.get('/api/v1/auth/profile'),
    expectedStatuses: [401],
    assert: (response) => response.status === 401
  },
  {
    name: 'PUT /api/v1/auth/profile requires auth',
    request: () => client.put('/api/v1/auth/profile', { full_name: 'Prod Test' }),
    expectedStatuses: [401],
    assert: (response) => response.status === 401
  },
  {
    name: 'DELETE /api/v1/auth/delete-account requires auth',
    request: () => client.delete('/api/v1/auth/delete-account'),
    expectedStatuses: [401],
    assert: (response) => response.status === 401
  },

  // Admin routes (without auth should return 401)
  {
    name: 'POST /api/v1/auth/broadcast-email requires auth',
    request: () => client.post('/api/v1/auth/broadcast-email', {}),
    expectedStatuses: [401],
    assert: (response) => response.status === 401
  },
  {
    name: 'GET /api/v1/auth/admin/users requires auth',
    request: () => client.get('/api/v1/auth/admin/users'),
    expectedStatuses: [401],
    assert: (response) => response.status === 401
  },
  {
    name: 'GET /api/v1/auth/admin/users/:userId requires auth',
    request: () => client.get('/api/v1/auth/admin/users/test-user-id'),
    expectedStatuses: [401],
    assert: (response) => response.status === 401
  },
  {
    name: 'PUT /api/v1/auth/admin/users/:userId requires auth',
    request: () => client.put('/api/v1/auth/admin/users/test-user-id', { role: 'user' }),
    expectedStatuses: [401],
    assert: (response) => response.status === 401
  },
  {
    name: 'DELETE /api/v1/auth/admin/users/:userId requires auth',
    request: () => client.delete('/api/v1/auth/admin/users/test-user-id'),
    expectedStatuses: [401],
    assert: (response) => response.status === 401
  },

  {
    name: 'Unknown route returns 404',
    request: () => client.get('/definitely-not-a-real-route'),
    expectedStatuses: [404],
    assert: (response) => response.status === 404
  }
];

async function run() {
  console.log(`Running production smoke tests against: ${baseUrl}`);
  console.log(`Timeout per request: ${timeout}ms`);

  let passed = 0;

  for (const test of tests) {
    try {
      const response = await test.request();
      const ok = test.assert(response);

      if (ok) {
        passed += 1;
        console.log(`✅ ${test.name} (${response.status})`);
      } else {
        const expected = test.expectedStatuses ? ` expected [${test.expectedStatuses.join(', ')}]` : '';
        console.error(`❌ ${test.name} (${response.status})${expected}`);
      }
    } catch (error) {
      console.error(`❌ ${test.name}`);
      console.error(`   ${error.message}`);
    }
  }

  console.log(`\nResult: ${passed}/${tests.length} tests passed`);

  if (passed !== tests.length) {
    process.exit(1);
  }
}

run();