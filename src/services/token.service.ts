import jwt, { SignOptions } from 'jsonwebtoken';
import crypto from 'crypto';

export interface AccessTokenPayload {
  userId: string;
  orgId: string;
  role: string;
}

export function signAccessToken(userId: string, orgId: string, role: string): string {
  const secret = process.env.JWT_SECRET;
  if (!secret) throw new Error('JWT_SECRET not set');

  const expiresIn = (process.env.JWT_ACCESS_EXPIRES_IN ?? '15m') as SignOptions['expiresIn'];
  return jwt.sign({ userId, orgId, role }, secret, { expiresIn });
}

export function verifyAccessToken(token: string): AccessTokenPayload {
  const secret = process.env.JWT_SECRET;
  if (!secret) throw new Error('JWT_SECRET not set');

  const payload = jwt.verify(token, secret) as jwt.JwtPayload & AccessTokenPayload;
  return {
    userId: payload.userId,
    orgId: payload.orgId,
    role: payload.role,
  };
}

export function generateRawRefreshToken(): string {
  return crypto.randomBytes(64).toString('hex');
}

export function hashToken(rawToken: string): string {
  return crypto.createHash('sha256').update(rawToken).digest('hex');
}

export function generateResetToken(userId: string): string {
  const secret = process.env.JWT_SECRET;
  if (!secret) throw new Error('JWT_SECRET not set');

  const expiresIn = (process.env.JWT_RESET_EXPIRES_IN ?? '1h') as SignOptions['expiresIn'];
  return jwt.sign({ userId, type: 'password_reset' }, secret, { expiresIn });
}

export function verifyResetToken(token: string): { userId: string } {
  const secret = process.env.JWT_SECRET;
  if (!secret) throw new Error('JWT_SECRET not set');

  const payload = jwt.verify(token, secret) as jwt.JwtPayload & { userId: string; type: string };
  if (payload.type !== 'password_reset') throw new Error('Invalid token type');
  return { userId: payload.userId };
}
