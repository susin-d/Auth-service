/**
 * Email Test Script - v1.0.1
 * Standalone script to test Brevo email integration
 */

require('dotenv').config();
const EmailService = require('../src/services/email.service');

async function testMail() {
  console.log('Starting Brevo Email Test...');

  const recipient = 'test@example.com';
  const verificationLink = process.env.TEST_VERIFICATION_LINK
    || `${process.env.FRONTEND_URL || 'http://localhost:3000'}/verify?token=test-token`;

  try {
    console.log(`Sending test email to: ${recipient}...`);
    const result = await EmailService.sendWelcomeEmail(recipient, verificationLink);

    if (result && result.messageId) {
      console.log('SUCCESS');
      console.log('Message ID:', result.messageId);
      console.log('Check your inbox (and your spam folder).');
    }
  } catch (error) {
    console.error('FAILED');
    if (error.response) {
      console.error('Error Code:', error.response.status);
      console.error('Error Detail:', error.response.text);
    } else {
      console.error('Error:', error.message);
    }
  }
}

testMail();
