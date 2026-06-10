import { Request, Response, NextFunction } from 'express';
import { verifyAccessToken, AccessTokenPayload } from '../services/token.service';
import { AppError } from './errorHandler';

declare global {
  namespace Express {
    interface Request {
      user?: AccessTokenPayload;
    }
  }
}

export function authenticate(req: Request, res: Response, next: NextFunction): void {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) {
    const err = new Error('Missing or invalid Authorization header') as AppError;
    err.statusCode = 401;
    err.code = 'UNAUTHORIZED';
    return next(err);
  }

  const token = authHeader.slice(7);
  try {
    req.user = verifyAccessToken(token);
    next();
  } catch {
    const err = new Error('Invalid or expired token') as AppError;
    err.statusCode = 401;
    err.code = 'UNAUTHORIZED';
    next(err);
  }
}

export function authorize(...roles: string[]) {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.user) {
      const err = new Error('Unauthorized') as AppError;
      err.statusCode = 401;
      err.code = 'UNAUTHORIZED';
      return next(err);
    }
    if (!roles.includes(req.user.role)) {
      const err = new Error('Insufficient permissions') as AppError;
      err.statusCode = 403;
      err.code = 'FORBIDDEN';
      return next(err);
    }
    next();
  };
}
