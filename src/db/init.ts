import { initDb, getClient, row0 } from './index.js';
import bcrypt from 'bcryptjs';

await initDb();
const db = getClient();

const existing = row0(await db.execute('SELECT id FROM users LIMIT 1'));
if (!existing) {
  const hash = bcrypt.hashSync('admin123', 10);
  await db.execute('INSERT INTO users (username, password_hash) VALUES (?, ?)', ['admin', hash]);
  console.log('Default user created: admin / admin123');
} else {
  console.log('Database already has users.');
}

console.log('Database initialized.');
