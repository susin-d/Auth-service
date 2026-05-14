/**
 * Email Service - v1.2.0
 * Brevo transactional email integration with retry logic and multiple email types
 */

const brevo = require('@getbrevo/brevo');

const RETRY_CONFIG = {
  maxRetries: 3,
  initialDelay: 1000, // 1 second
  maxDelay: 10000 // 10 seconds
};

class EmailService {
  constructor() {
    const apiInstance = new brevo.TransactionalEmailsApi();
    const apiKey = apiInstance.authentications['apiKey'];
    apiKey.apiKey = process.env.BREVO_API_KEY;
    
    this.apiInstance = apiInstance;
  }

  /**
   * Retry logic with exponential backoff
   */
  async sendWithRetry(emailData, retryCount = 0) {
    try {
      const data = await this.apiInstance.sendTransacEmail(emailData);
      return { success: true, data };
    } catch (error) {
      if (retryCount < RETRY_CONFIG.maxRetries) {
        const delay = Math.min(
          RETRY_CONFIG.initialDelay * Math.pow(2, retryCount),
          RETRY_CONFIG.maxDelay
        );
        console.warn(`📧 Email send failed, retrying in ${delay}ms (attempt ${retryCount + 1}/${RETRY_CONFIG.maxRetries})`);
        await new Promise(resolve => setTimeout(resolve, delay));
        return this.sendWithRetry(emailData, retryCount + 1);
      } else {
        throw error;
      }
    }
  }

  async sendVerificationEmail(toEmail, verificationLink) {
    const sendSmtpEmail = new brevo.SendSmtpEmail();

    sendSmtpEmail.subject = "Verify Your Email Address 📧";

    sendSmtpEmail.htmlContent = `
      <html>
        <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
          <div style="max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #ddd; border-radius: 8px;">
            <h1 style="color: #4285F4;">Verify Your Email Address</h1>
            <p>Thank you for signing up! Please verify your email address to activate your account.</p>
            <div style="margin: 30px 0;">
              <a href="${verificationLink}" 
                 style="background-color: #4285F4; color: white; padding: 12px 30px; text-decoration: none; border-radius: 5px; display: inline-block;">
                Verify Email Address
              </a>
            </div>
            <p style="color: #666; font-size: 14px;">If you didn't create this account, you can safely ignore this email.</p>
            <p style="color: #666; font-size: 14px;">This link will expire in 24 hours.</p>
          </div>
        </body>
      </html>`;
    
    sendSmtpEmail.sender = { 
      name: process.env.BREVO_SENDER_NAME, 
      email: process.env.BREVO_SENDER_EMAIL 
    };
    
    sendSmtpEmail.to = [{ email: toEmail }];

    try {
      const result = await this.sendWithRetry(sendSmtpEmail);
      console.log('✅ Verification email sent successfully. Message ID:', result.data.messageId);
      return result.data;
    } catch (error) {
      console.error('❌ Verification email error after retries:', error);
      // We don't throw error here so the signup process doesn't crash 
      // if the email fails.
    }
  }

  async sendWelcomeEmail(toEmail, userName) {
    const sendSmtpEmail = new brevo.SendSmtpEmail();

    sendSmtpEmail.subject = "Welcome to Starviel! 🚀";
    const displayName = userName || toEmail.split('@')[0];

    sendSmtpEmail.htmlContent = `
      <html>
        <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
          <div style="max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #ddd; border-radius: 8px;">
            <h1 style="color: #34A853;">Welcome aboard, ${displayName}! 🎉</h1>
            <p>Your email has been verified successfully!</p>
            <p>Thank you for joining Starviel. Your account is now fully active and ready to use.</p>
            <div style="background-color: #f8f9fa; padding: 20px; border-radius: 5px; margin: 20px 0;">
              <h3 style="margin-top: 0; color: #4285F4;">What's Next?</h3>
              <ul style="padding-left: 20px;">
                <li>Complete your profile with additional information</li>
                <li>Explore our features and services</li>
                <li>Connect with our community</li>
              </ul>
            </div>
            <p>If you have any questions, feel free to reach out to our support team.</p>
            <p style="margin-top: 30px;">
              <a href="${process.env.FRONTEND_URL}" 
                 style="background-color: #34A853; color: white; padding: 12px 30px; text-decoration: none; border-radius: 5px; display: inline-block;">
                Get Started
              </a>
            </p>
            <hr style="border: none; border-top: 1px solid #ddd; margin: 30px 0;" />
            <p style="color: #666; font-size: 12px; text-align: center;">
              © 2026 Starviel. All rights reserved.
            </p>
          </div>
        </body>
      </html>`;
    
    sendSmtpEmail.sender = { 
      name: process.env.BREVO_SENDER_NAME, 
      email: process.env.BREVO_SENDER_EMAIL 
    };
    
    sendSmtpEmail.to = [{ email: toEmail }];

    try {
      const result = await this.sendWithRetry(sendSmtpEmail);
      console.log('✅ Welcome email sent successfully. Message ID:', result.data.messageId);
      return result.data;
    } catch (error) {
      console.error('❌ Welcome email error after retries:', error);
      // We don't throw error here so it doesn't affect the verification flow
    }
  }

  async sendPasswordResetEmail(toEmail, resetLink) {
    const sendSmtpEmail = new brevo.SendSmtpEmail();

    sendSmtpEmail.subject = "Reset Your Password 🔐";

    sendSmtpEmail.htmlContent = `
      <html>
        <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
          <div style="max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #ddd; border-radius: 8px;">
            <h1 style="color: #F59E0B;">Reset Your Password</h1>
            <p>We received a request to reset your password. Click the button below to set a new password.</p>
            <div style="margin: 30px 0;">
              <a href="${resetLink}" 
                 style="background-color: #F59E0B; color: white; padding: 12px 30px; text-decoration: none; border-radius: 5px; display: inline-block;">
                Reset Password
              </a>
            </div>
            <p style="color: #666; font-size: 14px;"><strong>⏰ This link expires in 1 hour.</strong></p>
            <p style="color: #666; font-size: 14px;">If you didn't request a password reset, you can safely ignore this email.</p>
            <p style="color: #666; font-size: 14px;"><strong>⚠️ Never share this link with anyone.</strong></p>
          </div>
        </body>
      </html>`;
    
    sendSmtpEmail.sender = { 
      name: process.env.BREVO_SENDER_NAME, 
      email: process.env.BREVO_SENDER_EMAIL 
    };
    
    sendSmtpEmail.to = [{ email: toEmail }];

    try {
      const result = await this.sendWithRetry(sendSmtpEmail);
      console.log('✅ Password reset email sent successfully. Message ID:', result.data.messageId);
      return result.data;
    } catch (error) {
      console.error('❌ Password reset email error after retries:', error);
      // We don't throw error here so the password reset flow doesn't crash
    }
  }

  async sendAccountDeletionEmail(toEmail, userName) {
    const sendSmtpEmail = new brevo.SendSmtpEmail();

    sendSmtpEmail.subject = "Your Account Has Been Deleted ";

    const displayName = userName || toEmail.split('@')[0];

    sendSmtpEmail.htmlContent = `
      <html>
        <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
          <div style="max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #ddd; border-radius: 8px;">
            <h1 style="color: #EF4444;">Account Deletion Confirmation</h1>
            <p>Hi ${displayName},</p>
            <p>This email confirms that your Starviel account associated with <strong>${toEmail}</strong> has been successfully deleted.</p>
            
            <div style="background-color: #fef2f2; border-left: 4px solid #EF4444; padding: 15px; margin: 20px 0; border-radius: 5px;">
              <p style="margin: 0; color: #7F1D1D;">
                <strong>⚠️ What this means:</strong>
              </p>
              <ul style="margin: 10px 0 0 0; color: #7F1D1D;">
                <li>Your profile and all associated data have been permanently deleted</li>
                <li>You will not be able to sign in with this email</li>
                <li>This action cannot be undone</li>
              </ul>
            </div>
            
            <p style="color: #666; font-size: 14px;">If you believe this was done in error or have any questions, please contact our support team immediately.</p>
            
            <p style="margin-top: 30px;">
              <a href="${process.env.FRONTEND_URL}/contact" 
                 style="background-color: #3B82F6; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px; display: inline-block;">
                Contact Support
              </a>
            </p>
            
            <hr style="border: none; border-top: 1px solid #ddd; margin: 30px 0;" />
            <p style="color: #666; font-size: 12px; text-align: center;">
              © 2026 Starviel. All rights reserved.
            </p>
          </div>
        </body>
      </html>`;
    
    sendSmtpEmail.sender = { 
      name: process.env.BREVO_SENDER_NAME, 
      email: process.env.BREVO_SENDER_EMAIL 
    };
    
    sendSmtpEmail.to = [{ email: toEmail }];

    try {
      const result = await this.sendWithRetry(sendSmtpEmail);
      console.log('✅ Account deletion confirmation email sent successfully. Message ID:', result.data.messageId);
      return result.data;
    } catch (error) {
      console.error('❌ Account deletion confirmation email error after retries:', error);
      // We don't throw error here so account deletion isn't blocked
    }
  }

  async sendBroadcastEmail(toEmail, subject, htmlContent) {
    const sendSmtpEmail = new brevo.SendSmtpEmail();

    sendSmtpEmail.subject = subject;
    sendSmtpEmail.htmlContent = htmlContent;
    
    sendSmtpEmail.sender = { 
      name: process.env.BREVO_SENDER_NAME, 
      email: process.env.BREVO_SENDER_EMAIL 
    };
    
    sendSmtpEmail.to = [{ email: toEmail }];

    try {
      const result = await this.sendWithRetry(sendSmtpEmail);
      return { success: true, messageId: result.data.messageId };
    } catch (error) {
      console.error('❌ Broadcast email error for', toEmail, ':', error.message);
      return { success: false, error: error.message };
    }
  }
}

module.exports = new EmailService();