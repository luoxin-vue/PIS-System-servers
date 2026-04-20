import { Router, Request, Response } from 'express';
import { getDb } from '../db/index.js';
import { authMiddleware } from '../middleware/auth.js';

export const productsRouter = Router();
productsRouter.use(authMiddleware);

productsRouter.get('/', (req: Request, res: Response) => {
  const db = getDb();
  const { q, page = '1', limit = '20' } = req.query;
  const offset = (Number(page) - 1) * Number(limit);
  let sql = 'SELECT * FROM products';
  const params: (string | number)[] = [];
  if (q && typeof q === 'string') {
    sql += ' WHERE name LIKE ? OR brand LIKE ? OR model LIKE ? OR size LIKE ?';
    const term = `%${q}%`;
    params.push(term, term, term, term);
  }
  sql += ' ORDER BY id DESC LIMIT ? OFFSET ?';
  params.push(Number(limit), offset);
  const list = db.prepare(sql).all(...params);
  const countRow = db.prepare('SELECT COUNT(*) as c FROM products' + (q ? ' WHERE name LIKE ? OR brand LIKE ? OR model LIKE ? OR size LIKE ?' : '')).get(
    ...(q ? [`%${q}%`, `%${q}%`, `%${q}%`, `%${q}%`] : [])
  ) as { c: number };
  res.json({ list, total: countRow.c });
});

productsRouter.get('/:id', (req: Request, res: Response) => {
  const db = getDb();
  const row = db.prepare('SELECT * FROM products WHERE id = ?').get(Number(req.params.id));
  if (!row) {
    res.status(404).json({ error: 'Product not found' });
    return;
  }
  res.json(row);
});

productsRouter.post('/', (req: Request, res: Response) => {
  const { name, brand, model, size, cost_price, sale_price, stock_quantity, low_stock_threshold } = req.body;
  if (!name || !brand || !model || !size) {
    res.status(400).json({ error: 'name, brand, model, size required' });
    return;
  }
  const db = getDb();
  const result = db
    .prepare(
      `INSERT INTO products (name, brand, model, size, cost_price, sale_price, stock_quantity, low_stock_threshold)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
    )
    .run(
      name,
      brand || '',
      model || '',
      size || '',
      Number(cost_price) || 0,
      Number(sale_price) || 0,
      Number(stock_quantity) || 0,
      Number(low_stock_threshold) || 0
    );
  const row = db.prepare('SELECT * FROM products WHERE id = ?').get(result.lastInsertRowid);
  res.status(201).json(row);
});

productsRouter.put('/:id', (req: Request, res: Response) => {
  const id = Number(req.params.id);
  const { name, brand, model, size, cost_price, sale_price, stock_quantity, low_stock_threshold } = req.body;
  const db = getDb();
  const existing = db.prepare('SELECT id FROM products WHERE id = ?').get(id);
  if (!existing) {
    res.status(404).json({ error: 'Product not found' });
    return;
  }
  db.prepare(
    `UPDATE products SET name=?, brand=?, model=?, size=?, cost_price=?, sale_price=?, stock_quantity=?, low_stock_threshold=?, updated_at=datetime('now')
     WHERE id = ?`
  ).run(
    name ?? '',
    brand ?? '',
    model ?? '',
    size ?? '',
    Number(cost_price) ?? 0,
    Number(sale_price) ?? 0,
    Number(stock_quantity) ?? 0,
    Number(low_stock_threshold) ?? 0,
    id
  );
  const row = db.prepare('SELECT * FROM products WHERE id = ?').get(id);
  res.json(row);
});

productsRouter.delete('/:id', (req: Request, res: Response) => {
  const id = Number(req.params.id);
  const db = getDb();
  const result = db.prepare('DELETE FROM products WHERE id = ?').run(id);
  if (result.changes === 0) {
    res.status(404).json({ error: 'Product not found' });
    return;
  }
  res.status(204).send();
});
