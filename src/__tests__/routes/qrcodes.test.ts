jest.mock('../../middleware/auth', () => ({
  authenticate: (req: any, _res: any, next: any) => {
    req.user = { userId: 'user-uuid', orgId: 'org-uuid', role: 'owner' };
    next();
  },
  authorize: (..._roles: string[]) => (_req: any, _res: any, next: any) => next(),
}));

jest.mock('../../db/client', () => ({
  default: { query: jest.fn() },
  __esModule: true,
}));

import request from 'supertest';
import app from '../../index';
import pool from '../../db/client';

const mockQuery = pool.query as jest.Mock;

describe('GET /qrcodes', () => {
  beforeEach(() => jest.clearAllMocks());

  it('200 liste les QR codes', async () => {
    mockQuery
      .mockResolvedValueOnce({ rows: [{ total: 1 }] })
      .mockResolvedValueOnce({ rows: [{ id: 'q1', name: 'Vitrine' }] });
    const res = await request(app).get('/qrcodes');
    expect(res.status).toBe(200);
    expect(res.body.qrcodes).toHaveLength(1);
    expect(res.body.total).toBe(1);
  });
});

describe('POST /qrcodes', () => {
  beforeEach(() => jest.clearAllMocks());

  it('201 crée un QR code', async () => {
    mockQuery
      .mockResolvedValueOnce({ rows: [{ id: 'v1' }] })
      .mockResolvedValueOnce({ rows: [{ id: 'q1', name: 'Flyer', tracked_url: 'https://s.io/x' }] });
    const res = await request(app)
      .post('/qrcodes')
      .send({ visit_id: 'v1', name: 'Flyer', tracked_url: 'https://s.io/x' });
    expect(res.status).toBe(201);
    expect(res.body.id).toBe('q1');
  });

  it('400 VISIT_ID_REQUIRED', async () => {
    const res = await request(app)
      .post('/qrcodes')
      .send({ name: 'X', tracked_url: 'https://x.io' });
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VISIT_ID_REQUIRED');
  });

  it('400 NAME_REQUIRED', async () => {
    const res = await request(app)
      .post('/qrcodes')
      .send({ visit_id: 'v1', tracked_url: 'https://x.io' });
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('NAME_REQUIRED');
  });

  it('400 TRACKED_URL_REQUIRED', async () => {
    const res = await request(app)
      .post('/qrcodes')
      .send({ visit_id: 'v1', name: 'X' });
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('TRACKED_URL_REQUIRED');
  });
});

describe('GET /qrcodes/:id', () => {
  beforeEach(() => jest.clearAllMocks());

  it('200 retourne le QR code', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [{ id: 'q1', name: 'Vitrine' }] });
    const res = await request(app).get('/qrcodes/q1');
    expect(res.status).toBe(200);
    expect(res.body.id).toBe('q1');
  });

  it('404 QRCODE_NOT_FOUND', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [] });
    const res = await request(app).get('/qrcodes/unknown');
    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe('QRCODE_NOT_FOUND');
  });
});

describe('PATCH /qrcodes/:id', () => {
  beforeEach(() => jest.clearAllMocks());

  it('200 met à jour', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [{ id: 'q1', name: 'Updated' }] });
    const res = await request(app).patch('/qrcodes/q1').send({ name: 'Updated' });
    expect(res.status).toBe(200);
    expect(res.body.name).toBe('Updated');
  });
});

describe('DELETE /qrcodes/:id', () => {
  beforeEach(() => jest.clearAllMocks());

  it('204 supprime le QR code', async () => {
    mockQuery.mockResolvedValueOnce({ rowCount: 1 });
    const res = await request(app).delete('/qrcodes/q1');
    expect(res.status).toBe(204);
  });
});

describe('GET /visits/:visitId/qrcodes', () => {
  beforeEach(() => jest.clearAllMocks());

  it('200 retourne les QR codes de la visite', async () => {
    mockQuery
      .mockResolvedValueOnce({ rows: [{ id: 'v1' }] })
      .mockResolvedValueOnce({ rows: [{ id: 'q1' }] });
    const res = await request(app).get('/visits/v1/qrcodes');
    expect(res.status).toBe(200);
    expect(res.body.qrcodes).toHaveLength(1);
  });

  it('404 VISIT_NOT_FOUND', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [] });
    const res = await request(app).get('/visits/alien/qrcodes');
    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe('VISIT_NOT_FOUND');
  });
});
