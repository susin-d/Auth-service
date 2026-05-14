# Continue with Starviel — OAuth 2.0 Provider Integration Guide

Add **"Continue with Starviel"** authentication to your application in minutes using OAuth 2.0.

## 🌟 Overview

Starviel implements the **OAuth2 Authorization Code flow** (with optional PKCE for public clients), following industry standards used by Google, GitHub, and Facebook. This allows third-party applications to authenticate users via their Starviel account.

## 🚀 Quick Start

### 1. Register Your Application

Self-service app registration (no admin needed!):

#### Option A: Via API
```bash
# Requires authentication token
curl -X POST http://localhost:3000/api/v1/auth/developer/apps \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "client_name": "My Awesome App",
    "redirect_uris": ["http://localhost:3000/callback", "https://myapp.com/callback"]
  }'
```

Response:
```json
{
  "success": true,
  "message": "App created! Save the client_secret — it will not be shown again.",
  "client": {
    "client_id": "sauth_a3a6fc028c0ab7a200f4fedaac189eb9",
    "client_secret": "10a94eccf3242a59e8fe7b7153f932db8a6683054313fdab3896782a1b468f8f",
    "client_name": "My Awesome App",
    "redirect_uris": ["http://localhost:3000/callback", "https://myapp.com/callback"],
    "created_at": "2026-05-14T12:00:00Z"
  }
}
```

#### Option B: Via Dashboard
- Sign in to your Starviel account
- Navigate to Developer Settings
- Click "Create New App"
- Fill in app name and redirect URIs
- Copy your `client_id` and `client_secret`

⚠️ **Important:** Save the `client_secret` immediately — it's only shown once!

---

### 2. Add "Continue with Starviel" Button

Add this button to your login page:

```html
<a href="http://localhost:3000/oauth/authorize?client_id=YOUR_CLIENT_ID&redirect_uri=YOUR_REDIRECT_URI&response_type=code&scope=profile email&state=RANDOM_STATE">
  <button>Continue with Starviel</button>
</a>
```

### 3. Redirect to Starviel OAuth

Construct the authorization URL with these parameters:

```
http://localhost:3000/oauth/authorize?
  client_id=sauth_a3a6fc028c0ab7a200f4fedaac189eb9
  &redirect_uri=http://localhost:3000/callback
  &response_type=code
  &scope=profile email
  &state=random_security_token
```

| Parameter | Required | Description |
|---|---|---|
| `client_id` | ✅ | Your registered client ID |
| `redirect_uri` | ✅ | Must match a registered URI exactly |
| `response_type` | ✅ | Must be `code` |
| `scope` | ❌ | Space-separated: `profile`, `email` (default: `profile email`) |
| `state` | ❌ | CSRF protection token (recommended) |
| `code_challenge` | ❌ | PKCE S256 challenge for public clients |
| `code_challenge_method` | ❌ | Must be `S256` if using PKCE |

### 4. Handle the Authorization Response

After user login & consent, Starviel redirects to your `redirect_uri`:

```
http://localhost:3000/callback?code=119bfe990c2caa45bc786d492f70400c9b6e39f3de2930fe85a9b25173fb76eb&state=random_security_token
```

**Always verify the state parameter matches what you sent!**

```javascript
// Node.js example
if (req.query.state !== req.session.oauthState) {
  throw new Error('State mismatch - possible CSRF attack');
}
```

### 5. Exchange Authorization Code for Token

Your backend exchanges the `code` for an `access_token`:

```bash
curl -X POST http://localhost:3000/oauth/token \
  -H "Content-Type: application/json" \
  -d '{
    "grant_type": "authorization_code",
    "code": "119bfe990c2caa45bc786d492f70400c9b6e39f3de2930fe85a9b25173fb76eb",
    "client_id": "sauth_a3a6fc028c0ab7a200f4fedaac189eb9",
    "client_secret": "10a94eccf3242a59e8fe7b7153f932db8a6683054313fdab3896782a1b468f8f"
  }'
```

**Response:**
```json
{
  "access_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "token_type": "Bearer",
  "expires_in": 3600,
  "scope": "profile email"
}
```

### 6. Retrieve User Information

Use the access token to get the user's profile:

```bash
curl http://localhost:3000/oauth/userinfo \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
```

**Response:**
```json
{
  "sub": "66fcc4b2-70f8-4fd2-9976-55d118e3f488",
  "email": "dhanayendran@gmail.com",
  "name": "John Doe",
  "picture": "https://avatar.example.com/john.jpg"
}
```

---

## 📚 Complete Integration Examples

### Node.js / Express

```javascript
const express = require('express');
const axios = require('axios');
const crypto = require('crypto');
const session = require('express-session');

const app = express();
app.use(session({ secret: 'your-secret', resave: false, saveUninitialized: true }));

const STARVIEL_URL = 'http://localhost:3000';
const CLIENT_ID = 'sauth_a3a6fc028c0ab7a200f4fedaac189eb9';
const CLIENT_SECRET = 'your_client_secret_here';
const REDIRECT_URI = 'http://localhost:8080/auth/callback';

// Step 1: Redirect to Starviel
app.get('/auth/login', (req, res) => {
  const state = crypto.randomBytes(16).toString('hex');
  req.session.oauthState = state;

  const authUrl = new URL(`${STARVIEL_URL}/oauth/authorize`);
  authUrl.searchParams.append('client_id', CLIENT_ID);
  authUrl.searchParams.append('redirect_uri', REDIRECT_URI);
  authUrl.searchParams.append('response_type', 'code');
  authUrl.searchParams.append('scope', 'profile email');
  authUrl.searchParams.append('state', state);

  res.redirect(authUrl.toString());
});

// Step 2: Handle callback
app.get('/auth/callback', async (req, res) => {
  const { code, state } = req.query;

  // Verify state
  if (state !== req.session.oauthState) {
    return res.status(403).json({ error: 'Invalid state parameter' });
  }

  try {
    // Step 3: Exchange code for token
    const tokenResponse = await axios.post(`${STARVIEL_URL}/oauth/token`, {
      grant_type: 'authorization_code',
      code,
      client_id: CLIENT_ID,
      client_secret: CLIENT_SECRET
    });

    const accessToken = tokenResponse.data.access_token;

    // Step 4: Get user info
    const userResponse = await axios.get(`${STARVIEL_URL}/oauth/userinfo`, {
      headers: { Authorization: `Bearer ${accessToken}` }
    });

    const user = userResponse.data;

    // Create/update user in your database
    req.session.user = {
      id: user.sub,
      email: user.email,
      name: user.name,
      picture: user.picture
    };

    res.redirect('/dashboard');
  } catch (error) {
    console.error('OAuth error:', error.message);
    res.status(500).json({ error: 'Authentication failed' });
  }
});

app.listen(8080, () => console.log('App running on port 8080'));
```

### React / Next.js

```javascript
// pages/login.jsx
export default function LoginPage() {
  const handleStarvielLogin = () => {
    const state = Math.random().toString(36).substring(7);
    sessionStorage.setItem('oauthState', state);

    const authUrl = new URL('http://localhost:3000/oauth/authorize');
    authUrl.searchParams.append('client_id', process.env.REACT_APP_CLIENT_ID);
    authUrl.searchParams.append('redirect_uri', `${window.location.origin}/auth/callback`);
    authUrl.searchParams.append('response_type', 'code');
    authUrl.searchParams.append('scope', 'profile email');
    authUrl.searchParams.append('state', state);

    window.location.href = authUrl.toString();
  };

  return (
    <div>
      <h1>Sign In</h1>
      <button onClick={handleStarvielLogin} style={{ 
        backgroundColor: '#a855f7', 
        color: 'white', 
        padding: '12px 24px',
        border: 'none',
        borderRadius: '8px',
        cursor: 'pointer',
        fontSize: '16px',
        fontWeight: '600'
      }}>
        Continue with Starviel
      </button>
    </div>
  );
}

// pages/auth/callback.jsx
import { useEffect } from 'react';
import { useRouter } from 'next/router';
import axios from 'axios';

export default function AuthCallback() {
  const router = useRouter();
  const { code, state } = router.query;

  useEffect(() => {
    if (!code) return;

    const verifyAndLogin = async () => {
      const savedState = sessionStorage.getItem('oauthState');
      if (state !== savedState) {
        router.push('/login?error=state_mismatch');
        return;
      }

      try {
        // Call your backend to exchange code for token
        const response = await axios.post('/api/auth/starviel', { code });
        
        // Store token
        localStorage.setItem('accessToken', response.data.accessToken);
        
        // Redirect to dashboard
        router.push('/dashboard');
      } catch (error) {
        router.push(`/login?error=${error.message}`);
      }
    };

    verifyAndLogin();
  }, [code, state, router]);

  return <div>Authenticating...</div>;
}
```

### Python / Flask

```python
from flask import Flask, redirect, request, session, jsonify
from requests_oauthlib import OAuth2Session
import os

app = Flask(__name__)
app.secret_key = 'your-secret-key'

STARVIEL_URL = 'http://localhost:3000'
CLIENT_ID = 'sauth_a3a6fc028c0ab7a200f4fedaac189eb9'
CLIENT_SECRET = 'your_client_secret'
REDIRECT_URI = 'http://localhost:5000/auth/callback'

@app.route('/auth/login')
def starviel_login():
    starviel = OAuth2Session(
        CLIENT_ID,
        redirect_uri=REDIRECT_URI,
        scope=['profile', 'email']
    )
    authorization_url, state = starviel.authorization_url(
        f'{STARVIEL_URL}/oauth/authorize'
    )
    session['oauth_state'] = state
    return redirect(authorization_url)

@app.route('/auth/callback')
def starviel_callback():
    starviel = OAuth2Session(
        CLIENT_ID,
        redirect_uri=REDIRECT_URI,
        state=session['oauth_state']
    )
    token = starviel.fetch_token(
        f'{STARVIEL_URL}/oauth/token',
        client_secret=CLIENT_SECRET,
        authorization_response=request.url
    )

    user = starviel.get(f'{STARVIEL_URL}/oauth/userinfo').json()
    
    session['user'] = user
    return redirect('/dashboard')

if __name__ == '__main__':
    app.run(port=5000)
```

---

## 🔐 Security Best Practices

1. **Always use HTTPS in production** - Never send credentials over HTTP
2. **Validate the state parameter** - Prevent CSRF attacks
3. **Never expose client_secret in frontend code** - Only use in backend
4. **Use PKCE for public clients** - Mobile/SPA applications without backend
5. **Set short token expiration** - Access tokens expire in 1 hour
6. **Implement token refresh** - Use refresh tokens if provided
7. **Validate token signatures** - Verify JWT signatures on the backend

---

## 🧪 Testing

### Using the API Tester

Visit: `http://localhost:3000/api-tester.html`

1. Sign in with your Starviel account
2. Scroll to "Starviel OAuth Provider" section
3. Register a test app
4. Click "Start OAuth Flow"
5. Approve access
6. Click "Exchange Code" to get token
7. Click "Get User Info" to retrieve profile

---

## ⚠️ Error Codes

| Error | Description | Solution |
|-------|-------------|----------|
| `invalid_client` | Client ID not found | Verify client_id is correct |
| `invalid_grant` | Invalid code or expired | Codes expire after 10 minutes |
| `invalid_scope` | Scope not allowed | Ensure scopes are: `profile` or `email` |
| `redirect_uri_mismatch` | URI doesn't match registration | Exact match required (including protocol) |
| `access_denied` | User rejected access | User declined consent |

---

## 📖 Additional Resources

- [OAuth 2.0 Specification](https://tools.ietf.org/html/rfc6749)
- [OpenID Connect](https://openid.net/connect/)
- [PKCE (RFC 7636)](https://tools.ietf.org/html/rfc7636)

---

## 🆘 Support

For issues or questions:
- Email: support@starviel.io
- Docs: https://starviel.io/docs
- API Reference: [api.md](./api.md)
    client_secret: CLIENT_SECRET
  });

  // Get user info
  const userRes = await axios.get(`${SAUTH_URL}/oauth/userinfo`, {
    headers: { Authorization: `Bearer ${tokenRes.data.access_token}` }
  });

  req.session.user = userRes.data;
  res.redirect('/dashboard');
});
```

### React (with PKCE for SPAs)

```jsx
// Generate PKCE challenge
function generatePKCE() {
  const verifier = crypto.randomUUID() + crypto.randomUUID();
  const encoder = new TextEncoder();
  const data = encoder.encode(verifier);
  return crypto.subtle.digest('SHA-256', data).then(hash => {
    const challenge = btoa(String.fromCharCode(...new Uint8Array(hash)))
      .replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
    return { verifier, challenge };
  });
}

// Login button
async function handleLogin() {
  const { verifier, challenge } = await generatePKCE();
  sessionStorage.setItem('pkce_verifier', verifier);
  
  const params = new URLSearchParams({
    client_id: 'sauth_...',
    redirect_uri: window.location.origin + '/callback',
    response_type: 'code',
    scope: 'profile email',
    code_challenge: challenge,
    code_challenge_method: 'S256'
  });
  
  window.location.href = `https://auth.susindran.in/oauth/authorize?${params}`;
}

// Callback handler
async function handleCallback(code) {
  const verifier = sessionStorage.getItem('pkce_verifier');
  
  const res = await fetch('https://auth.susindran.in/oauth/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      grant_type: 'authorization_code',
      code,
      client_id: 'sauth_...',
      code_verifier: verifier
    })
  });
  
  const { access_token } = await res.json();
  // Use access_token to call /oauth/userinfo
}
```

---

## Endpoints Reference

| Endpoint | Method | Description |
|---|---|---|
| `/oauth/authorize` | GET | Shows login + consent page |
| `/oauth/authorize` | POST | Processes consent (internal) |
| `/oauth/token` | POST | Exchanges code for access token |
| `/oauth/userinfo` | GET | Returns user profile (Bearer token required) |

## Scopes

| Scope | Data Returned |
|---|---|
| `profile` | `name`, `picture` |
| `email` | `email` |

## Security Notes

- Authorization codes expire in **60 seconds**.
- Access tokens expire in **1 hour**.
- Use `state` parameter to prevent CSRF attacks.
- For SPAs/mobile apps, use **PKCE** instead of `client_secret`.
- All communication should use HTTPS in production.
