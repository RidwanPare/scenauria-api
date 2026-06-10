jest.mock('../../services/capture.service', () => ({
  listCaptures: jest.fn(),
  getCapturesByPlace: jest.fn(),
  getCapture: jest.fn(),
  createCapture: jest.fn(),
  updateCapture: jest.fn(),
  deleteCapture: jest.fn(),
}));

jest.mock('../../services/token.service', () => ({
  verifyAccessToken: jest.fn(),
}));

import request from 'supertest';
import app from '../../index';
import * as captureService from '../../services/capture.service';
import { verifyAccessToken } from '../../services/token.service';

const fakeUser = { userId: 'user-uuid', orgId: 'org-uuid', role: 'owner' };
const AUTH_HEADER = 'Bearer faketoken';

beforeEach(() => {
  jest.clearAllMocks();
  (verifyAccessToken as jest.Mock).mockReturnValue(fakeUser);
});

describe('GET /captures', () => {
  it('retourne 200 avec la liste', async () => {
    (captureService.listCaptures as jest.Mock).mockResolvedValueOnce({
      captures: [{ id: 'c1', status: 'draft' }],
      total: 1, page: 1, limit: 20,
    });

    const res = await request(app).get('/captures').set('Authorization', AUTH_HEADER);
    expect(res.status).toBe(200);
    expect(res.body.captures).toHaveLength(1);
  });

  it('retourne 401 sans token', async () => {
    const res = await request(app).get('/captures');
    expect(res.status).toBe(401);
  });
});

describe('POST /captures', () => {
  it('retourne 201 avec la capture créée', async () => {
    (captureService.createCapture as jest.Mock).mockResolvedValueOnce({
      id: 'c1', place_id: 'p1', status: 'draft',
    });

    const res = await request(app)
      .post('/captures')
      .set('Authorization', AUTH_HEADER)
      .send({ place_id: 'p1' });

    expect(res.status).toBe(201);
    expect(res.body.id).toBe('c1');
  });

  it('retourne 400 si place_id manquant', async () => {
    const res = await request(app)
      .post('/captures')
      .set('Authorization', AUTH_HEADER)
      .send({});

    expect(res.status).toBe(400);
  });

  it('retourne 403 si rôle viewer', async () => {
    (verifyAccessToken as jest.Mock).mockReturnValue({ ...fakeUser, role: 'viewer' });
    const res = await request(app)
      .post('/captures')
      .set('Authorization', AUTH_HEADER)
      .send({ place_id: 'p1' });
    expect(res.status).toBe(403);
  });
});

describe('GET /captures/:id', () => {
  it('retourne 200 avec la capture', async () => {
    (captureService.getCapture as jest.Mock).mockResolvedValueOnce({
      id: 'c1', place_id: 'p1', status: 'draft',
    });

    const res = await request(app).get('/captures/c1').set('Authorization', AUTH_HEADER);
    expect(res.status).toBe(200);
    expect(res.body.id).toBe('c1');
  });
});

describe('PATCH /captures/:id', () => {
  it('retourne 200 avec la capture mise à jour', async () => {
    (captureService.updateCapture as jest.Mock).mockResolvedValueOnce({
      id: 'c1', video_url: 'https://cdn/video.mp4',
    });

    const res = await request(app)
      .patch('/captures/c1')
      .set('Authorization', AUTH_HEADER)
      .send({ video_url: 'https://cdn/video.mp4' });

    expect(res.status).toBe(200);
    expect(res.body.video_url).toBe('https://cdn/video.mp4');
  });

  it('retourne 403 si rôle viewer', async () => {
    (verifyAccessToken as jest.Mock).mockReturnValue({ ...fakeUser, role: 'viewer' });
    const res = await request(app)
      .patch('/captures/c1')
      .set('Authorization', AUTH_HEADER)
      .send({ resolution: '1080p' });
    expect(res.status).toBe(403);
  });
});

describe('DELETE /captures/:id', () => {
  it('retourne 204', async () => {
    (captureService.deleteCapture as jest.Mock).mockResolvedValueOnce(undefined);

    const res = await request(app)
      .delete('/captures/c1')
      .set('Authorization', AUTH_HEADER);

    expect(res.status).toBe(204);
  });

  it('retourne 403 si rôle editor', async () => {
    (verifyAccessToken as jest.Mock).mockReturnValue({ ...fakeUser, role: 'editor' });
    const res = await request(app)
      .delete('/captures/c1')
      .set('Authorization', AUTH_HEADER);
    expect(res.status).toBe(403);
  });
});

describe('GET /places/:placeId/captures', () => {
  it('retourne 200 avec les captures du lieu', async () => {
    (captureService.getCapturesByPlace as jest.Mock).mockResolvedValueOnce({
      captures: [{ id: 'c1', place_id: 'p1' }],
    });

    const res = await request(app)
      .get('/places/p1/captures')
      .set('Authorization', AUTH_HEADER);

    expect(res.status).toBe(200);
    expect(res.body.captures).toHaveLength(1);
  });
});
