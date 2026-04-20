import { getDb, initDb } from './index.js';
import bcrypt from 'bcryptjs';

initDb();
const db = getDb();

// Create default admin user if none exists (username: admin, password: admin123)
const existing = db.prepare('SELECT id FROM users LIMIT 1').get();
if (!existing) {
  const hash = bcrypt.hashSync('admin123', 10);
  db.prepare('INSERT INTO users (username, password_hash) VALUES (?, ?)').run('admin', hash);
  console.log('Default user created: admin / admin123');
} else {
  console.log('Database already has users.');
}

console.log('Database initialized.');
