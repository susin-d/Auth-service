/**
 * Hard Delete User Script
 * Removes a user completely from the database (hard delete)
 * This allows the user to sign up again with the same email.
 * 
 * Usage: node scripts/delete-auth-user.js <email>
 */

require('dotenv').config();
const db = require('../src/config/db');

async function deleteUser(email) {
  try {
    console.log(`🔍 Looking for user: ${email}`);
    
    // Check if user exists
    const result = await db.query(
      'SELECT id, email FROM users WHERE email = $1 LIMIT 1',
      [email]
    );
    
    const user = result.rows[0];
    
    if (!user) {
      console.log(`⚠️  User ${email} not found in database`);
      return;
    }
    
    console.log(`✅ Found user: ${user.id}`);
    
    // Delete user (cascade will handle profiles, tokens, oauth)
    await db.query('DELETE FROM users WHERE id = $1', [user.id]);
    
    console.log(`🗑️  Hard deleted user ${email} from database`);
    console.log(`✅ User can now sign up again with this email`);
    
  } catch (error) {
    console.error('❌ Unexpected error:', error.message);
  }
}

// Get email from command line arguments
const email = process.argv[2];

if (!email) {
  console.error('❌ Error: Email is required');
  console.log('Usage: node scripts/delete-auth-user.js <email>');
  process.exit(1);
}

console.log('🚀 User Hard Deletion Tool (PostgreSQL)\n');
deleteUser(email).then(() => {
  console.log('\n✨ Done!');
  process.exit(0);
});
