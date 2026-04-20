import { Router, Request, Response } from 'express';
import { getDb } from '../db/index.js';
import { authMiddleware } from '../middleware/auth.js';

export const purchasesRouter = Router();
purchasesRouter.use(authMiddleware);

function genOrderNo(): string {
  return 'PO' + Date.now().toString(36).toUpperCase() + Math.random().toString(36).slice(2, 6).toUpperCase();
}

purchasesRouter.get('/', (req: Request, res: Response) => {
  const db = getDb();
  const { page = '1', limit = '20' } = req.query;
  const offset = (Number(page) - 1) * Number(limit);
  const list = db
    .prepare(
      `SELECT p.*, s.name as supplier_name FROM purchase_orders p
       LEFT JOIN suppliers s ON p.supplier_id = s.id
       ORDER BY p.id DESC LIMIT ? OFFSET ?`
    )
    .all(Number(limit), offset);
  const countRow = db.prepare('SELECT COUNT(*) as c FROM purchase_orders').get() as { c: number };
  res.json({ list, total: countRow.c });
});

purchasesRouter.get('/:id', (req: Request, res: Response) => {
  const db = getDb();
  const order = db
    .prepare(
      `SELECT p.*, s.name as supplier_name, s.contact, s.phone FROM purchase_orders p
       LEFT JOIN suppliers s ON p.supplier_id = s.id WHERE p.id = ?`
    )
    .get(Number(req.params.id));
  if (!order) {
    res.status(404).json({ error: 'Purchase order not found' });
    return;
  }
  const items = db
    .prepare(
      `SELECT pi.*, pr.name as product_name, pr.brand, pr.model, pr.size FROM purchase_items pi
       LEFT JOIN products pr ON pi.product_id = pr.id WHERE pi.purchase_id = ?`
    )
    .all(Number(req.params.id));
  res.json({ ...order, items });
});

purchasesRouter.post('/', (req: Request, res: Response) => {
  const { supplier_id, note, items } = req.body as { supplier_id: number; note?: string; items: { product_id: number; quantity: number; unit_price: number }[] };
  if (!supplier_id || !items || !Array.isArray(items) || items.length === 0) {
    res.status(400).json({ error: 'supplier_id and items (array) required' });
    return;
  }
  const db = getDb();
  const order_no = genOrderNo();
  let total_amount = 0;
  for (const it of items) {
    total_amount += Number(it.quantity) * Number(it.unit_price);
  }
  const orderResult = db.prepare('INSERT INTO purchase_orders (order_no, supplier_id, total_amount, note) VALUES (?, ?, ?, ?)').run(order_no, supplier_id, total_amount, note || '');
  const purchase_id = orderResult.lastInsertRowid as number;
  const insertItem = db.prepare('INSERT INTO purchase_items (purchase_id, product_id, quantity, unit_price, amount) VALUES (?, ?, ?, ?, ?)');
  const insertLog = db.prepare('INSERT INTO inventory_logs (product_id, type, quantity, ref_type, ref_id) VALUES (?, ?, ?, ?, ?)');
  const updateProduct = db.prepare('UPDATE products SET stock_quantity = stock_quantity + ?, updated_at = datetime(\'now\') WHERE id = ?');
  for (const it of items) {
    const product_id = Number(it.product_id);
    const quantity = Number(it.quantity);
    const unit_price = Number(it.unit_price);
    const amount = quantity * unit_price;
    insertItem.run(purchase_id, product_id, quantity, unit_price, amount);
    insertLog.run(product_id, 'in', quantity, 'purchase', purchase_id);
    updateProduct.run(quantity, product_id);
  }
  const order = db
    .prepare(
      `SELECT p.*, s.name as supplier_name FROM purchase_orders p LEFT JOIN suppliers s ON p.supplier_id = s.id WHERE p.id = ?`
    )
    .get(purchase_id);
  const orderItems = db
    .prepare(
      `SELECT pi.*, pr.name as product_name, pr.brand, pr.model, pr.size FROM purchase_items pi LEFT JOIN products pr ON pi.product_id = pr.id WHERE pi.purchase_id = ?`
    )
    .all(purchase_id);
  res.status(201).json({ ...(order as Record<string, unknown>), items: orderItems });
});
