/**
 * Auth Routes - v1.0.2
 * API v1 route definitions with validation middleware
 */

const express = require('express');
const router = express.Router();
const authController = require('../controllers/auth.controller');
const { protect, requireAdmin } = require('../middleware/auth.middleware');
const { signupValidation, signinValidation, resendVerificationValidation } = require('../middleware/validator.middleware');

// Public Routes
router.post('/signup', signupValidation, authController.register);
router.post('/signin', signinValidation, authController.login);
router.get('/verify-email', authController.verifyEmail);
router.post('/resend-verification', resendVerificationValidation, authController.resendVerification);
router.get('/google', authController.googleAuth);
router.get('/google/callback', authController.googleCallback);
router.post('/exchange-code', authController.exchangeCode);

// Protected Routes
router.post('/complete-verification', protect, authController.completeVerification);
router.get('/profile', protect, authController.getProfile);
router.put('/profile', protect, authController.updateProfile);
router.delete('/delete-account', protect, authController.removeAccount);

// Admin-only Routes
router.post('/broadcast-email', protect, requireAdmin, authController.broadcastEmail);
router.get('/admin/users', protect, requireAdmin, authController.getAllUsers);
router.get('/admin/users/:userId', protect, requireAdmin, authController.getUserById);
router.put('/admin/users/:userId', protect, requireAdmin, authController.updateUser);
router.delete('/admin/users/:userId', protect, requireAdmin, authController.deleteUser);

// Admin: OAuth Client Management
router.post('/admin/oauth-clients', protect, requireAdmin, authController.registerOAuthClient);
router.get('/admin/oauth-clients', protect, requireAdmin, authController.listOAuthClients);
router.delete('/admin/oauth-clients/:clientId', protect, requireAdmin, authController.deleteOAuthClient);
router.post('/admin/refresh-cors', protect, requireAdmin, authController.refreshCors);

// Developer: Self-service OAuth App Management (any authenticated user)
router.post('/developer/apps', protect, authController.devRegisterApp);
router.get('/developer/apps', protect, authController.devListApps);
router.delete('/developer/apps/:clientId', protect, authController.devDeleteApp);

module.exports = router;
