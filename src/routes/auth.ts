import { Router, Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import { getDb } from '../db/index.js';
import { signToken } from '../middleware/auth.js';

export const authRouter = Router();

authRouter.post('/login', (req: Request, res: Response) => {
  const { username, password } = req.body;
  if (!username || !password) {
    res.status(400).json({ error: 'Username and password required' });
    return;
  }
  const db = getDb();
  const user = db.prepare('SELECT id, username, password_hash FROM users WHERE username = ?').get(username) as
    | { id: number; username: string; password_hash: string }
    | undefined;
  if (!user || !bcrypt.compareSync(password, user.password_hash)) {
    res.status(401).json({ error: 'Invalid username or password' });
    return;
  }
  const token = signToken({ userId: user.id, username: user.username });
  res.json({ token, username: user.username });
});

authRouter.post('/register', (req: Request, res: Response) => {
  const { username, password } = req.body;
  if (!username || !password) {
    res.status(400).json({ error: 'Username and password required' });
    return;
  }
  if (password.length < 6) {
    res.status(400).json({ error: 'Password must be at least 6 characters' });
    return;
  }
  const db = getDb();
  const existing = db.prepare('SELECT id FROM users WHERE username = ?').get(username);
  if (existing) {
    res.status(409).json({ error: 'Username already exists' });
    return;
  }
  const password_hash = bcrypt.hashSync(password, 10);
  const result = db.prepare('INSERT INTO users (username, password_hash) VALUES (?, ?)').run(username, password_hash);
  const id = result.lastInsertRowid as number;
  const token = signToken({ userId: id, username });
  res.status(201).json({ token, username });
});
