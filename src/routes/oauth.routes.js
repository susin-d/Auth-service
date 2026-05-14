/**
 * OAuth Routes - v1.0.0
 * OAuth2 Authorization Server endpoints
 */

const express = require('express');
const router = express.Router();
const oauthController = require('../controllers/oauth.controller');

// Authorization endpoint (shows consent page)
router.get('/authorize', oauthController.authorize);

// Authorization submission (processes login + consent)
router.post('/authorize', oauthController.authorizeSubmit);

// Token exchange endpoint
router.post('/token', oauthController.token);

// User info endpoint
router.get('/userinfo', oauthController.userinfo);

module.exports = router;
