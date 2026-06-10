jest.mock('../../middleware/auth', () => ({
  authenticate: (req: any, res: any, next: any) => {
    req.user = { userId: 'user-uuid', orgId: 'org-uuid', role: 'owner' };
    next();
  },
  authorize: (...roles: string[]) => (req: any, res: any, next: any) => next(),
}));

jest.mock('../../db/client', () => ({
  default: { query: jest.fn() },
  __esModule: true,
}));

import request from 'supertest';
import app from '../../index';
import pool from '../../db/client';

const mockQuery = pool.query as jest.Mock;

describe('GET /visits', () => {
  beforeEach(() => jest.clearAllMocks());

  it('200 retourne la liste paginée', async () => {
    mockQuery
      .mockResolvedValueOnce({ rows: [{ total: 1 }] })
      .mockResolvedValueOnce({ rows: [{ id: 'v1', slug: 'my-visit' }] });

    const res = await request(app).get('/visits');
    expect(res.status).toBe(200);
    expect(res.body.visits).toHaveLength(1);
    expect(res.body.total).toBe(1);
  });
});

describe('POST /visits', () => {
  beforeEach(() => jest.clearAllMocks());

  it('201 crée une visite', async () => {
    mockQuery
      .mockResolvedValueOnce({ rows: [{ id: 'p1' }] })    // place check
      .mockResolvedValueOnce({ rows: [] })                  // slug unique
      .mockResolvedValueOnce({ rows: [{ id: 'v1', slug: 'p1abcdef-abc123', place_id: 'p1' }] });

    const res = await request(app).post('/visits').send({ place_id: 'p1' });
    expect(res.status).toBe(201);
    expect(res.body.id).toBe('v1');
  });

  it('400 PLACE_ID_REQUIRED si place_id absent', async () => {
    const res = await request(app).post('/visits').send({});
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('PLACE_ID_REQUIRED');
  });
});

describe('GET /visits/:id', () => {
  beforeEach(() => jest.clearAllMocks());

  it('200 retourne la visite', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [{ id: 'v1', slug: 'my-visit' }] });
    const res = await request(app).get('/visits/v1');
    expect(res.status).toBe(200);
    expect(res.body.id).toBe('v1');
  });

  it('404 VISIT_NOT_FOUND', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [] });
    const res = await request(app).get('/visits/unknown');
    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe('VISIT_NOT_FOUND');
  });
});

describe('PATCH /visits/:id', () => {
  beforeEach(() => jest.clearAllMocks());

  it('200 met à jour la visite', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [{ id: 'v1', scene_url: 'https://new.url' }] });
    const res = await request(app).patch('/visits/v1').send({ scene_url: 'https://new.url' });
    expect(res.status).toBe(200);
    expect(res.body.scene_url).toBe('https://new.url');
  });
});

describe('DELETE /visits/:id', () => {
  beforeEach(() => jest.clearAllMocks());

  it('204 supprime la visite', async () => {
    mockQuery.mockResolvedValueOnce({ rowCount: 1 });
    const res = await request(app).delete('/visits/v1');
    expect(res.status).toBe(204);
  });
});

describe('POST /visits/:id/publish', () => {
  beforeEach(() => jest.clearAllMocks());

  it('200 publie la visite', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [{ id: 'v1', publication_status: 'published' }] });
    const res = await request(app).post('/visits/v1/publish');
    expect(res.status).toBe(200);
    expect(res.body.publication_status).toBe('published');
  });
});

describe('POST /visits/:id/pause', () => {
  beforeEach(() => jest.clearAllMocks());

  it('200 met en pause la visite', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [{ id: 'v1', publication_status: 'paused' }] });
    const res = await request(app).post('/visits/v1/pause');
    expect(res.status).toBe(200);
    expect(res.body.publication_status).toBe('paused');
  });
});

describe('POST /visits/:id/unpublish', () => {
  beforeEach(() => jest.clearAllMocks());

  it('200 dépublie la visite', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [{ id: 'v1', publication_status: 'draft' }] });
    const res = await request(app).post('/visits/v1/unpublish');
    expect(res.status).toBe(200);
    expect(res.body.publication_status).toBe('draft');
  });
});

describe('GET /v/:slug (public)', () => {
  beforeEach(() => jest.clearAllMocks());

  it('200 retourne la visite publiée', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [{ id: 'v1', slug: 'my-visit', publication_status: 'published' }] });
    const res = await request(app).get('/v/my-visit');
    expect(res.status).toBe(200);
    expect(res.body.id).toBe('v1');
  });

  it('404 si slug non publié', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [] });
    const res = await request(app).get('/v/draft-slug');
    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe('VISIT_NOT_FOUND');
  });
});
