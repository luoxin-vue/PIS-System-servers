import { Router, Request, Response } from 'express';
import { getDb } from '../db/index.js';
import { authMiddleware } from '../middleware/auth.js';

export const salesRouter = Router();
salesRouter.use(authMiddleware);

function genOrderNo(): string {
  return 'SO' + Date.now().toString(36).toUpperCase() + Math.random().toString(36).slice(2, 6).toUpperCase();
}

salesRouter.get('/', (req: Request, res: Response) => {
  const db = getDb();
  const { page = '1', limit = '20' } = req.query;
  const offset = (Number(page) - 1) * Number(limit);
  const list = db.prepare('SELECT * FROM sales_orders ORDER BY id DESC LIMIT ? OFFSET ?').all(Number(limit), offset);
  const countRow = db.prepare('SELECT COUNT(*) as c FROM sales_orders').get() as { c: number };
  res.json({ list, total: countRow.c });
});

salesRouter.get('/:id', (req: Request, res: Response) => {
  const db = getDb();
  const order = db.prepare('SELECT * FROM sales_orders WHERE id = ?').get(Number(req.params.id));
  if (!order) {
    res.status(404).json({ error: 'Sales order not found' });
    return;
  }
  const items = db
    .prepare(
      `SELECT si.*, pr.name as product_name, pr.brand, pr.model, pr.size FROM sales_items si
       LEFT JOIN products pr ON si.product_id = pr.id WHERE si.sale_id = ?`
    )
    .all(Number(req.params.id));
  res.json({ ...order, items });
});

salesRouter.post('/', (req: Request, res: Response) => {
  const { customer_plate, note, items } = req.body as { customer_plate?: string; note?: string; items: { product_id: number; quantity: number; unit_price: number }[] };
  if (!items || !Array.isArray(items) || items.length === 0) {
    res.status(400).json({ error: 'items (array) required' });
    return;
  }
  const db = getDb();
  const order_no = genOrderNo();
  let total_amount = 0;
  for (const it of items) {
    total_amount += Number(it.quantity) * Number(it.unit_price);
  }
  const orderResult = db.prepare('INSERT INTO sales_orders (order_no, customer_plate, total_amount, note) VALUES (?, ?, ?, ?)').run(order_no, customer_plate || '', total_amount, note || '');
  const sale_id = orderResult.lastInsertRowid as number;
  const insertItem = db.prepare('INSERT INTO sales_items (sale_id, product_id, quantity, unit_price, amount) VALUES (?, ?, ?, ?, ?)');
  const insertLog = db.prepare('INSERT INTO inventory_logs (product_id, type, quantity, ref_type, ref_id) VALUES (?, ?, ?, ?, ?)');
  const updateProduct = db.prepare('UPDATE products SET stock_quantity = stock_quantity - ?, updated_at = datetime(\'now\') WHERE id = ?');
  for (const it of items) {
    const product_id = Number(it.product_id);
    const quantity = Number(it.quantity);
    const unit_price = Number(it.unit_price);
    const amount = quantity * unit_price;
    const product = db.prepare('SELECT stock_quantity FROM products WHERE id = ?').get(product_id) as { stock_quantity: number } | undefined;
    if (!product || product.stock_quantity < quantity) {
      res.status(400).json({ error: `Insufficient stock for product id ${product_id}` });
      return;
    }
    insertItem.run(sale_id, product_id, quantity, unit_price, amount);
    insertLog.run(product_id, 'out', quantity, 'sale', sale_id);
    updateProduct.run(quantity, product_id);
  }
  const order = db.prepare('SELECT * FROM sales_orders WHERE id = ?').get(sale_id);
  const orderItems = db
    .prepare(
      `SELECT si.*, pr.name as product_name, pr.brand, pr.model, pr.size FROM sales_items si LEFT JOIN products pr ON si.product_id = pr.id WHERE si.sale_id = ?`
    )
    .all(sale_id);
  res.status(201).json({ ...(order as Record<string, unknown>), items: orderItems });
});
