import type { Request, Response, NextFunction, RequestHandler } from 'express';

/** Express 4 不会自动捕获 async 抛错，用此包装路由 */
export function asyncRoute(fn: (req: Request, res: Response, next: NextFunction) => Promise<void>): RequestHandler {
  return (req, res, next) => {
    void fn(req, res, next).catch(next);
  };
}
