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

describe('GET /hotspots', () => {
  beforeEach(() => jest.clearAllMocks());

  it('200 liste les hotspots', async () => {
    mockQuery
      .mockResolvedValueOnce({ rows: [{ total: 1 }] })
      .mockResolvedValueOnce({ rows: [{ id: 'h1', title: 'Entrée' }] });
    const res = await request(app).get('/hotspots');
    expect(res.status).toBe(200);
    expect(res.body.hotspots).toHaveLength(1);
    expect(res.body.total).toBe(1);
  });
});

describe('POST /hotspots', () => {
  beforeEach(() => jest.clearAllMocks());

  it('201 crée un hotspot', async () => {
    mockQuery
      .mockResolvedValueOnce({ rows: [{ id: 'v1' }] })
      .mockResolvedValueOnce({ rows: [{ id: 'h1', title: 'Panneau', type: 'info' }] });
    const res = await request(app)
      .post('/hotspots')
      .send({ visit_id: 'v1', title: 'Panneau', type: 'info' });
    expect(res.status).toBe(201);
    expect(res.body.id).toBe('h1');
  });

  it('400 VISIT_ID_REQUIRED', async () => {
    const res = await request(app)
      .post('/hotspots')
      .send({ title: 'X', type: 'info' });
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VISIT_ID_REQUIRED');
  });

  it('400 TITLE_REQUIRED', async () => {
    const res = await request(app)
      .post('/hotspots')
      .send({ visit_id: 'v1', type: 'info' });
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('TITLE_REQUIRED');
  });

  it('400 TYPE_REQUIRED', async () => {
    const res = await request(app)
      .post('/hotspots')
      .send({ visit_id: 'v1', title: 'X' });
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('TYPE_REQUIRED');
  });
});

describe('GET /hotspots/:id', () => {
  beforeEach(() => jest.clearAllMocks());

  it('200 retourne le hotspot', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [{ id: 'h1', title: 'Entrée' }] });
    const res = await request(app).get('/hotspots/h1');
    expect(res.status).toBe(200);
    expect(res.body.id).toBe('h1');
  });

  it('404 HOTSPOT_NOT_FOUND', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [] });
    const res = await request(app).get('/hotspots/unknown');
    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe('HOTSPOT_NOT_FOUND');
  });
});

describe('PATCH /hotspots/:id', () => {
  beforeEach(() => jest.clearAllMocks());

  it('200 met à jour', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [{ id: 'h1', title: 'Modifié' }] });
    const res = await request(app).patch('/hotspots/h1').send({ title: 'Modifié' });
    expect(res.status).toBe(200);
    expect(res.body.title).toBe('Modifié');
  });
});

describe('DELETE /hotspots/:id', () => {
  beforeEach(() => jest.clearAllMocks());

  it('204 supprime le hotspot', async () => {
    mockQuery.mockResolvedValueOnce({ rowCount: 1 });
    const res = await request(app).delete('/hotspots/h1');
    expect(res.status).toBe(204);
  });
});

describe('GET /visits/:visitId/hotspots', () => {
  beforeEach(() => jest.clearAllMocks());

  it('200 retourne les hotspots de la visite', async () => {
    mockQuery
      .mockResolvedValueOnce({ rows: [{ id: 'v1' }] })
      .mockResolvedValueOnce({ rows: [{ id: 'h1' }] });
    const res = await request(app).get('/visits/v1/hotspots');
    expect(res.status).toBe(200);
    expect(res.body.hotspots).toHaveLength(1);
  });

  it('404 VISIT_NOT_FOUND', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [] });
    const res = await request(app).get('/visits/alien/hotspots');
    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe('VISIT_NOT_FOUND');
  });
});
