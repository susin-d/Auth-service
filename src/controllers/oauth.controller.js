/**
 * OAuth Controller - v1.0.0
 * HTTP handlers for OAuth2 Authorization Server endpoints
 */

const OAuthService = require('../services/oauth.service');
const AuthService = require('../services/auth.service');
const auditLogger = require('../utils/audit.logger');
const jwt = require('jsonwebtoken');
const path = require('path');
const fs = require('fs');

/**
 * GET /oauth/authorize
 * Shows the login + consent page
 */
exports.authorize = async (req, res) => {
  try {
    const { client_id, redirect_uri, response_type, scope, state, code_challenge, code_challenge_method } = req.query;

    // Validate required params
    if (!client_id || !redirect_uri || !response_type) {
      return res.status(400).json({
        error: 'invalid_request',
        error_description: 'Missing required parameters: client_id, redirect_uri, response_type'
      });
    }

    if (response_type !== 'code') {
      return res.status(400).json({
        error: 'unsupported_response_type',
        error_description: 'Only response_type=code is supported'
      });
    }

    // Validate client and redirect URI
    const client = await OAuthService.validateClient(client_id, redirect_uri);
    const scopes = OAuthService.validateScopes(scope, client.scopes);

    // Render the consent page with client info embedded
    const consentHtml = buildConsentPage({
      clientName: client.client_name,
      clientDescription: client.client_description,
      logoUrl: client.logo_url,
      scopes,
      clientId: client_id,
      redirectUri: redirect_uri,
      state: state || '',
      codeChallenge: code_challenge || '',
      codeChallengeMethod: code_challenge_method || 'S256'
    });

    res.type('html').send(consentHtml);
  } catch (err) {
    console.error('OAuth authorize error:', err);
    res.status(400).json({
      error: 'invalid_request',
      error_description: err.message
    });
  }
};

/**
 * POST /oauth/authorize
 * Processes login + consent form submission, issues authorization code
 */
exports.authorizeSubmit = async (req, res) => {
  try {
    const { email, password, client_id, redirect_uri, scopes, state, code_challenge, code_challenge_method, action } = req.body;

    // User denied
    if (action === 'deny') {
      const redirectUrl = new URL(redirect_uri);
      redirectUrl.searchParams.set('error', 'access_denied');
      redirectUrl.searchParams.set('error_description', 'The user denied the authorization request');
      if (state) redirectUrl.searchParams.set('state', state);
      return res.redirect(redirectUrl.toString());
    }

    // Validate client
    await OAuthService.validateClient(client_id, redirect_uri);

    // Authenticate user
    let loginResult;
    try {
      loginResult = await AuthService.signIn(email, password);
    } catch (authErr) {
      // Re-render consent page with error
      const parsedScopes = typeof scopes === 'string' ? scopes.split(',') : scopes;
      const consentHtml = buildConsentPage({
        clientName: client_id,
        scopes: parsedScopes || ['profile', 'email'],
        clientId: client_id,
        redirectUri: redirect_uri,
        state: state || '',
        codeChallenge: code_challenge || '',
        codeChallengeMethod: code_challenge_method || 'S256',
        error: authErr.message
      });
      return res.type('html').send(consentHtml);
    }

    const userId = loginResult.user.id;
    const parsedScopes = typeof scopes === 'string' ? scopes.split(',') : (scopes || ['profile', 'email']);

    // Generate authorization code
    const code = await OAuthService.generateAuthorizationCode(
      userId, client_id, redirect_uri, parsedScopes,
      code_challenge || null, code_challenge_method || 'S256', state
    );

    await auditLogger.log('OAUTH_CODE_ISSUED', {
      userId,
      clientId: client_id,
      scopes: parsedScopes,
      ip: req.ip || req.connection.remoteAddress
    });

    // Redirect back to client with code
    const redirectUrl = new URL(redirect_uri);
    redirectUrl.searchParams.set('code', code);
    if (state) redirectUrl.searchParams.set('state', state);

    return res.redirect(redirectUrl.toString());
  } catch (err) {
    console.error('OAuth authorize submit error:', err);
    res.status(400).json({
      error: 'server_error',
      error_description: err.message
    });
  }
};

/**
 * POST /oauth/token
 * Exchanges authorization code for access token
 */
exports.token = async (req, res) => {
  try {
    const { grant_type, code, client_id, client_secret, code_verifier, redirect_uri } = req.body;

    if (grant_type !== 'authorization_code') {
      return res.status(400).json({
        error: 'unsupported_grant_type',
        error_description: 'Only grant_type=authorization_code is supported'
      });
    }

    if (!code || !client_id) {
      return res.status(400).json({
        error: 'invalid_request',
        error_description: 'Missing required parameters: code, client_id'
      });
    }

    const tokenData = await OAuthService.exchangeCode(code, client_id, client_secret, code_verifier);

    await auditLogger.log('OAUTH_TOKEN_ISSUED', {
      clientId: client_id,
      ip: req.ip || req.connection.remoteAddress
    });

    // Standard OAuth2 token response
    res.json(tokenData);
  } catch (err) {
    console.error('OAuth token error:', err);
    res.status(400).json({
      error: 'invalid_grant',
      error_description: err.message
    });
  }
};

/**
 * GET /oauth/userinfo
 * Returns user profile based on token scopes
 */
exports.userinfo = async (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({
        error: 'invalid_token',
        error_description: 'Bearer token required'
      });
    }

    const token = authHeader.split(' ')[1];
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    // Verify this is an OAuth token (has aud and iss)
    if (decoded.iss !== 's-auth') {
      return res.status(401).json({
        error: 'invalid_token',
        error_description: 'Token was not issued by S-Auth OAuth provider'
      });
    }

    const userInfo = OAuthService.getUserInfoFromToken(decoded);
    res.json(userInfo);
  } catch (err) {
    console.error('OAuth userinfo error:', err);
    res.status(401).json({
      error: 'invalid_token',
      error_description: err.message
    });
  }
};


/**
 * Build the server-rendered consent page HTML
 */
function buildConsentPage({ clientName, clientDescription, logoUrl, scopes, clientId, redirectUri, state, codeChallenge, codeChallengeMethod, error }) {
  const scopeLabels = {
    'profile': { icon: '👤', label: 'Profile', desc: 'Your name and profile picture' },
    'email': { icon: '✉️', label: 'Email', desc: 'Your email address' }
  };

  const scopeItems = (scopes || ['profile', 'email']).map(s => {
    const info = scopeLabels[s] || { icon: '🔑', label: s, desc: s };
    return `
      <div style="display:flex;align-items:center;gap:12px;padding:12px 16px;background:rgba(255,255,255,0.03);border-radius:12px;border:1px solid rgba(255,255,255,0.08)">
        <span style="font-size:1.25rem">${info.icon}</span>
        <div>
          <div style="font-weight:500;color:#f8fafc;font-size:0.9375rem">${info.label}</div>
          <div style="color:#94a3b8;font-size:0.8125rem">${info.desc}</div>
        </div>
      </div>`;
  }).join('');

  const errorHtml = error ? `
    <div style="padding:12px 16px;border-radius:10px;background:rgba(239,68,68,0.1);color:#f87171;border:1px solid rgba(239,68,68,0.2);font-size:0.875rem;margin-bottom:1.5rem">
      ${error}
    </div>` : '';

  const logoHtml = logoUrl
    ? `<img src="${logoUrl}" alt="${clientName}" style="width:48px;height:48px;border-radius:12px;object-fit:cover">`
    : `<div style="width:48px;height:48px;border-radius:12px;background:hsla(262,83%,58%,0.2);display:flex;align-items:center;justify-content:center;font-size:1.5rem;color:hsl(262,83%,58%);font-weight:700">${(clientName || 'A')[0].toUpperCase()}</div>`;

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Sign in — S-Auth</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&display=swap" rel="stylesheet">
  <style>
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: 'Inter', system-ui, sans-serif;
      min-height: 100vh;
      display: flex;
      align-items: center;
      justify-content: center;
      background: #0a0b10;
      color: #f8fafc;
      position: relative;
      overflow: hidden;
    }
    .blob { position:absolute; border-radius:50%; filter:blur(80px); opacity:0.5; animation:drift 20s infinite alternate ease-in-out; }
    .blob-1 { width:500px; height:500px; background:hsla(262,83%,58%,0.35); top:-100px; left:-100px; }
    .blob-2 { width:600px; height:600px; background:hsla(210,100%,50%,0.25); bottom:-150px; right:-150px; animation-delay:-7s; }
    .blob-3 { width:350px; height:350px; background:hsla(280,80%,60%,0.2); top:40%; left:35%; animation-delay:-12s; }
    @keyframes drift { 0%{transform:translate(0,0)scale(1)} 50%{transform:translate(40px,80px)scale(1.08)} 100%{transform:translate(-20px,40px)scale(0.95)} }

    .card {
      position:relative; z-index:1;
      width:100%; max-width:420px; margin:1rem;
      background:rgba(255,255,255,0.05);
      backdrop-filter:blur(20px); -webkit-backdrop-filter:blur(20px);
      border:1px solid rgba(255,255,255,0.12);
      border-radius:1.5rem;
      padding:2.5rem;
      box-shadow:0 8px 32px rgba(0,0,0,0.37);
      animation:slideUp 0.4s ease-out;
    }
    @keyframes slideUp { from{opacity:0;transform:translateY(20px)} to{opacity:1;transform:translateY(0)} }

    .header { text-align:center; margin-bottom:1.75rem; }
    .header h1 { font-size:1.375rem; font-weight:600; margin-bottom:0.25rem; }
    .header p { color:#94a3b8; font-size:0.875rem; }

    .app-info { display:flex; align-items:center; gap:1rem; margin-bottom:1.75rem; padding:1rem; background:rgba(255,255,255,0.03); border-radius:1rem; border:1px solid rgba(255,255,255,0.08); }
    .app-info .name { font-weight:600; font-size:1rem; }
    .app-info .desc { color:#94a3b8; font-size:0.8125rem; }

    .scopes-title { font-size:0.8125rem; color:#94a3b8; margin-bottom:0.75rem; text-transform:uppercase; letter-spacing:0.05em; }
    .scopes-list { display:flex; flex-direction:column; gap:0.5rem; margin-bottom:1.75rem; }

    .input-group { margin-bottom:1rem; }
    .input-label { display:block; margin-bottom:0.375rem; font-size:0.8125rem; color:#94a3b8; }
    .input-field {
      width:100%; padding:0.75rem 1rem;
      background:rgba(0,0,0,0.3); border:1px solid rgba(255,255,255,0.1);
      border-radius:0.625rem; color:#f8fafc; outline:none;
      font-size:0.9375rem; transition:border-color 0.2s;
    }
    .input-field:focus { border-color:hsl(262,83%,58%); box-shadow:0 0 0 2px hsla(262,83%,58%,0.3); }

    .btn-row { display:flex; gap:0.75rem; margin-top:1.5rem; }
    .btn {
      flex:1; padding:0.75rem; border-radius:0.625rem; border:none;
      font-weight:600; font-size:0.9375rem; cursor:pointer; transition:all 0.2s;
    }
    .btn-primary { background:hsl(262,83%,58%); color:#fff; box-shadow:0 0 15px hsla(262,83%,58%,0.3); }
    .btn-primary:hover { filter:brightness(1.1); transform:translateY(-1px); }
    .btn-secondary { background:rgba(255,255,255,0.06); color:#94a3b8; border:1px solid rgba(255,255,255,0.1); }
    .btn-secondary:hover { background:rgba(255,255,255,0.1); }

    .footer { margin-top:2rem; text-align:center; font-size:0.75rem; color:#64748b; }
    .footer a { color:hsl(262,83%,58%); text-decoration:none; }
  </style>
</head>
<body>
  <div class="blob blob-1"></div>
  <div class="blob blob-2"></div>
  <div class="blob blob-3"></div>

  <div class="card">
    <div class="header">
      <h1>Sign in with S-Auth</h1>
      <p>Authorize access to your account</p>
    </div>

    <div class="app-info">
      ${logoHtml}
      <div>
        <div class="name">${clientName || 'Unknown App'}</div>
        <div class="desc">${clientDescription || 'wants to access your account'}</div>
      </div>
    </div>

    ${errorHtml}

    <div class="scopes-title">This app will be able to access:</div>
    <div class="scopes-list">${scopeItems}</div>

    <form method="POST" action="/oauth/authorize">
      <input type="hidden" name="client_id" value="${clientId}">
      <input type="hidden" name="redirect_uri" value="${redirectUri}">
      <input type="hidden" name="scopes" value="${(scopes || []).join(',')}">
      <input type="hidden" name="state" value="${state}">
      <input type="hidden" name="code_challenge" value="${codeChallenge}">
      <input type="hidden" name="code_challenge_method" value="${codeChallengeMethod}">

      <div class="input-group">
        <label class="input-label">Email</label>
        <input type="email" name="email" class="input-field" placeholder="you@example.com" required>
      </div>
      <div class="input-group">
        <label class="input-label">Password</label>
        <input type="password" name="password" class="input-field" placeholder="••••••••" required>
      </div>

      <div class="btn-row">
        <button type="submit" name="action" value="deny" class="btn btn-secondary">Deny</button>
        <button type="submit" name="action" value="approve" class="btn btn-primary">Approve</button>
      </div>
    </form>

    <div class="footer">
      Powered by <a href="#">S-Auth</a> • Starviel Authentication
    </div>
  </div>
</body>
</html>`;
}
