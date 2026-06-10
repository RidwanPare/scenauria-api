jest.mock('../../middleware/auth', () => ({
  authenticate: (req: any, res: any, next: any) => {
    req.user = { userId: 'u1', orgId: 'org-uuid', role: 'owner' };
    next();
  },
  authorize: (...roles: string[]) => (req: any, res: any, next: any) => next(),
}));

jest.mock('../../db/client', () => ({ default: { query: jest.fn() }, __esModule: true }));

import request from 'supertest';
import app from '../../index';
import pool from '../../db/client';

const mockQuery = pool.query as jest.Mock;

describe('GET /surveys', () => {
  beforeEach(() => jest.clearAllMocks());

  it('200 liste les surveys', async () => {
    mockQuery
      .mockResolvedValueOnce({ rows: [{ total: 1 }] })
      .mockResolvedValueOnce({ rows: [{ id: 's1', title: 'Feedback' }] });
    const res = await request(app).get('/surveys');
    expect(res.status).toBe(200);
    expect(res.body.surveys).toHaveLength(1);
  });
});

describe('POST /surveys', () => {
  beforeEach(() => jest.clearAllMocks());

  it('201 crée un survey', async () => {
    mockQuery
      .mockResolvedValueOnce({ rows: [{ id: 'v1' }] })
      .mockResolvedValueOnce({ rows: [{ id: 's1', title: 'Feedback', visit_id: 'v1' }] });
    const res = await request(app).post('/surveys').send({ visit_id: 'v1', title: 'Feedback' });
    expect(res.status).toBe(201);
  });

  it('400 VISIT_ID_REQUIRED', async () => {
    const res = await request(app).post('/surveys').send({ title: 'X' });
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VISIT_ID_REQUIRED');
  });
});

describe('GET /surveys/:id', () => {
  beforeEach(() => jest.clearAllMocks());

  it('200 retourne le survey avec questions', async () => {
    mockQuery
      .mockResolvedValueOnce({ rows: [{ id: 's1', title: 'Feedback' }] })
      .mockResolvedValueOnce({ rows: [] });
    const res = await request(app).get('/surveys/s1');
    expect(res.status).toBe(200);
    expect(res.body.id).toBe('s1');
  });

  it('404 SURVEY_NOT_FOUND', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [] });
    const res = await request(app).get('/surveys/unknown');
    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe('SURVEY_NOT_FOUND');
  });
});

describe('DELETE /surveys/:id', () => {
  beforeEach(() => jest.clearAllMocks());

  it('204 supprime', async () => {
    mockQuery.mockResolvedValueOnce({ rowCount: 1 });
    const res = await request(app).delete('/surveys/s1');
    expect(res.status).toBe(204);
  });
});

describe('POST /surveys/:id/questions', () => {
  beforeEach(() => jest.clearAllMocks());

  it('201 ajoute une question', async () => {
    mockQuery
      .mockResolvedValueOnce({ rows: [{ id: 's1' }] })
      .mockResolvedValueOnce({ rows: [{ id: 'q1', label: 'Comment?' }] });
    const res = await request(app).post('/surveys/s1/questions').send({ label: 'Comment?', type: 'text' });
    expect(res.status).toBe(201);
  });
});

describe('POST /surveys/:id/responses (public)', () => {
  beforeEach(() => jest.clearAllMocks());

  it('201 soumet une réponse', async () => {
    mockQuery
      .mockResolvedValueOnce({ rows: [{ id: 's1', status: 'active' }] })
      .mockResolvedValueOnce({ rows: [{ id: 'r1' }] });
    const res = await request(app).post('/surveys/s1/responses').send({ visit_id: 'v1', answers: {} });
    expect(res.status).toBe(201);
  });
});
