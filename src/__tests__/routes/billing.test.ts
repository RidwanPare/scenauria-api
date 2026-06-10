jest.mock('../../middleware/auth', () => ({
  authenticate: (req: any, _res: any, next: any) => {
    req.user = { userId: 'u1', orgId: 'org-uuid', role: 'owner' };
    next();
  },
  authorize: (..._roles: string[]) => (_req: any, _res: any, next: any) => next(),
}));

jest.mock('../../db/client', () => ({ default: { query: jest.fn() }, __esModule: true }));

import request from 'supertest';
import app from '../../index';
import pool from '../../db/client';

const mockQuery = pool.query as jest.Mock;

describe('GET /billing/subscription', () => {
  beforeEach(() => jest.clearAllMocks());

  it('200 retourne la subscription', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [{ id: 's1', plan: 'pro', status: 'active' }] });
    const res = await request(app).get('/billing/subscription');
    expect(res.status).toBe(200);
    expect(res.body.subscription.plan).toBe('pro');
  });

  it('200 subscription null si aucune', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [] });
    const res = await request(app).get('/billing/subscription');
    expect(res.status).toBe(200);
    expect(res.body.subscription).toBeNull();
  });
});

describe('GET /billing/invoices', () => {
  beforeEach(() => jest.clearAllMocks());

  it('200 retourne les factures', async () => {
    mockQuery
      .mockResolvedValueOnce({ rows: [{ total: 1 }] })
      .mockResolvedValueOnce({ rows: [{ id: 'i1' }] });
    const res = await request(app).get('/billing/invoices');
    expect(res.status).toBe(200);
    expect(res.body.invoices).toHaveLength(1);
  });
});

describe('POST /billing/webhook', () => {
  beforeEach(() => jest.clearAllMocks());

  it('200 si stripe-signature présente', async () => {
    const res = await request(app)
      .post('/billing/webhook')
      .set('stripe-signature', 'sig_xxx')
      .send({ type: 'invoice.paid' });
    expect(res.status).toBe(200);
    expect(res.body.received).toBe(true);
  });

  it('400 si stripe-signature absente', async () => {
    const res = await request(app)
      .post('/billing/webhook')
      .send({ type: 'invoice.paid' });
    expect(res.status).toBe(400);
  });
});
