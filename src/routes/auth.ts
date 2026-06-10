import { Router, Request, Response, NextFunction } from 'express';
import crypto from 'crypto';
import { authRateLimiter } from '../middleware/rateLimiter';
import {
  register,
  login,
  refreshTokens,
  logout,
  forgotPassword,
  resetPassword,
} from '../services/auth.service';
import {
  getAuthorizationUrl,
  handleGoogleCallback,
} from '../services/google-oauth.service';
import { AppError } from '../middleware/errorHandler';

const router = Router();

function validateEmail(email: unknown): email is string {
  return typeof email === 'string' && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function validatePassword(password: unknown): password is string {
  return typeof password === 'string' && password.length >= 8;
}

function badRequest(message: string, code: string): AppError {
  const err = new Error(message) as AppError;
  err.statusCode = 400;
  err.code = code;
  return err;
}

// POST /auth/register
router.post('/register', authRateLimiter, async (req: Request, res: Response, next: NextFunction) => {
  const { email, password } = req.body;
  if (!validateEmail(email)) return next(badRequest('Invalid email', 'INVALID_EMAIL'));
  if (!validatePassword(password)) return next(badRequest('Password must be at least 8 characters', 'INVALID_PASSWORD'));

  const result = await register(email, password);
  res.status(201).json(result);
});

// POST /auth/login
router.post('/login', authRateLimiter, async (req: Request, res: Response, next: NextFunction) => {
  const { email, password } = req.body;
  if (!validateEmail(email)) return next(badRequest('Invalid email', 'INVALID_EMAIL'));
  if (!password) return next(badRequest('Password required', 'PASSWORD_REQUIRED'));

  const result = await login(email, password);
  res.json(result);
});

// POST /auth/refresh
router.post('/refresh', async (req: Request, res: Response, next: NextFunction) => {
  const { refreshToken } = req.body;
  if (!refreshToken || typeof refreshToken !== 'string') {
    return next(badRequest('refreshToken required', 'REFRESH_TOKEN_REQUIRED'));
  }
  const result = await refreshTokens(refreshToken);
  res.json(result);
});

// POST /auth/logout
router.post('/logout', async (req: Request, res: Response) => {
  const { refreshToken } = req.body;
  if (refreshToken) await logout(refreshToken);
  res.sendStatus(204);
});

// POST /auth/forgot-password
router.post('/forgot-password', authRateLimiter, async (req: Request, res: Response, next: NextFunction) => {
  const { email } = req.body;
  if (!validateEmail(email)) return next(badRequest('Invalid email', 'INVALID_EMAIL'));
  await forgotPassword(email);
  res.json({ message: 'If this email exists, a reset link has been sent.' });
});

// POST /auth/reset-password
router.post('/reset-password', async (req: Request, res: Response, next: NextFunction) => {
  const { token, password } = req.body;
  if (!token || typeof token !== 'string') return next(badRequest('Token required', 'TOKEN_REQUIRED'));
  if (!validatePassword(password)) return next(badRequest('Password must be at least 8 characters', 'INVALID_PASSWORD'));
  await resetPassword(token, password);
  res.json({ message: 'Password reset successfully.' });
});

// GET /auth/google
router.get('/google', (req: Request, res: Response) => {
  const state = crypto.randomUUID();
  const url = getAuthorizationUrl(state);
  res.redirect(url);
});

// GET /auth/google/callback
router.get('/google/callback', async (req: Request, res: Response, next: NextFunction) => {
  const { code } = req.query;
  if (!code || typeof code !== 'string') {
    return next(badRequest('Missing code', 'MISSING_CODE'));
  }
  const result = await handleGoogleCallback(code);
  res.json(result);
});

export default router;
