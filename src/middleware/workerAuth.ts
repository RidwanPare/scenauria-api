import { Request, Response, NextFunction } from 'express';
import { AppError } from './errorHandler';

declare global {
  namespace Express {
    interface Request {
      isWorker?: boolean;
    }
  }
}

/** Authentifie les callbacks du worker via le header X-Worker-Secret. */
export function workerAuth(req: Request, res: Response, next: NextFunction): void {
  const secret = process.env.WORKER_CALLBACK_SECRET;
  const provided = req.headers['x-worker-secret'];

  if (!secret || !provided || provided !== secret) {
    const err = new Error('Invalid worker secret') as AppError;
    err.statusCode = 401;
    err.code = 'UNAUTHORIZED';
    return next(err);
  }

  req.isWorker = true;
  next();
}
