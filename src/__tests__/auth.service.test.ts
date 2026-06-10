import bcrypt from 'bcryptjs';

// Mock pool BEFORE importing auth.service
jest.mock('../db/client', () => ({
  default: { query: jest.fn() },
  __esModule: true,
}));

import pool from '../db/client';
import { register, login } from '../services/auth.service';

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
