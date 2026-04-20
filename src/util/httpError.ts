import type { Response } from 'express';

type ErrorVars = Record<string, string | number>;

export function sendError(res: Response, status: number, code: string, message: string, vars?: ErrorVars): void {
  const payload: { code: string; error: string; vars?: ErrorVars } = { code, error: message };
  if (vars !== undefined && Object.keys(vars).length > 0) {
    payload.vars = vars;
  }
  res.status(status).json(payload);
}
