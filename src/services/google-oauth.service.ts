import { OAuth2Client } from 'google-auth-library';
import pool from '../db/client';
import { signAccessToken, generateRawRefreshToken, hashToken } from './token.service';

const REFRESH_TOKEN_EXPIRES_DAYS = 30;

function getOAuth2Client(): OAuth2Client {
  return new OAuth2Client(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    process.env.GOOGLE_CALLBACK_URL
  );
}

export function getAuthorizationUrl(state: string): string {
  const client = getOAuth2Client();
  return client.generateAuthUrl({
    access_type: 'offline',
    scope: ['email', 'profile'],
    state,
  });
}

export async function handleGoogleCallback(
  code: string
): Promise<{ accessToken: string; refreshToken: string; user: Record<string, unknown> }> {
  const client = getOAuth2Client();
  const { tokens } = await client.getToken(code);
  client.setCredentials(tokens);

  const ticket = await client.verifyIdToken({
    idToken: tokens.id_token!,
    audience: process.env.GOOGLE_CLIENT_ID,
  });
  const googlePayload = ticket.getPayload();
  if (!googlePayload?.email) throw new Error('Google payload missing email');

  const { sub: googleId, email, picture: avatarUrl } = googlePayload;

  // Look up by google_id first
  let userResult = await pool.query(
    `SELECT id, email, first_name, last_name, locale FROM users WHERE google_id = $1`,
    [googleId]
  );
  let user = userResult.rows[0];

  if (!user) {
    // Look up by email (existing account without Google)
    userResult = await pool.query(
      `SELECT id, email, first_name, last_name, locale FROM users WHERE email = $1`,
      [email]
    );
    user = userResult.rows[0];

    if (user) {
      // Link Google to existing account
      await pool.query(
        `UPDATE users SET google_id = $1, avatar_url = $2 WHERE id = $3`,
        [googleId, avatarUrl, user.id]
      );
    } else {
      // Create new account with org
      await pool.query('BEGIN');
      try {
        const newUser = await pool.query(
          `INSERT INTO users (email, google_id, avatar_url)
           VALUES ($1, $2, $3)
           RETURNING id, email, first_name, last_name, locale`,
          [email, googleId, avatarUrl]
        );
        user = newUser.rows[0];

        const newOrg = await pool.query(
          `INSERT INTO organizations (owner_id, name) VALUES ($1, $2) RETURNING id`,
          [user.id, 'Mon organisation']
        );
        await pool.query(
          `INSERT INTO organization_members (organization_id, user_id, role) VALUES ($1, $2, 'owner')`,
          [newOrg.rows[0].id, user.id]
        );
        await pool.query('COMMIT');
      } catch (err) {
        await pool.query('ROLLBACK');
        throw err;
      }
    }
  }

  // Get membership
  const memberResult = await pool.query(
    `SELECT organization_id, role FROM organization_members
     WHERE user_id = $1 ORDER BY created_at ASC LIMIT 1`,
    [user.id]
  );
  const membership = memberResult.rows[0] ?? { organization_id: null, role: 'viewer' };

  // Generate Scenauria tokens
  const rawRefreshToken = generateRawRefreshToken();
  const tokenHash = hashToken(rawRefreshToken);
  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + REFRESH_TOKEN_EXPIRES_DAYS);

  await pool.query(
    `INSERT INTO refresh_tokens (user_id, token_hash, expires_at) VALUES ($1, $2, $3)`,
    [user.id, tokenHash, expiresAt]
  );

  const accessToken = signAccessToken(user.id, membership.organization_id, membership.role);
  return { accessToken, refreshToken: rawRefreshToken, user };
}
