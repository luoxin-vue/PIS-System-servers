import { Router, type Request, type Response } from 'express';
import bcrypt from 'bcryptjs';
import { getClient, row0 } from '../db/index.js';
import { signToken } from '../middleware/auth.js';
import { asyncRoute } from '../util/asyncRoute.js';

export const authRouter = Router();

authRouter.post(
  '/login',
  asyncRoute(async (req: Request, res: Response) => {
    const { username, password } = req.body;
    if (!username || !password) {
      res.status(400).json({ error: 'Username and password required' });
      return;
    }
    const db = getClient();
    const rs = await db.execute('SELECT id, username, password_hash FROM users WHERE username = ?', [username]);
    const user = row0<{ id: number; username: string; password_hash: string }>(rs);
    if (!user || !bcrypt.compareSync(password, user.password_hash)) {
      res.status(401).json({ error: 'Invalid username or password' });
      return;
    }
    const token = signToken({ userId: user.id, username: user.username });
    res.json({ token, username: user.username });
  })
);

authRouter.post(
  '/register',
  asyncRoute(async (req: Request, res: Response) => {
    const { username, password } = req.body;
    if (!username || !password) {
      res.status(400).json({ error: 'Username and password required' });
      return;
    }
    if (password.length < 6) {
      res.status(400).json({ error: 'Password must be at least 6 characters' });
      return;
    }
    const db = getClient();
    const existing = row0(await db.execute('SELECT id FROM users WHERE username = ?', [username]));
    if (existing) {
      res.status(409).json({ error: 'Username already exists' });
      return;
    }
    const password_hash = bcrypt.hashSync(password, 10);
    const ins = await db.execute('INSERT INTO users (username, password_hash) VALUES (?, ?)', [username, password_hash]);
    const id = Number(ins.lastInsertRowid ?? 0);
    const token = signToken({ userId: id, username });
    res.status(201).json({ token, username });
  })
);
