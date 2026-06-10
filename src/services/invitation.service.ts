import crypto from 'crypto';
import pool from '../db/client';
import { hashToken } from './token.service';
import { AppError } from '../middleware/errorHandler';
import { Resend } from 'resend';

const INVITATION_EXPIRES_DAYS = 7;

function makeAppError(message: string, statusCode: number, code: string): AppError {
  const err = new Error(message) as AppError;
  err.statusCode = statusCode;
  err.code = code;
  return err;
}

export async function inviteByEmail(
  organizationId: string,
  invitedById: string,
  email: string,
  role: string
): Promise<void> {
  const rawToken = crypto.randomBytes(32).toString('hex');
  const tokenHash = hashToken(rawToken);
  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + INVITATION_EXPIRES_DAYS);

  await pool.query(
    `INSERT INTO invitations (organization_id, invited_by, email, token_hash, role, expires_at)
     VALUES ($1, $2, $3, $4, $5, $6)`,
    [organizationId, invitedById, email, tokenHash, role, expiresAt]
  );

  const resend = new Resend(process.env.RESEND_API_KEY);
  const inviteUrl = `${process.env.CORS_ORIGIN ?? 'http://localhost:3000'}/invitations/${rawToken}/accept`;

  await resend.emails.send({
    from: process.env.EMAIL_FROM ?? 'noreply@scenauria.com',
    to: email,
    subject: 'Invitation à rejoindre Scenauria',
    html: `<p>Vous avez été invité(e) à rejoindre une organisation sur Scenauria.</p>
           <p><a href="${inviteUrl}">Accepter l'invitation</a> (valable 7 jours)</p>`,
  });
}

export async function addExistingUser(
  organizationId: string,
  email: string,
  role: string
): Promise<void> {
  const userResult = await pool.query(
    `SELECT id FROM users WHERE email = $1 AND status = 'active'`,
    [email]
  );
  const user = userResult.rows[0];
  if (!user) throw makeAppError('User not found', 404, 'USER_NOT_FOUND');

  const existing = await pool.query(
    `SELECT id FROM organization_members WHERE organization_id = $1 AND user_id = $2`,
    [organizationId, user.id]
  );
  if (existing.rows[0]) throw makeAppError('User already member', 409, 'ALREADY_MEMBER');

  await pool.query(
    `INSERT INTO organization_members (organization_id, user_id, role) VALUES ($1, $2, $3)`,
    [organizationId, user.id, role]
  );
}

export async function acceptInvitation(rawToken: string): Promise<void> {
  const tokenHash = hashToken(rawToken);

  const invitResult = await pool.query(
    `SELECT id, organization_id, email, role, expires_at, accepted_at
     FROM invitations WHERE token_hash = $1`,
    [tokenHash]
  );
  const invitation = invitResult.rows[0];

  if (!invitation) throw makeAppError('Invitation not found', 404, 'INVITATION_NOT_FOUND');
  if (invitation.accepted_at) throw makeAppError('Invitation already used', 409, 'INVITATION_USED');
  if (new Date(invitation.expires_at) < new Date()) {
    throw makeAppError('Invitation expired', 410, 'INVITATION_EXPIRED');
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const userResult = await client.query(
      `SELECT id FROM users WHERE email = $1`,
      [invitation.email]
    );
    let userId = userResult.rows[0]?.id;

    if (!userId) {
      const newUser = await client.query(
        `INSERT INTO users (email) VALUES ($1) RETURNING id`,
        [invitation.email]
      );
      userId = newUser.rows[0].id;
    }

    await client.query(
      `INSERT INTO organization_members (organization_id, user_id, role)
       VALUES ($1, $2, $3)
       ON CONFLICT (organization_id, user_id) DO NOTHING`,
      [invitation.organization_id, userId, invitation.role]
    );

    await client.query(
      `UPDATE invitations SET accepted_at = NOW() WHERE id = $1`,
      [invitation.id]
    );

    await client.query('COMMIT');
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}
