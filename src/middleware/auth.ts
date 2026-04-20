import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { sendError } from '../util/httpError.js';

const JWT_SECRET = process.env.JWT_SECRET || 'maxxis-inventory-secret-change-in-production';

export interface JwtPayload {
  userId: number;
  username: string;
}

export function authMiddleware(req: Request, res: Response, next: NextFunction): void {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    sendError(res, 401, 'AUTH_HEADER_MISSING', 'Missing or invalid Authorization header');
    return;
  }
  const token = authHeader.slice(7);
  try {
    const decoded = jwt.verify(token, JWT_SECRET) as JwtPayload;
    (req as Request & { user?: JwtPayload }).user = decoded;
    next();
  } catch {
    sendError(res, 401, 'AUTH_TOKEN_INVALID', 'Invalid or expired token');
  }
}

export function signToken(payload: JwtPayload): string {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: '7d' });
}
