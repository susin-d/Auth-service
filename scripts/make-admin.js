/**
 * Make User Admin Script
 * Promotes a user to admin role by email
 * 
 * Usage: node scripts/make-admin.js <email>
 * Example: node scripts/make-admin.js admin@example.com
 */

require('dotenv').config();
const db = require('../src/config/db');

async function makeAdmin(email) {
  if (!email) {
    console.error('❌ Error: Email is required');
    console.log('Usage: node scripts/make-admin.js <email>');
    process.exit(1);
  }

  console.log(`🔍 Looking for user: ${email}`);

  try {
    // Find user by email
    const result = await db.query(
      'SELECT id, email, role, account_status FROM users WHERE email = $1 LIMIT 1',
      [email]
    );

    const user = result.rows[0];

    if (!user) {
      console.error(`❌ User not found: ${email}`);
      process.exit(1);
    }

    console.log(`✅ User found: ${user.email}`);
    console.log(`   Current role: ${user.role || 'user'}`);
    console.log(`   Account status: ${user.account_status}`);

    if (user.role === 'admin') {
      console.log('ℹ️  User is already an admin');
      process.exit(0);
    }

    // Update user role to admin
    await db.query(
      'UPDATE users SET role = $1 WHERE id = $2',
      ['admin', user.id]
    );

    console.log('✅ User successfully promoted to admin!');
    console.log(`   Email: ${user.email}`);
    console.log(`   Role: admin`);
    console.log('\n🎉 Done! User can now access admin-only endpoints.');
    process.exit(0);
  } catch (error) {
    console.error('❌ Database error:', error.message);
    process.exit(1);
  }
}

// Get email from command line arguments
const email = process.argv[2];
makeAdmin(email);
