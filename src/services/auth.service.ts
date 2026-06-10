import bcrypt from 'bcryptjs';
import pool from '../db/client';
import { AppError } from '../middleware/errorHandler';
import {
  signAccessToken,
  generateRawRefreshToken,
  hashToken,
  generateResetToken,
  verifyResetToken,
} from './token.service';

const BCRYPT_COST = 12;
const REFRESH_TOKEN_EXPIRES_DAYS = 30;

export function makeAppError(message: string, statusCode: number, code: string): AppError {
  const err = new Error(message) as AppError;
  err.statusCode = statusCode;
  err.code = code;
  return err;
}

export async function storeRefreshToken(userId: string, rawToken: string): Promise<void> {
  const tokenHash = hashToken(rawToken);
  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + REFRESH_TOKEN_EXPIRES_DAYS);

  await pool.query(
    `INSERT INTO refresh_tokens (user_id, token_hash, expires_at) VALUES ($1, $2, $3)`,
    [userId, tokenHash, expiresAt]
  );
}

export async function register(
  email: string,
  password: string
): Promise<{ accessToken: string; refreshToken: string; user: Record<string, unknown> }> {
  const passwordHash = await bcrypt.hash(password, BCRYPT_COST);

  await pool.query('BEGIN');
  try {
    const userResult = await pool.query(
      `INSERT INTO users (email, password_hash)
       VALUES ($1, $2)
       RETURNING id, email, first_name, last_name, locale`,
      [email, passwordHash]
    );
    const user = userResult.rows[0];

    const orgResult = await pool.query(
      `INSERT INTO organizations (owner_id, name)
       VALUES ($1, $2)
       RETURNING id`,
      [user.id, 'Mon organisation']
    );
    const org = orgResult.rows[0];

    await pool.query(
      `INSERT INTO organization_members (organization_id, user_id, role)
       VALUES ($1, $2, 'owner')`,
      [org.id, user.id]
    );

    const rawRefreshToken = generateRawRefreshToken();
    await storeRefreshToken(user.id, rawRefreshToken);

    await pool.query('COMMIT');

    const accessToken = signAccessToken(user.id, org.id, 'owner');
    return { accessToken, refreshToken: rawRefreshToken, user };
  } catch (err: unknown) {
    await pool.query('ROLLBACK');
    if (
      typeof err === 'object' &&
      err !== null &&
      'code' in err &&
      (err as { code: string }).code === '23505'
    ) {
      throw makeAppError('Email already in use', 409, 'EMAIL_TAKEN');
    }
    throw err;
  }
}

export async function login(
  email: string,
  password: string
): Promise<{ accessToken: string; refreshToken: string; user: Record<string, unknown> }> {
  const userResult = await pool.query(
    `SELECT id, email, password_hash, first_name, last_name, locale
     FROM users WHERE email = $1 AND status = 'active'`,
    [email]
  );

  const user = userResult.rows[0];
  if (!user) throw makeAppError('Invalid credentials', 401, 'INVALID_CREDENTIALS');

  const valid = await bcrypt.compare(password, user.password_hash ?? '');
  if (!valid) throw makeAppError('Invalid credentials', 401, 'INVALID_CREDENTIALS');

  const memberResult = await pool.query(
    `SELECT organization_id, role FROM organization_members
     WHERE user_id = $1
     ORDER BY created_at ASC LIMIT 1`,
    [user.id]
  );
  const membership = memberResult.rows[0] ?? { organization_id: null, role: 'viewer' };

  const rawRefreshToken = generateRawRefreshToken();
  await storeRefreshToken(user.id, rawRefreshToken);

  const accessToken = signAccessToken(user.id, membership.organization_id, membership.role);
  const { password_hash: _, ...safeUser } = user;
  return { accessToken, refreshToken: rawRefreshToken, user: safeUser };
}

export async function refreshTokens(
  rawRefreshToken: string
): Promise<{ accessToken: string; refreshToken: string }> {
  const tokenHash = hashToken(rawRefreshToken);

  const result = await pool.query(
    `SELECT id, user_id, revoked_at, expires_at
     FROM refresh_tokens WHERE token_hash = $1`,
    [tokenHash]
  );
  const tokenRecord = result.rows[0];

  if (
    !tokenRecord ||
    tokenRecord.revoked_at ||
    new Date(tokenRecord.expires_at) < new Date()
  ) {
    throw makeAppError('Invalid refresh token', 401, 'INVALID_REFRESH_TOKEN');
  }

  // Rotate: revoke the old token
  await pool.query(
    `UPDATE refresh_tokens SET revoked_at = NOW() WHERE id = $1`,
    [tokenRecord.id]
  );

  const memberResult = await pool.query(
    `SELECT organization_id, role FROM organization_members
     WHERE user_id = $1 ORDER BY created_at ASC LIMIT 1`,
    [tokenRecord.user_id]
  );
  const membership = memberResult.rows[0] ?? { organization_id: null, role: 'viewer' };

  const newRawRefreshToken = generateRawRefreshToken();
  await storeRefreshToken(tokenRecord.user_id, newRawRefreshToken);

  const newAccessToken = signAccessToken(
    tokenRecord.user_id,
    membership.organization_id,
    membership.role
  );
  return { accessToken: newAccessToken, refreshToken: newRawRefreshToken };
}

export async function logout(rawRefreshToken: string): Promise<void> {
  const tokenHash = hashToken(rawRefreshToken);
  await pool.query(
    `UPDATE refresh_tokens SET revoked_at = NOW()
     WHERE token_hash = $1 AND revoked_at IS NULL`,
    [tokenHash]
  );
}

export async function forgotPassword(email: string): Promise<void> {
  const result = await pool.query(
    `SELECT id FROM users WHERE email = $1 AND status = 'active'`,
    [email]
  );
  // Don't reveal if email exists
  if (!result.rows[0]) return;

  const user = result.rows[0];
  const resetToken = generateResetToken(user.id);

  const { Resend } = await import('resend');
  const resend = new Resend(process.env.RESEND_API_KEY);
  const resetUrl = `${process.env.CORS_ORIGIN ?? 'http://localhost:3000'}/auth/reset-password?token=${resetToken}`;

  await resend.emails.send({
    from: process.env.EMAIL_FROM ?? 'noreply@scenauria.com',
    to: email,
    subject: 'Réinitialisation de votre mot de passe Scenauria',
    html: `<p>Cliquez sur ce lien pour réinitialiser votre mot de passe (valable 1h) :</p>
           <a href="${resetUrl}">${resetUrl}</a>`,
  });
}

export async function resetPassword(token: string, newPassword: string): Promise<void> {
  const { userId } = verifyResetToken(token);
  const passwordHash = await bcrypt.hash(newPassword, BCRYPT_COST);

  await pool.query(
    `UPDATE users SET password_hash = $1 WHERE id = $2`,
    [passwordHash, userId]
  );
  // Revoke all refresh tokens for security
  await pool.query(
    `UPDATE refresh_tokens SET revoked_at = NOW()
     WHERE user_id = $1 AND revoked_at IS NULL`,
    [userId]
  );
}
