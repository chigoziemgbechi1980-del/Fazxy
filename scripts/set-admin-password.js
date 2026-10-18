const sqlite = require('better-sqlite3');
const bcrypt = require('bcryptjs');
const path = require('path');

const dbPath = path.join(__dirname, '..', 'data', 'my-life-story.db');
const email = 'chigoziemgbechi1980@gmail.com';
const newPassword = process.argv[2] || 'Favour1478';

const db = sqlite(dbPath);
const hash = bcrypt.hashSync(newPassword, 10);
const result = db.prepare('UPDATE admin_users SET password_hash = ? WHERE email = ?').run(hash, email);

if (result.changes > 0) {
  console.log(`Password updated for ${email}`);
} else {
  console.error(`No admin user found for ${email}`);
  process.exit(1);
}
