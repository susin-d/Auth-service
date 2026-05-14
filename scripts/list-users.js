/**
 * List Users with Roles Script
 * Displays all users with their roles and status
 * 
 * Usage: node scripts/list-users.js
 */

require('dotenv').config();
const db = require('../src/config/db');

async function listUsers() {
  console.log('📋 Fetching all users...\n');

  try {
    const result = await db.query(
      'SELECT id, email, role, account_status, email_verified, created_at FROM users ORDER BY created_at DESC'
    );

    const users = result.rows;

    if (!users || users.length === 0) {
      console.log('ℹ️  No users found');
      process.exit(0);
    }

    console.log(`Found ${users.length} user(s):\n`);
    console.log('─'.repeat(100));
    console.log('Email'.padEnd(35), 'Role'.padEnd(10), 'Status'.padEnd(12), 'Verified'.padEnd(10), 'Created');
    console.log('─'.repeat(100));

    users.forEach(user => {
      const email = user.email.padEnd(35);
      const role = (user.role || 'user').padEnd(10);
      const status = user.account_status.padEnd(12);
      const verified = (user.email_verified ? '✅ Yes' : '❌ No').padEnd(10);
      const created = new Date(user.created_at).toLocaleDateString();
      
      console.log(email, role, status, verified, created);
    });

    console.log('─'.repeat(100));
    
    const adminCount = users.filter(u => u.role === 'admin').length;
    const activeCount = users.filter(u => u.account_status === 'active').length;
    const verifiedCount = users.filter(u => u.email_verified).length;

    console.log(`\n📊 Summary:`);
    console.log(`   Total users: ${users.length}`);
    console.log(`   Admins: ${adminCount}`);
    console.log(`   Active: ${activeCount}`);
    console.log(`   Verified: ${verifiedCount}`);
    process.exit(0);
  } catch (error) {
    console.error('❌ Database error:', error.message);
    process.exit(1);
  }
}

listUsers();
