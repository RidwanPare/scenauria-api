jest.mock('../../middleware/auth', () => ({
  authenticate: (req: any, res: any, next: any) => {
    req.user = { userId: 'u1', orgId: 'org-uuid', role: 'superadmin' };
    next();
  },
  authorize: (...roles: string[]) => (req: any, res: any, next: any) => next(),
}));

jest.mock('../../db/client', () => ({ default: { query: jest.fn() }, __esModule: true }));

import request from 'supertest';
import app from '../../index';
import pool from '../../db/client';
const mockQuery = pool.query as jest.Mock;

describe('GET /admin/stats', () => {
  beforeEach(() => jest.clearAllMocks());
  it('200 retourne les stats globales', async () => {
    mockQuery
      .mockResolvedValueOnce({ rows: [{ count: 10 }] })
      .mockResolvedValueOnce({ rows: [{ count: 3 }] })
      .mockResolvedValueOnce({ rows: [{ count: 15 }] })
      .mockResolvedValueOnce({ rows: [{ count: 7 }] });
    const res = await request(app).get('/admin/stats');
    expect(res.status).toBe(200);
    expect(res.body.users).toBe(10);
  });
});

describe('GET /admin/users', () => {
  beforeEach(() => jest.clearAllMocks());
  it('200 liste les users', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [{ total: 2 }] }).mockResolvedValueOnce({ rows: [{ id: 'u1' }, { id: 'u2' }] });
    const res = await request(app).get('/admin/users');
    expect(res.status).toBe(200);
    expect(res.body.users).toHaveLength(2);
  });
});

describe('PATCH /admin/users/:id', () => {
  beforeEach(() => jest.clearAllMocks());
  it('200 met à jour le status user', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [{ id: 'u1', status: 'suspended' }] });
    const res = await request(app).patch('/admin/users/u1').send({ status: 'suspended' });
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('suspended');
  });
});

describe('GET /admin/organizations', () => {
  beforeEach(() => jest.clearAllMocks());
  it('200 liste les orgs', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [{ total: 1 }] }).mockResolvedValueOnce({ rows: [{ id: 'o1' }] });
    const res = await request(app).get('/admin/organizations');
    expect(res.status).toBe(200);
    expect(res.body.organizations).toHaveLength(1);
  });
});

describe('PATCH /admin/organizations/:id', () => {
  beforeEach(() => jest.clearAllMocks());
  it('200 met à jour le plan', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [{ id: 'o1', plan: 'pro' }] });
    const res = await request(app).patch('/admin/organizations/o1').send({ plan: 'pro' });
    expect(res.status).toBe(200);
    expect(res.body.plan).toBe('pro');
  });
});

describe('GET /admin/organizations/:id', () => {
  beforeEach(() => jest.clearAllMocks());
  it('200 détail org', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [{ id: 'o1', name: 'Test Org' }] });
    const res = await request(app).get('/admin/organizations/o1');
    expect(res.status).toBe(200);
    expect(res.body.name).toBe('Test Org');
  });
});
