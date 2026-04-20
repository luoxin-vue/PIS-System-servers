import { Router, Request, Response } from 'express';
import { getDb } from '../db/index.js';
import { authMiddleware } from '../middleware/auth.js';

export const suppliersRouter = Router();
suppliersRouter.use(authMiddleware);

suppliersRouter.get('/', (req: Request, res: Response) => {
  const db = getDb();
  const { q, page = '1', limit = '20' } = req.query;
  const offset = (Number(page) - 1) * Number(limit);
  let sql = 'SELECT * FROM suppliers';
  const params: (string | number)[] = [];
  if (q && typeof q === 'string') {
    sql += ' WHERE name LIKE ? OR contact LIKE ? OR phone LIKE ?';
    const term = `%${q}%`;
    params.push(term, term, term);
  }
  sql += ' ORDER BY id DESC LIMIT ? OFFSET ?';
  params.push(Number(limit), offset);
  const list = db.prepare(sql).all(...params);
  const countSql = 'SELECT COUNT(*) as c FROM suppliers' + (q ? ' WHERE name LIKE ? OR contact LIKE ? OR phone LIKE ?' : '');
  const countRow = db.prepare(countSql).get(...(q ? [`%${q}%`, `%${q}%`, `%${q}%`] : [])) as { c: number };
  res.json({ list, total: countRow.c });
});

suppliersRouter.get('/:id', (req: Request, res: Response) => {
  const db = getDb();
  const row = db.prepare('SELECT * FROM suppliers WHERE id = ?').get(Number(req.params.id));
  if (!row) {
    res.status(404).json({ error: 'Supplier not found' });
    return;
  }
  res.json(row);
});

suppliersRouter.post('/', (req: Request, res: Response) => {
  const { name, contact, phone, note } = req.body;
  if (!name) {
    res.status(400).json({ error: 'name required' });
    return;
  }
  const db = getDb();
  const result = db.prepare('INSERT INTO suppliers (name, contact, phone, note) VALUES (?, ?, ?, ?)').run(name, contact || '', phone || '', note || '');
  const row = db.prepare('SELECT * FROM suppliers WHERE id = ?').get(result.lastInsertRowid);
  res.status(201).json(row);
});

suppliersRouter.put('/:id', (req: Request, res: Response) => {
  const id = Number(req.params.id);
  const { name, contact, phone, note } = req.body;
  const db = getDb();
  const existing = db.prepare('SELECT id FROM suppliers WHERE id = ?').get(id);
  if (!existing) {
    res.status(404).json({ error: 'Supplier not found' });
    return;
  }
  db.prepare('UPDATE suppliers SET name=?, contact=?, phone=?, note=? WHERE id = ?').run(name ?? '', contact ?? '', phone ?? '', note ?? '', id);
  const row = db.prepare('SELECT * FROM suppliers WHERE id = ?').get(id);
  res.json(row);
});

suppliersRouter.delete('/:id', (req: Request, res: Response) => {
  const id = Number(req.params.id);
  const db = getDb();
  const result = db.prepare('DELETE FROM suppliers WHERE id = ?').run(id);
  if (result.changes === 0) {
    res.status(404).json({ error: 'Supplier not found' });
    return;
  }
  res.status(204).send();
});
