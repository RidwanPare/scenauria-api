jest.mock('../../middleware/auth', () => ({
  authenticate: (req: any, res: any, next: any) => { req.user = { userId: 'u1', orgId: 'org-uuid', role: 'owner' }; next(); },
  authorize: (...roles: string[]) => (req: any, res: any, next: any) => next(),
}));

jest.mock('../../db/client', () => ({ default: { query: jest.fn() }, __esModule: true }));

import request from 'supertest';
import app from '../../index';
import pool from '../../db/client';
const mockQuery = pool.query as jest.Mock;

describe('POST /analytics/events (public)', () => {
  beforeEach(() => jest.clearAllMocks());
  it('201 ingeste un événement', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [{ id: 'e1', event_type: 'visit_start' }] });
    const res = await request(app).post('/analytics/events').send({ visit_id: 'v1', place_id: 'p1', event_type: 'visit_start' });
    expect(res.status).toBe(201);
    expect(res.body.event_type).toBe('visit_start');
  });
  it('400 si champs manquants', async () => {
    const res = await request(app).post('/analytics/events').send({ visit_id: 'v1' });
    expect(res.status).toBe(400);
  });
});

describe('GET /analytics/events', () => {
  beforeEach(() => jest.clearAllMocks());
  it('200 liste les événements', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [{ total: 2 }] }).mockResolvedValueOnce({ rows: [{ id: 'e1' }, { id: 'e2' }] });
    const res = await request(app).get('/analytics/events');
    expect(res.status).toBe(200);
    expect(res.body.events).toHaveLength(2);
  });
});

describe('GET /analytics/summary', () => {
  beforeEach(() => jest.clearAllMocks());
  it('200 résumé', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [{ event_type: 'visit_start', count: 5 }] });
    const res = await request(app).get('/analytics/summary');
    expect(res.status).toBe(200);
    expect(res.body.summary).toHaveLength(1);
  });
});

describe('GET /analytics/visits/:visitId', () => {
  beforeEach(() => jest.clearAllMocks());
  it('200 stats de la visite', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [{ id: 'v1' }] }).mockResolvedValueOnce({ rows: [] });
    const res = await request(app).get('/analytics/visits/v1');
    expect(res.status).toBe(200);
    expect(res.body.visit_id).toBe('v1');
  });
});
