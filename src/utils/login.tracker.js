/**
 * Login Attempt Tracker - v1.0.1
 * Failed login protection with account lockout mechanism
 */

const db = require('../config/db');
const securityConfig = require('../config/security.config');
const auditLogger = require('../utils/audit.logger');

class LoginAttemptTracker {
  constructor() {
    this.attempts = new Map(); // In-memory cache for performance
  }

  getKey(email) {
    return email.toLowerCase();
  }

  async recordFailedAttempt(email, ip) {
    const key = this.getKey(email);
    const now = Date.now();

    // Get current attempts from memory
    let attemptData = this.attempts.get(key) || {
      count: 0,
      firstAttempt: now,
      lastAttempt: now,
      lockedUntil: null
    };

    // Reset if past reset window
    if (now - attemptData.lastAttempt > securityConfig.failedLoginAttempts.resetAfter) {
      attemptData = {
        count: 0,
        firstAttempt: now,
        lastAttempt: now,
        lockedUntil: null
      };
    }

    attemptData.count++;
    attemptData.lastAttempt = now;

    // Lock account if max attempts exceeded
    if (attemptData.count >= securityConfig.failedLoginAttempts.maxAttempts) {
      attemptData.lockedUntil = now + securityConfig.failedLoginAttempts.lockoutDuration;
      await auditLogger.log('ACCOUNT_LOCKED', {
        email,
        ip,
        attempts: attemptData.count,
        lockedUntil: new Date(attemptData.lockedUntil).toISOString()
      });
    }

    this.attempts.set(key, attemptData);

    // Also persist to database for distributed systems
    try {
      await db.query(
        `INSERT INTO login_attempts (email, attempts, first_attempt, last_attempt, locked_until, ip_address)
         VALUES ($1, $2, $3, $4, $5, $6)
         ON CONFLICT (email) DO UPDATE SET
           attempts = EXCLUDED.attempts,
           first_attempt = EXCLUDED.first_attempt,
           last_attempt = EXCLUDED.last_attempt,
           locked_until = EXCLUDED.locked_until,
           ip_address = EXCLUDED.ip_address,
           updated_at = NOW()`,
        [
          key,
          attemptData.count,
          new Date(attemptData.firstAttempt).toISOString(),
          new Date(attemptData.lastAttempt).toISOString(),
          attemptData.lockedUntil ? new Date(attemptData.lockedUntil).toISOString() : null,
          ip
        ]
      );
    } catch (error) {
      console.error('Failed to persist login attempt:', error.message);
    }

    await auditLogger.logFailedLogin(email, ip);

    return attemptData;
  }

  async isLocked(email) {
    const key = this.getKey(email);
    const now = Date.now();

    // Check memory first
    let attemptData = this.attempts.get(key);

    // If not in memory, check database
    if (!attemptData) {
      try {
        const result = await db.query(
          'SELECT * FROM login_attempts WHERE email = $1 LIMIT 1',
          [key]
        );

        if (result.rows.length > 0) {
          const data = result.rows[0];
          attemptData = {
            count: data.attempts,
            firstAttempt: new Date(data.first_attempt).getTime(),
            lastAttempt: new Date(data.last_attempt).getTime(),
            lockedUntil: data.locked_until ? new Date(data.locked_until).getTime() : null
          };
          this.attempts.set(key, attemptData);
        }
      } catch (error) {
        // No record found or error - allow login attempt
        return { locked: false };
      }
    }

    if (!attemptData || !attemptData.lockedUntil) {
      return { locked: false };
    }

    // Check if still locked
    if (now < attemptData.lockedUntil) {
      const remainingTime = Math.ceil((attemptData.lockedUntil - now) / 1000 / 60);
      return {
        locked: true,
        remainingMinutes: remainingTime,
        attempts: attemptData.count
      };
    }

    // Lock expired, reset attempts
    attemptData.count = 0;
    attemptData.lockedUntil = null;
    this.attempts.set(key, attemptData);

    return { locked: false };
  }

  async clearAttempts(email) {
    const key = this.getKey(email);
    this.attempts.delete(key);

    try {
      await db.query('DELETE FROM login_attempts WHERE email = $1', [key]);
    } catch (error) {
      console.error('Failed to clear login attempts:', error.message);
    }
  }
}

module.exports = new LoginAttemptTracker();
