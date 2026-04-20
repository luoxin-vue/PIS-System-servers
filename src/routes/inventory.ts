import { Router, Request, Response } from 'express';
import { getDb } from '../db/index.js';
import { authMiddleware } from '../middleware/auth.js';

export const inventoryRouter = Router();
inventoryRouter.use(authMiddleware);

inventoryRouter.get('/', (req: Request, res: Response) => {
  const db = getDb();
  const { q, page = '1', limit = '50' } = req.query;
  const offset = (Number(page) - 1) * Number(limit);
  let sql = 'SELECT id, name, brand, model, size, cost_price, sale_price, stock_quantity, low_stock_threshold FROM products';
  const params: (string | number)[] = [];
  if (q && typeof q === 'string') {
    sql += ' WHERE name LIKE ? OR brand LIKE ? OR model LIKE ? OR size LIKE ?';
    const term = `%${q}%`;
    params.push(term, term, term, term);
  }
  sql += ' ORDER BY stock_quantity ASC LIMIT ? OFFSET ?';
  params.push(Number(limit), offset);
  const list = db.prepare(sql).all(...params);
  const countRow = db.prepare('SELECT COUNT(*) as c FROM products' + (q ? ' WHERE name LIKE ? OR brand LIKE ? OR model LIKE ? OR size LIKE ?' : '')).get(
    ...(q ? [`%${q}%`, `%${q}%`, `%${q}%`, `%${q}%`] : [])
  ) as { c: number };
  res.json({ list, total: countRow.c });
});

inventoryRouter.get('/alerts', (req: Request, res: Response) => {
  const db = getDb();
  const list = db
    .prepare(
      `SELECT id, name, brand, model, size, stock_quantity, low_stock_threshold FROM products
       WHERE low_stock_threshold > 0 AND stock_quantity <= low_stock_threshold ORDER BY stock_quantity ASC`
    )
    .all();
  res.json({ list });
});

inventoryRouter.get('/logs', (req: Request, res: Response) => {
  const db = getDb();
  const { product_id, page = '1', limit = '50' } = req.query;
  const offset = (Number(page) - 1) * Number(limit);
  let sql = `SELECT l.*, p.name as product_name, p.size FROM inventory_logs l
             LEFT JOIN products p ON l.product_id = p.id WHERE 1=1`;
  const params: (number | string)[] = [];
  if (product_id) {
    sql += ' AND l.product_id = ?';
    params.push(Number(product_id));
  }
  sql += ' ORDER BY l.id DESC LIMIT ? OFFSET ?';
  params.push(Number(limit), offset);
  const list = db.prepare(sql).all(...params);
  let countSql = 'SELECT COUNT(*) as c FROM inventory_logs l WHERE 1=1';
  if (product_id) {
    countSql += ' AND l.product_id = ?';
  }
  const countRow = db.prepare(countSql).get(...(product_id ? [Number(product_id)] : [])) as { c: number };
  res.json({ list, total: countRow.c });
});
