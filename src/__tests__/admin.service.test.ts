jest.mock('../db/client', () => ({ default: { query: jest.fn() }, __esModule: true }));

import pool from '../db/client';
import { listUsers, getUser, updateUserStatus, listOrganizations, getOrganization, updateOrgPlan, getGlobalStats } from '../services/admin.service';

const mockQuery = pool.query as jest.Mock;

describe('listUsers', () => {
  beforeEach(() => jest.clearAllMocks());
  it('retourne les users paginés', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [{ total: 5 }] }).mockResolvedValueOnce({ rows: [{ id: 'u1' }] });
    const result = await listUsers({});
    expect(result.total).toBe(5);
    expect(result.users).toHaveLength(1);
  });
});

describe('getUser', () => {
  beforeEach(() => jest.clearAllMocks());
  it('retourne le user', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [{ id: 'u1', email: 'test@test.com' }] });
    const result = await getUser('u1');
    expect(result.email).toBe('test@test.com');
  });
  it('lève 404 USER_NOT_FOUND', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [] });
    await expect(getUser('unknown')).rejects.toMatchObject({ statusCode: 404, code: 'USER_NOT_FOUND' });
  });
});

describe('updateUserStatus', () => {
  beforeEach(() => jest.clearAllMocks());
  it('met à jour le status', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [{ id: 'u1', status: 'suspended' }] });
    const result = await updateUserStatus('u1', 'suspended');
    expect(result.status).toBe('suspended');
  });
  it('lève 400 INVALID_STATUS', async () => {
    await expect(updateUserStatus('u1', 'invalid')).rejects.toMatchObject({ statusCode: 400, code: 'INVALID_STATUS' });
  });
});

describe('listOrganizations', () => {
  beforeEach(() => jest.clearAllMocks());
  it('retourne les orgs paginées', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [{ total: 2 }] }).mockResolvedValueOnce({ rows: [{ id: 'o1' }, { id: 'o2' }] });
    const result = await listOrganizations({});
    expect(result.total).toBe(2);
  });
});

describe('updateOrgPlan', () => {
  beforeEach(() => jest.clearAllMocks());
  it('met à jour le plan', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [{ id: 'o1', plan: 'pro' }] });
    const result = await updateOrgPlan('o1', 'pro');
    expect(result.plan).toBe('pro');
  });
  it('lève 400 INVALID_PLAN', async () => {
    await expect(updateOrgPlan('o1', 'enterprise')).rejects.toMatchObject({ statusCode: 400, code: 'INVALID_PLAN' });
  });
});

describe('getGlobalStats', () => {
  beforeEach(() => jest.clearAllMocks());
  it('retourne les statistiques globales', async () => {
    mockQuery
      .mockResolvedValueOnce({ rows: [{ count: 10 }] })
      .mockResolvedValueOnce({ rows: [{ count: 3 }] })
      .mockResolvedValueOnce({ rows: [{ count: 15 }] })
      .mockResolvedValueOnce({ rows: [{ count: 7 }] });
    const result = await getGlobalStats();
    expect(result.users).toBe(10);
    expect(result.organizations).toBe(3);
  });
});
