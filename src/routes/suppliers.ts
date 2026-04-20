import { Router, type Request, type Response } from 'express';
import { getClient, row0, rowsAll, insertId } from '../db/index.js';
import { authMiddleware } from '../middleware/auth.js';
import { asyncRoute } from '../util/asyncRoute.js';
import { sendError } from '../util/httpError.js';

export const suppliersRouter = Router();
suppliersRouter.use(authMiddleware);

suppliersRouter.get(
  '/',
  asyncRoute(async (req: Request, res: Response) => {
    const db = getClient();
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
    const list = rowsAll<Record<string, unknown>>(await db.execute(sql, params));
    const countSql = 'SELECT COUNT(*) as c FROM suppliers' + (q ? ' WHERE name LIKE ? OR contact LIKE ? OR phone LIKE ?' : '');
    const countRow = row0<{ c: number }>(
      await db.execute(countSql, q ? [`%${q}%`, `%${q}%`, `%${q}%`] : [])
    );
    res.json({ list, total: countRow?.c ?? 0 });
  })
);

suppliersRouter.get(
  '/:id',
  asyncRoute(async (req: Request, res: Response) => {
    const db = getClient();
    const row = row0(await db.execute('SELECT * FROM suppliers WHERE id = ?', [Number(req.params.id)]));
    if (!row) {
      sendError(res, 404, 'SUPPLIER_NOT_FOUND', 'Supplier not found');
      return;
    }
    res.json(row);
  })
);

suppliersRouter.post(
  '/',
  asyncRoute(async (req: Request, res: Response) => {
    const { name, contact, phone, note } = req.body;
    if (!name) {
      sendError(res, 400, 'SUPPLIER_NAME_REQUIRED', 'name required');
      return;
    }
    const db = getClient();
    const result = await db.execute('INSERT INTO suppliers (name, contact, phone, note) VALUES (?, ?, ?, ?)', [
      name,
      contact || '',
      phone || '',
      note || '',
    ]);
    const row = row0(await db.execute('SELECT * FROM suppliers WHERE id = ?', [insertId(result)]));
    res.status(201).json(row);
  })
);

suppliersRouter.put(
  '/:id',
  asyncRoute(async (req: Request, res: Response) => {
    const id = Number(req.params.id);
    const { name, contact, phone, note } = req.body;
    const db = getClient();
    const existing = row0(await db.execute('SELECT id FROM suppliers WHERE id = ?', [id]));
    if (!existing) {
      sendError(res, 404, 'SUPPLIER_NOT_FOUND', 'Supplier not found');
      return;
    }
    await db.execute('UPDATE suppliers SET name=?, contact=?, phone=?, note=? WHERE id = ?', [
      name ?? '',
      contact ?? '',
      phone ?? '',
      note ?? '',
      id,
    ]);
    const row = row0(await db.execute('SELECT * FROM suppliers WHERE id = ?', [id]));
    res.json(row);
  })
);

suppliersRouter.delete(
  '/:id',
  asyncRoute(async (req: Request, res: Response) => {
    const id = Number(req.params.id);
    const db = getClient();
    const result = await db.execute('DELETE FROM suppliers WHERE id = ?', [id]);
    if (result.rowsAffected === 0) {
      sendError(res, 404, 'SUPPLIER_NOT_FOUND', 'Supplier not found');
      return;
    }
    res.status(204).send();
  })
);
