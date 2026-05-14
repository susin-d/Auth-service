/**
 * Validator Middleware - v1.0.2
 * Input validation and sanitization with password strength rules
 */

const { body, validationResult } = require('express-validator');
const validator = require('validator');

// Validation middleware
const validate = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    const errorList = errors.array().map(err => ({ 
      field: err.path, 
      message: err.msg 
    }));
    
    // Create a user-friendly summary
    const firstError = errorList[0];
    const summary = errorList.length === 1 
      ? firstError.message
      : `${firstError.message} (and ${errorList.length - 1} more error${errorList.length > 2 ? 's' : ''})`;
    
    return res.status(400).json({ 
      error: summary,
      validation_errors: errorList,
      details: process.env.NODE_ENV === 'development' ? errors.array() : undefined
    });
  }
  next();
};

// Password strength validator
const isStrongPassword = (password) => {
  return validator.isStrongPassword(password, {
    minLength: 8,
    minLowercase: 1,
    minUppercase: 1,
    minNumbers: 1,
    minSymbols: 0
  });
};

// Email and password validation rules
const signupValidation = [
  body('email')
    .trim()
    .isEmail().withMessage('Invalid email address')
    .normalizeEmail()
    .isLength({ max: 255 }).withMessage('Email too long'),
  
  body('password')
    .isLength({ min: 8 }).withMessage('Password must be at least 8 characters')
    .custom((value) => {
      if (!isStrongPassword(value)) {
        throw new Error('Password must contain uppercase, lowercase, and number');
      }
      return true;
    }),
  
  body('frontendUrl')
    .optional()
    .trim()
    .isURL({ protocols: ['https'], require_protocol: true })
    .withMessage('Frontend URL must be a valid HTTPS URL'),
  
  validate
];

const signinValidation = [
  body('email')
    .trim()
    .isEmail().withMessage('Invalid email address')
    .normalizeEmail(),
  
  body('password')
    .notEmpty().withMessage('Password is required'),
  
  validate
];

const resendVerificationValidation = [
  body('email')
    .trim()
    .isEmail().withMessage('Invalid email address')
    .normalizeEmail()
    .isLength({ max: 255 }).withMessage('Email too long'),
  
  body('frontendUrl')
    .optional()
    .trim()
    .isURL({ protocols: ['https'], require_protocol: true })
    .withMessage('Frontend URL must be a valid HTTPS URL'),
  
  validate
];

// Sanitize inputs to prevent XSS
const sanitizeInput = (str) => {
  if (typeof str !== 'string') return str;
  return validator.escape(str);
};

module.exports = {
  signupValidation,
  signinValidation,
  resendVerificationValidation,
  validate,
  sanitizeInput
};
