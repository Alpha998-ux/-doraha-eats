import type { RequestHandler } from 'express';
import { eq } from 'drizzle-orm';
import { db } from '../db/index.js';
import { users } from '../db/schema.js';
import { verifyToken } from '../lib/jwt.js';
import { Errors } from '../lib/errors.js';

export type AuthUser = {
  id: string;
  role: 'CUSTOMER' | 'VENDOR' | 'DELIVERY' | 'ADMIN';
  fullName: string;
  email: string | null;
  status: string;
};

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request { user?: AuthUser }
  }
}

export const authenticate: RequestHandler = async (req, _res, next) => {
  try {
    const header = req.headers.authorization;
    if (!header?.startsWith('Bearer ')) throw Errors.unauthorized();
    let payload;
    try {
      payload = verifyToken(header.slice(7));
    } catch {
      throw Errors.unauthorized('Your session has expired. Please log in again.');
    }
    const [row] = await db.select().from(users).where(eq(users.id, payload.sub)).limit(1);
    if (!row) throw Errors.unauthorized();
    if (row.status === 'SUSPENDED') throw Errors.forbidden('This account has been suspended.');
    req.user = {
      id: row.id, role: row.role, fullName: row.fullName,
      email: row.email, status: row.status,
    };
    next();
  } catch (e) {
    next(e);
  }
};

/** Role gate. Ownership is always checked again inside the service. */
export const requireRole = (...roles: AuthUser['role'][]): RequestHandler => (req, _res, next) => {
  if (!req.user) return next(Errors.unauthorized());
  if (!roles.includes(req.user.role)) return next(Errors.forbidden());
  next();
};

/** Attaches req.user when a token is present, but never rejects. */
export const optionalAuth: RequestHandler = async (req, _res, next) => {
  if (!req.headers.authorization) return next();
  return authenticate(req, _res, next);
};
