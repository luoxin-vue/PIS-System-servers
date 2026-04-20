import { Router, type Request, type Response } from 'express';
import { getClient, row0, rowsAll, insertId } from '../db/index.js';
import { authMiddleware } from '../middleware/auth.js';
import { asyncRoute } from '../util/asyncRoute.js';

export const salesRouter = Router();
salesRouter.use(authMiddleware);

function genOrderNo(): string {
  return 'SO' + Date.now().toString(36).toUpperCase() + Math.random().toString(36).slice(2, 6).toUpperCase();
}

salesRouter.get(
  '/',
  asyncRoute(async (req: Request, res: Response) => {
    const db = getClient();
    const { page = '1', limit = '20' } = req.query;
    const offset = (Number(page) - 1) * Number(limit);
    const list = rowsAll<Record<string, unknown>>(
      await db.execute('SELECT * FROM sales_orders ORDER BY id DESC LIMIT ? OFFSET ?', [Number(limit), offset])
    );
    const countRow = row0<{ c: number }>(await db.execute('SELECT COUNT(*) as c FROM sales_orders'));
    res.json({ list, total: countRow?.c ?? 0 });
  })
);

salesRouter.get(
  '/:id',
  asyncRoute(async (req: Request, res: Response) => {
    const db = getClient();
    const order = row0(await db.execute('SELECT * FROM sales_orders WHERE id = ?', [Number(req.params.id)]));
    if (!order) {
      res.status(404).json({ error: 'Sales order not found' });
      return;
    }
    const items = rowsAll<Record<string, unknown>>(
      await db.execute(
        `SELECT si.*, pr.name as product_name, pr.brand, pr.model, pr.size FROM sales_items si
       LEFT JOIN products pr ON si.product_id = pr.id WHERE si.sale_id = ?`,
        [Number(req.params.id)]
      )
    );
    res.json({ ...order, items });
  })
);

salesRouter.post(
  '/',
  asyncRoute(async (req: Request, res: Response) => {
    const { customer_plate, note, items } = req.body as {
      customer_plate?: string;
      note?: string;
      items: { product_id: number; quantity: number; unit_price: number }[];
    };
    if (!items || !Array.isArray(items) || items.length === 0) {
      res.status(400).json({ error: 'items (array) required' });
      return;
    }
    const db = getClient();
    const order_no = genOrderNo();
    let total_amount = 0;
    for (const it of items) {
      total_amount += Number(it.quantity) * Number(it.unit_price);
    }

    let sale_id = 0;
    const tx = await db.transaction('write');
    try {
      const orderResult = await tx.execute({
        sql: 'INSERT INTO sales_orders (order_no, customer_plate, total_amount, note) VALUES (?, ?, ?, ?)',
        args: [order_no, customer_plate || '', total_amount, note || ''],
      });
      sale_id = insertId(orderResult);
      for (const it of items) {
        const product_id = Number(it.product_id);
        const quantity = Number(it.quantity);
        const unit_price = Number(it.unit_price);
        const amount = quantity * unit_price;
        const productRs = await tx.execute({ sql: 'SELECT stock_quantity FROM products WHERE id = ?', args: [product_id] });
        const product = row0<{ stock_quantity: number }>(productRs);
        if (!product || product.stock_quantity < quantity) {
          await tx.rollback();
          res.status(400).json({ error: `Insufficient stock for product id ${product_id}` });
          return;
        }
        await tx.execute({
          sql: 'INSERT INTO sales_items (sale_id, product_id, quantity, unit_price, amount) VALUES (?, ?, ?, ?, ?)',
          args: [sale_id, product_id, quantity, unit_price, amount],
        });
        await tx.execute({
          sql: 'INSERT INTO inventory_logs (product_id, type, quantity, ref_type, ref_id) VALUES (?, ?, ?, ?, ?)',
          args: [product_id, 'out', quantity, 'sale', sale_id],
        });
        await tx.execute({
          sql: `UPDATE products SET stock_quantity = stock_quantity - ?, updated_at = datetime('now') WHERE id = ?`,
          args: [quantity, product_id],
        });
      }
      await tx.commit();
    } finally {
      tx.close();
    }

    const order = row0(await db.execute('SELECT * FROM sales_orders WHERE id = ?', [sale_id]));
    const orderItems = rowsAll<Record<string, unknown>>(
      await db.execute(
        `SELECT si.*, pr.name as product_name, pr.brand, pr.model, pr.size FROM sales_items si LEFT JOIN products pr ON si.product_id = pr.id WHERE si.sale_id = ?`,
        [sale_id]
      )
    );
    res.status(201).json({ ...(order as Record<string, unknown>), items: orderItems });
  })
);
