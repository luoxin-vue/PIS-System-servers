import { Router, type Request, type Response } from 'express';
import { getClient, row0, rowsAll, insertId } from '../db/index.js';
import { authMiddleware } from '../middleware/auth.js';
import { asyncRoute } from '../util/asyncRoute.js';
import { sendError } from '../util/httpError.js';

export const productsRouter = Router();
productsRouter.use(authMiddleware);

productsRouter.get(
  '/',
  asyncRoute(async (req: Request, res: Response) => {
    const db = getClient();
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
    const list = rowsAll<Record<string, unknown>>(await db.execute(sql, params));
    const countSql =
      'SELECT COUNT(*) as c FROM products' + (q ? ' WHERE name LIKE ? OR brand LIKE ? OR model LIKE ? OR size LIKE ?' : '');
    const countRow = row0<{ c: number }>(
      await db.execute(countSql, q ? [`%${q}%`, `%${q}%`, `%${q}%`, `%${q}%`] : [])
    );
    res.json({ list, total: countRow?.c ?? 0 });
  })
);

productsRouter.get(
  '/:id',
  asyncRoute(async (req: Request, res: Response) => {
    const db = getClient();
    const row = row0(await db.execute('SELECT * FROM products WHERE id = ?', [Number(req.params.id)]));
    if (!row) {
      sendError(res, 404, 'PRODUCT_NOT_FOUND', 'Product not found');
      return;
    }
    res.json(row);
  })
);

productsRouter.post(
  '/',
  asyncRoute(async (req: Request, res: Response) => {
    const { name, brand, model, size, cost_price, sale_price, stock_quantity, low_stock_threshold } = req.body;
    if (!name || !brand || !model || !size) {
      sendError(res, 400, 'PRODUCT_FIELDS_REQUIRED', 'name, brand, model, size required');
      return;
    }
    const db = getClient();
    const result = await db.execute(
      `INSERT INTO products (name, brand, model, size, cost_price, sale_price, stock_quantity, low_stock_threshold)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        name,
        brand || '',
        model || '',
        size || '',
        Number(cost_price) || 0,
        Number(sale_price) || 0,
        Number(stock_quantity) || 0,
        Number(low_stock_threshold) || 0,
      ]
    );
    const row = row0(await db.execute('SELECT * FROM products WHERE id = ?', [insertId(result)]));
    res.status(201).json(row);
  })
);

productsRouter.put(
  '/:id',
  asyncRoute(async (req: Request, res: Response) => {
    const id = Number(req.params.id);
    const { name, brand, model, size, cost_price, sale_price, stock_quantity, low_stock_threshold } = req.body;
    const db = getClient();
    const existing = row0(await db.execute('SELECT id FROM products WHERE id = ?', [id]));
    if (!existing) {
      sendError(res, 404, 'PRODUCT_NOT_FOUND', 'Product not found');
      return;
    }
    await db.execute(
      `UPDATE products SET name=?, brand=?, model=?, size=?, cost_price=?, sale_price=?, stock_quantity=?, low_stock_threshold=?, updated_at=datetime('now')
       WHERE id = ?`,
      [
        name ?? '',
        brand ?? '',
        model ?? '',
        size ?? '',
        Number(cost_price) ?? 0,
        Number(sale_price) ?? 0,
        Number(stock_quantity) ?? 0,
        Number(low_stock_threshold) ?? 0,
        id,
      ]
    );
    const row = row0(await db.execute('SELECT * FROM products WHERE id = ?', [id]));
    res.json(row);
  })
);

productsRouter.delete(
  '/:id',
  asyncRoute(async (req: Request, res: Response) => {
    const id = Number(req.params.id);
    const db = getClient();
    const result = await db.execute('DELETE FROM products WHERE id = ?', [id]);
    if (result.rowsAffected === 0) {
      sendError(res, 404, 'PRODUCT_NOT_FOUND', 'Product not found');
      return;
    }
    res.status(204).send();
  })
);
