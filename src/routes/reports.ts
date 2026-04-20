import { Router, Request, Response } from 'express';
import { getDb } from '../db/index.js';
import { authMiddleware } from '../middleware/auth.js';

export const reportsRouter = Router();
reportsRouter.use(authMiddleware);

reportsRouter.get('/dashboard', (_req: Request, res: Response) => {
  const db = getDb();

  const products = db.prepare('SELECT COUNT(*) as c FROM products').get() as { c: number };
  const lowStock = db
    .prepare(
      `SELECT COUNT(*) as c FROM products
       WHERE low_stock_threshold > 0 AND stock_quantity <= low_stock_threshold`
    )
    .get() as { c: number };

  // today range
  const todayStart = db.prepare(`SELECT datetime('now','start of day') as v`).get() as { v: string };
  const todayEnd = db.prepare(`SELECT datetime('now','start of day','+1 day','-1 second') as v`).get() as { v: string };

  const purchaseToday = db
    .prepare(
      `SELECT COALESCE(SUM(total_amount),0) as total, COUNT(*) as count
       FROM purchase_orders WHERE created_at >= ? AND created_at <= ?`
    )
    .get(todayStart.v, todayEnd.v) as { total: number; count: number };
  const salesToday = db
    .prepare(
      `SELECT COALESCE(SUM(total_amount),0) as total, COUNT(*) as count
       FROM sales_orders WHERE created_at >= ? AND created_at <= ?`
    )
    .get(todayStart.v, todayEnd.v) as { total: number; count: number };

  // last 7 days trend (including today): group by date
  const trend = db
    .prepare(
      `WITH RECURSIVE dates(d) AS (
         SELECT date('now','-6 day')
         UNION ALL
         SELECT date(d,'+1 day') FROM dates WHERE d < date('now')
       )
       SELECT
         d as date,
         COALESCE((SELECT SUM(total_amount) FROM purchase_orders WHERE date(created_at) = d),0) as purchase_total,
         COALESCE((SELECT SUM(total_amount) FROM sales_orders WHERE date(created_at) = d),0) as sales_total
       FROM dates
       ORDER BY d ASC`
    )
    .all() as { date: string; purchase_total: number; sales_total: number }[];

  res.json({
    products_count: products.c,
    low_stock_count: lowStock.c,
    purchase_today_total: Number(purchaseToday.total),
    purchase_today_count: purchaseToday.count,
    sales_today_total: Number(salesToday.total),
    sales_today_count: salesToday.count,
    trend,
  });
});

reportsRouter.get('/trend', (req: Request, res: Response) => {
  const { from, to } = req.query;
  if (!from || typeof from !== 'string' || !to || typeof to !== 'string') {
    res.status(400).json({ error: 'from and to required (YYYY-MM-DD)' });
    return;
  }
  const db = getDb();
  const rows = db
    .prepare(
      `WITH RECURSIVE dates(d) AS (
         SELECT date(?)
         UNION ALL
         SELECT date(d,'+1 day') FROM dates WHERE d < date(?)
       )
       SELECT
         d as date,
         COALESCE((SELECT SUM(total_amount) FROM purchase_orders WHERE date(created_at) = d),0) as purchase_total,
         COALESCE((SELECT SUM(total_amount) FROM sales_orders WHERE date(created_at) = d),0) as sales_total
       FROM dates
       ORDER BY d ASC`
    )
    .all(from, to) as { date: string; purchase_total: number; sales_total: number }[];
  res.json({ list: rows });
});

reportsRouter.get('/summary', (req: Request, res: Response) => {
  const { from, to } = req.query;
  const db = getDb();
  let purchaseWhere = '';
  let saleWhere = '';
  const purchaseParams: string[] = [];
  const saleParams: string[] = [];
  if (from && typeof from === 'string') {
    purchaseWhere += ' AND created_at >= ?';
    saleWhere += ' AND created_at >= ?';
    purchaseParams.push(from);
    saleParams.push(from);
  }
  if (to && typeof to === 'string') {
    purchaseWhere += ' AND created_at <= ?';
    saleWhere += ' AND created_at <= ?';
    purchaseParams.push(to + ' 23:59:59');
    saleParams.push(to + ' 23:59:59');
  }
  const purchaseRow = db.prepare(`SELECT COALESCE(SUM(total_amount), 0) as total, COUNT(*) as count FROM purchase_orders WHERE 1=1 ${purchaseWhere}`).get(...purchaseParams) as { total: number; count: number };
  const saleRow = db.prepare(`SELECT COALESCE(SUM(total_amount), 0) as total, COUNT(*) as count FROM sales_orders WHERE 1=1 ${saleWhere}`).get(...saleParams) as { total: number; count: number };
  const purchaseTotal = Number(purchaseRow.total);
  const saleTotal = Number(saleRow.total);
  res.json({
    purchase_total: purchaseTotal,
    purchase_count: purchaseRow.count,
    sales_total: saleTotal,
    sales_count: saleRow.count,
    gross_profit: saleTotal - purchaseTotal,
  });
});
