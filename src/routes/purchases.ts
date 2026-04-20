import { Router, type Request, type Response } from 'express';
import { getClient, row0, rowsAll, insertId } from '../db/index.js';
import { authMiddleware } from '../middleware/auth.js';
import { asyncRoute } from '../util/asyncRoute.js';
import { sendError } from '../util/httpError.js';

export const purchasesRouter = Router();
purchasesRouter.use(authMiddleware);

function genOrderNo(): string {
  return 'PO' + Date.now().toString(36).toUpperCase() + Math.random().toString(36).slice(2, 6).toUpperCase();
}

purchasesRouter.get(
  '/',
  asyncRoute(async (req: Request, res: Response) => {
    const db = getClient();
    const { page = '1', limit = '20' } = req.query;
    const offset = (Number(page) - 1) * Number(limit);
    const list = rowsAll<Record<string, unknown>>(
      await db.execute(
        `SELECT p.*, s.name as supplier_name FROM purchase_orders p
       LEFT JOIN suppliers s ON p.supplier_id = s.id
       ORDER BY p.id DESC LIMIT ? OFFSET ?`,
        [Number(limit), offset]
      )
    );
    const countRow = row0<{ c: number }>(await db.execute('SELECT COUNT(*) as c FROM purchase_orders'));
    res.json({ list, total: countRow?.c ?? 0 });
  })
);

purchasesRouter.get(
  '/:id',
  asyncRoute(async (req: Request, res: Response) => {
    const db = getClient();
    const order = row0(
      await db.execute(
        `SELECT p.*, s.name as supplier_name, s.contact, s.phone FROM purchase_orders p
       LEFT JOIN suppliers s ON p.supplier_id = s.id WHERE p.id = ?`,
        [Number(req.params.id)]
      )
    );
    if (!order) {
      sendError(res, 404, 'PURCHASE_NOT_FOUND', 'Purchase order not found');
      return;
    }
    const items = rowsAll<Record<string, unknown>>(
      await db.execute(
        `SELECT pi.*, pr.name as product_name, pr.brand, pr.model, pr.size FROM purchase_items pi
       LEFT JOIN products pr ON pi.product_id = pr.id WHERE pi.purchase_id = ?`,
        [Number(req.params.id)]
      )
    );
    res.json({ ...order, items });
  })
);

purchasesRouter.post(
  '/',
  asyncRoute(async (req: Request, res: Response) => {
    const { supplier_id, note, items } = req.body as {
      supplier_id: number;
      note?: string;
      items: { product_id: number; quantity: number; unit_price: number }[];
    };
    if (!supplier_id || !items || !Array.isArray(items) || items.length === 0) {
      sendError(res, 400, 'PURCHASE_INVALID_BODY', 'supplier_id and items (array) required');
      return;
    }
    const db = getClient();
    const order_no = genOrderNo();
    let total_amount = 0;
    for (const it of items) {
      total_amount += Number(it.quantity) * Number(it.unit_price);
    }

    let purchase_id = 0;
    const tx = await db.transaction('write');
    try {
      const orderResult = await tx.execute({
        sql: 'INSERT INTO purchase_orders (order_no, supplier_id, total_amount, note) VALUES (?, ?, ?, ?)',
        args: [order_no, supplier_id, total_amount, note || ''],
      });
      purchase_id = insertId(orderResult);
      for (const it of items) {
        const product_id = Number(it.product_id);
        const quantity = Number(it.quantity);
        const unit_price = Number(it.unit_price);
        const amount = quantity * unit_price;
        await tx.execute({
          sql: 'INSERT INTO purchase_items (purchase_id, product_id, quantity, unit_price, amount) VALUES (?, ?, ?, ?, ?)',
          args: [purchase_id, product_id, quantity, unit_price, amount],
        });
        await tx.execute({
          sql: 'INSERT INTO inventory_logs (product_id, type, quantity, ref_type, ref_id) VALUES (?, ?, ?, ?, ?)',
          args: [product_id, 'in', quantity, 'purchase', purchase_id],
        });
        await tx.execute({
          sql: `UPDATE products SET stock_quantity = stock_quantity + ?, updated_at = datetime('now') WHERE id = ?`,
          args: [quantity, product_id],
        });
      }
      await tx.commit();
    } finally {
      tx.close();
    }

    const order = row0(
      await db.execute(
        `SELECT p.*, s.name as supplier_name FROM purchase_orders p LEFT JOIN suppliers s ON p.supplier_id = s.id WHERE p.id = ?`,
        [purchase_id]
      )
    );
    const orderItems = rowsAll<Record<string, unknown>>(
      await db.execute(
        `SELECT pi.*, pr.name as product_name, pr.brand, pr.model, pr.size FROM purchase_items pi LEFT JOIN products pr ON pi.product_id = pr.id WHERE pi.purchase_id = ?`,
        [purchase_id]
      )
    );
    res.status(201).json({ ...(order as Record<string, unknown>), items: orderItems });
  })
);
