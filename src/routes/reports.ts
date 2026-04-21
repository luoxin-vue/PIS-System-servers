import { Router, type Request, type Response } from 'express';
import { getClient, row0, rowsAll } from '../db/index.js';
import { authMiddleware } from '../middleware/auth.js';
import { asyncRoute } from '../util/asyncRoute.js';
import { sendError } from '../util/httpError.js';

export const reportsRouter = Router();
reportsRouter.use(authMiddleware);

reportsRouter.get(
  '/dashboard',
  asyncRoute(async (_req: Request, res: Response) => {
    const db = getClient();

    const products = row0<{ c: number }>(await db.execute('SELECT COUNT(*) as c FROM products'));
    const lowStock = row0<{ c: number }>(
      await db.execute(
        `SELECT COUNT(*) as c FROM products
       WHERE low_stock_threshold > 0 AND stock_quantity <= low_stock_threshold`
      )
    );

    const todayStart = row0<{ v: string }>(await db.execute(`SELECT datetime('now','start of day') as v`));
    const todayEnd = row0<{ v: string }>(await db.execute(`SELECT datetime('now','start of day','+1 day','-1 second') as v`));

    const purchaseToday = row0<{ total: number; count: number }>(
      await db.execute(
        `SELECT COALESCE(SUM(total_amount),0) as total, COUNT(*) as count
       FROM purchase_orders WHERE created_at >= ? AND created_at <= ?`,
        [todayStart!.v, todayEnd!.v]
      )
    );
    const salesToday = row0<{ total: number; count: number }>(
      await db.execute(
        `SELECT COALESCE(SUM(total_amount),0) as total, COUNT(*) as count
       FROM sales_orders WHERE created_at >= ? AND created_at <= ?`,
        [todayStart!.v, todayEnd!.v]
      )
    );

    const trendEndDate = row0<{ v: string }>(
      await db.execute(
        `SELECT COALESCE(MAX(d), date('now')) as v
       FROM (
         SELECT date(MAX(created_at)) as d FROM purchase_orders
         UNION ALL
         SELECT date(MAX(created_at)) as d FROM sales_orders
       ) t`
      )
    );

    const trend = rowsAll<{ date: string; purchase_total: number; sales_total: number }>(
      await db.execute(
        `WITH RECURSIVE dates(d) AS (
         SELECT date(?,'-6 day')
         UNION ALL
         SELECT date(d,'+1 day') FROM dates WHERE d < date(?)
       )
       SELECT
         d as date,
         COALESCE((SELECT SUM(total_amount) FROM purchase_orders WHERE date(created_at) = d),0) as purchase_total,
         COALESCE((SELECT SUM(total_amount) FROM sales_orders WHERE date(created_at) = d),0) as sales_total
       FROM dates
       ORDER BY d ASC`,
        [trendEndDate?.v ?? 'now', trendEndDate?.v ?? 'now']
      )
    );

    res.json({
      products_count: products?.c ?? 0,
      low_stock_count: lowStock?.c ?? 0,
      purchase_today_total: Number(purchaseToday?.total ?? 0),
      purchase_today_count: purchaseToday?.count ?? 0,
      sales_today_total: Number(salesToday?.total ?? 0),
      sales_today_count: salesToday?.count ?? 0,
      trend,
    });
  })
);

reportsRouter.get(
  '/trend',
  asyncRoute(async (req: Request, res: Response) => {
    const { from, to } = req.query;
    if (!from || typeof from !== 'string' || !to || typeof to !== 'string') {
      sendError(res, 400, 'REPORTS_RANGE_REQUIRED', 'from and to required (YYYY-MM-DD)');
      return;
    }
    const db = getClient();
    const rows = rowsAll<{ date: string; purchase_total: number; sales_total: number }>(
      await db.execute(
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
       ORDER BY d ASC`,
        [from, to]
      )
    );
    res.json({ list: rows });
  })
);

reportsRouter.get(
  '/summary',
  asyncRoute(async (req: Request, res: Response) => {
    const { from, to } = req.query;
    const db = getClient();
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
    const purchaseRow = row0<{ total: number; count: number }>(
      await db.execute(`SELECT COALESCE(SUM(total_amount), 0) as total, COUNT(*) as count FROM purchase_orders WHERE 1=1 ${purchaseWhere}`, purchaseParams)
    );
    const saleRow = row0<{ total: number; count: number }>(
      await db.execute(`SELECT COALESCE(SUM(total_amount), 0) as total, COUNT(*) as count FROM sales_orders WHERE 1=1 ${saleWhere}`, saleParams)
    );
    const purchaseTotal = Number(purchaseRow?.total ?? 0);
    const saleTotal = Number(saleRow?.total ?? 0);
    res.json({
      purchase_total: purchaseTotal,
      purchase_count: purchaseRow?.count ?? 0,
      sales_total: saleTotal,
      sales_count: saleRow?.count ?? 0,
      gross_profit: saleTotal - purchaseTotal,
    });
  })
);
