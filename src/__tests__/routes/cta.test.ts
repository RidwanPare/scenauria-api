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

describe('GET /cta', () => {
  beforeEach(() => jest.clearAllMocks());

  it('200 liste les CTA buttons', async () => {
    mockQuery
      .mockResolvedValueOnce({ rows: [{ total: 1 }] })
      .mockResolvedValueOnce({ rows: [{ id: 'c1', label: 'Réserver' }] });
    const res = await request(app).get('/cta');
    expect(res.status).toBe(200);
    expect(res.body.cta_buttons).toHaveLength(1);
    expect(res.body.total).toBe(1);
  });
});

describe('POST /cta', () => {
  beforeEach(() => jest.clearAllMocks());

  it('201 crée un CTA button', async () => {
    mockQuery
      .mockResolvedValueOnce({ rows: [{ id: 'v1' }] })
      .mockResolvedValueOnce({ rows: [{ id: 'c1', label: 'Acheter', type: 'link' }] });
    const res = await request(app)
      .post('/cta')
      .send({ visit_id: 'v1', label: 'Acheter', type: 'link' });
    expect(res.status).toBe(201);
    expect(res.body.id).toBe('c1');
  });

  it('400 VISIT_ID_REQUIRED', async () => {
    const res = await request(app)
      .post('/cta')
      .send({ label: 'X', type: 'link' });
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VISIT_ID_REQUIRED');
  });

  it('400 LABEL_REQUIRED', async () => {
    const res = await request(app)
      .post('/cta')
      .send({ visit_id: 'v1', type: 'link' });
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('LABEL_REQUIRED');
  });

  it('400 TYPE_REQUIRED', async () => {
    const res = await request(app)
      .post('/cta')
      .send({ visit_id: 'v1', label: 'X' });
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('TYPE_REQUIRED');
  });
});

describe('GET /cta/:id', () => {
  beforeEach(() => jest.clearAllMocks());

  it('200 retourne le CTA button', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [{ id: 'c1', label: 'Réserver' }] });
    const res = await request(app).get('/cta/c1');
    expect(res.status).toBe(200);
    expect(res.body.id).toBe('c1');
  });

  it('404 CTA_NOT_FOUND', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [] });
    const res = await request(app).get('/cta/unknown');
    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe('CTA_NOT_FOUND');
  });
});

describe('PATCH /cta/:id', () => {
  beforeEach(() => jest.clearAllMocks());

  it('200 met à jour', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [{ id: 'c1', label: 'Modifié' }] });
    const res = await request(app).patch('/cta/c1').send({ label: 'Modifié' });
    expect(res.status).toBe(200);
    expect(res.body.label).toBe('Modifié');
  });
});

describe('DELETE /cta/:id', () => {
  beforeEach(() => jest.clearAllMocks());

  it('204 supprime le CTA button', async () => {
    mockQuery.mockResolvedValueOnce({ rowCount: 1 });
    const res = await request(app).delete('/cta/c1');
    expect(res.status).toBe(204);
  });
});

describe('GET /visits/:visitId/cta', () => {
  beforeEach(() => jest.clearAllMocks());

  it('200 retourne les CTA de la visite', async () => {
    mockQuery
      .mockResolvedValueOnce({ rows: [{ id: 'v1' }] })
      .mockResolvedValueOnce({ rows: [{ id: 'c1' }] });
    const res = await request(app).get('/visits/v1/cta');
    expect(res.status).toBe(200);
    expect(res.body.cta_buttons).toHaveLength(1);
  });

  it('404 VISIT_NOT_FOUND', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [] });
    const res = await request(app).get('/visits/alien/cta');
    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe('VISIT_NOT_FOUND');
  });
});
