import bcrypt from 'bcryptjs';

// Mock pool BEFORE importing auth.service
jest.mock('../db/client', () => ({
  default: { query: jest.fn() },
  __esModule: true,
}));

import pool from '../db/client';
import { register, login, refreshTokens, logout, forgotPassword, resetPassword } from '../services/auth.service';

const mockQuery = pool.query as jest.Mock;

describe('auth.service — register', () => {
  beforeEach(() => jest.clearAllMocks());

  it('crée un user, une organisation, un membership et retourne les tokens', async () => {
    const fakeUser = {
      id: 'user-uuid',
      email: 'test@example.com',
      first_name: null,
      last_name: null,
      locale: 'fr',
    };
    const fakeOrg = { id: 'org-uuid' };

    // BEGIN, INSERT users, INSERT organizations, INSERT organization_members, INSERT refresh_tokens, COMMIT
    mockQuery
      .mockResolvedValueOnce({})                     // BEGIN
      .mockResolvedValueOnce({ rows: [fakeUser] })   // INSERT users
      .mockResolvedValueOnce({ rows: [fakeOrg] })    // INSERT organizations
      .mockResolvedValueOnce({})                     // INSERT organization_members
      .mockResolvedValueOnce({})                     // INSERT refresh_tokens
      .mockResolvedValueOnce({});                    // COMMIT

    const result = await register('test@example.com', 'password123');

    expect(result.user.email).toBe('test@example.com');
    expect(typeof result.accessToken).toBe('string');
    expect(typeof result.refreshToken).toBe('string');
    expect(mockQuery).toHaveBeenCalledWith('BEGIN');
    expect(mockQuery).toHaveBeenCalledWith('COMMIT');
  });

  it('rollback et relève 409 EMAIL_TAKEN si email déjà pris', async () => {
    mockQuery
      .mockResolvedValueOnce({})  // BEGIN
      .mockRejectedValueOnce(Object.assign(new Error('duplicate'), { code: '23505' }))  // INSERT users fails
      .mockResolvedValueOnce({});  // ROLLBACK

    await expect(register('taken@example.com', 'password123')).rejects.toMatchObject({
      statusCode: 409,
      code: 'EMAIL_TAKEN',
    });
  });

  it('rollback et relève l erreur si erreur inconnue en DB', async () => {
    const dbError = new Error('connection lost');
    mockQuery
      .mockResolvedValueOnce({})   // BEGIN
      .mockRejectedValueOnce(dbError)  // INSERT users fails
      .mockResolvedValueOnce({});  // ROLLBACK

    await expect(register('test@example.com', 'password123')).rejects.toThrow('connection lost');
  });
});

describe('auth.service — login', () => {
  beforeEach(() => jest.clearAllMocks());

  it('retourne les tokens pour des credentials valides', async () => {
    const hash = await bcrypt.hash('password123', 12);
    const fakeUser = {
      id: 'user-uuid',
      email: 'test@example.com',
      password_hash: hash,
      first_name: null,
      last_name: null,
      locale: 'fr',
    };
    const fakeMembership = { organization_id: 'org-uuid', role: 'owner' };

    mockQuery
      .mockResolvedValueOnce({ rows: [fakeUser] })      // SELECT user
      .mockResolvedValueOnce({ rows: [fakeMembership] }) // SELECT membership
      .mockResolvedValueOnce({});                        // INSERT refresh_token

    const result = await login('test@example.com', 'password123');
    expect(typeof result.accessToken).toBe('string');
    expect(typeof result.refreshToken).toBe('string');
    expect(result.user.email).toBe('test@example.com');
    expect((result.user as any).password_hash).toBeUndefined(); // must not expose hash
  });

  it('lève 401 INVALID_CREDENTIALS si email inconnu', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [] });
    await expect(login('unknown@example.com', 'pass')).rejects.toMatchObject({
      statusCode: 401,
      code: 'INVALID_CREDENTIALS',
    });
  });

  it('lève 401 INVALID_CREDENTIALS si mot de passe incorrect', async () => {
    const hash = await bcrypt.hash('correct', 12);
    mockQuery.mockResolvedValueOnce({
      rows: [{ id: 'u', email: 'test@example.com', password_hash: hash, first_name: null, last_name: null, locale: 'fr' }],
    });
    await expect(login('test@example.com', 'wrong')).rejects.toMatchObject({
      statusCode: 401,
      code: 'INVALID_CREDENTIALS',
    });
  });
});

describe('auth.service — refreshTokens', () => {
  beforeEach(() => jest.clearAllMocks());

  it('retourne de nouveaux tokens et révoque l ancien', async () => {
    const fakeToken = {
      id: 'token-uuid',
      user_id: 'user-uuid',
      revoked_at: null,
      expires_at: new Date(Date.now() + 1000 * 60 * 60), // 1h in future
    };
    const fakeMembership = { organization_id: 'org-uuid', role: 'owner' };

    mockQuery
      .mockResolvedValueOnce({ rows: [fakeToken] })      // SELECT refresh_token
      .mockResolvedValueOnce({})                          // UPDATE revoke old
      .mockResolvedValueOnce({ rows: [fakeMembership] }) // SELECT membership
      .mockResolvedValueOnce({});                         // INSERT new refresh_token

    const result = await refreshTokens('rawtoken');
    expect(typeof result.accessToken).toBe('string');
    expect(typeof result.refreshToken).toBe('string');
    // Should NOT be the same token
    expect(result.refreshToken).not.toBe('rawtoken');
  });

  it('lève 401 INVALID_REFRESH_TOKEN si token introuvable', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [] });
    await expect(refreshTokens('invalid')).rejects.toMatchObject({
      statusCode: 401,
      code: 'INVALID_REFRESH_TOKEN',
    });
  });

  it('lève 401 INVALID_REFRESH_TOKEN si token révoqué', async () => {
    mockQuery.mockResolvedValueOnce({
      rows: [{
        id: 't',
        user_id: 'u',
        revoked_at: new Date(),  // already revoked
        expires_at: new Date(Date.now() + 9999),
      }],
    });
    await expect(refreshTokens('rawtoken')).rejects.toMatchObject({
      statusCode: 401,
      code: 'INVALID_REFRESH_TOKEN',
    });
  });

  it('lève 401 INVALID_REFRESH_TOKEN si token expiré', async () => {
    mockQuery.mockResolvedValueOnce({
      rows: [{
        id: 't',
        user_id: 'u',
        revoked_at: null,
        expires_at: new Date(Date.now() - 1000), // expired
      }],
    });
    await expect(refreshTokens('rawtoken')).rejects.toMatchObject({
      statusCode: 401,
      code: 'INVALID_REFRESH_TOKEN',
    });
  });
});

describe('auth.service — logout', () => {
  beforeEach(() => jest.clearAllMocks());

  it('révoque le refresh token et résout sans valeur', async () => {
    mockQuery.mockResolvedValueOnce({});
    await expect(logout('rawtoken')).resolves.toBeUndefined();
    expect(mockQuery).toHaveBeenCalledWith(
      expect.stringContaining('UPDATE refresh_tokens'),
      expect.any(Array)
    );
  });
});

describe('auth.service — resetPassword', () => {
  beforeEach(() => jest.clearAllMocks());

  it('update password hash et révoque tous les refresh tokens', async () => {
    const { generateResetToken } = require('../services/token.service');
    const token = generateResetToken('user-uuid');

    mockQuery
      .mockResolvedValueOnce({})  // UPDATE users password_hash
      .mockResolvedValueOnce({}); // UPDATE refresh_tokens revoke all

    await expect(resetPassword(token, 'newpassword123')).resolves.toBeUndefined();
    expect(mockQuery).toHaveBeenCalledTimes(2);
  });

  it('lève une erreur si token invalide', async () => {
    await expect(resetPassword('invalid.token', 'newpass')).rejects.toThrow();
  });
});
