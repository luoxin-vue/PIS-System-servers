import { Router, type Request, type Response } from 'express';
import { getClient, row0, rowsAll } from '../db/index.js';
import { authMiddleware } from '../middleware/auth.js';
import { asyncRoute } from '../util/asyncRoute.js';

export const inventoryRouter = Router();
inventoryRouter.use(authMiddleware);

inventoryRouter.get(
  '/',
  asyncRoute(async (req: Request, res: Response) => {
    const db = getClient();
    const { q, page = '1', limit = '50' } = req.query;
    const offset = (Number(page) - 1) * Number(limit);
    let sql =
      'SELECT id, name, brand, model, size, cost_price, sale_price, stock_quantity, low_stock_threshold FROM products';
    const params: (string | number)[] = [];
    if (q && typeof q === 'string') {
      sql += ' WHERE name LIKE ? OR brand LIKE ? OR model LIKE ? OR size LIKE ?';
      const term = `%${q}%`;
      params.push(term, term, term, term);
    }
    sql += ' ORDER BY stock_quantity ASC LIMIT ? OFFSET ?';
    params.push(Number(limit), offset);
    const list = rowsAll<Record<string, unknown>>(await db.execute(sql, params));
    const countRow = row0<{ c: number }>(
      await db.execute(
        'SELECT COUNT(*) as c FROM products' +
          (q ? ' WHERE name LIKE ? OR brand LIKE ? OR model LIKE ? OR size LIKE ?' : ''),
        q ? [`%${q}%`, `%${q}%`, `%${q}%`, `%${q}%`] : []
      )
    );
    res.json({ list, total: countRow?.c ?? 0 });
  })
);

inventoryRouter.get(
  '/alerts',
  asyncRoute(async (_req: Request, res: Response) => {
    const db = getClient();
    const list = rowsAll<Record<string, unknown>>(
      await db.execute(
        `SELECT id, name, brand, model, size, stock_quantity, low_stock_threshold FROM products
       WHERE low_stock_threshold > 0 AND stock_quantity <= low_stock_threshold ORDER BY stock_quantity ASC`
      )
    );
    res.json({ list });
  })
);

inventoryRouter.get(
  '/logs',
  asyncRoute(async (req: Request, res: Response) => {
    const db = getClient();
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
    const list = rowsAll<Record<string, unknown>>(await db.execute(sql, params));
    let countSql = 'SELECT COUNT(*) as c FROM inventory_logs l WHERE 1=1';
    if (product_id) {
      countSql += ' AND l.product_id = ?';
    }
    const countRow = row0<{ c: number }>(await db.execute(countSql, product_id ? [Number(product_id)] : []));
    res.json({ list, total: countRow?.c ?? 0 });
  })
);
