jest.mock('../../services/place.service', () => ({
  listPlaces: jest.fn(),
  getPlace: jest.fn(),
  createPlace: jest.fn(),
  updatePlace: jest.fn(),
  deletePlace: jest.fn(),
  setPlaceStatus: jest.fn(),
}));

jest.mock('../../services/token.service', () => ({
  verifyAccessToken: jest.fn(),
}));

import request from 'supertest';
import app from '../../index';
import * as placeService from '../../services/place.service';
import { verifyAccessToken } from '../../services/token.service';

const fakeUser = { userId: 'user-uuid', orgId: 'org-uuid', role: 'owner' };
const AUTH_HEADER = 'Bearer faketoken';

beforeEach(() => {
  jest.clearAllMocks();
  (verifyAccessToken as jest.Mock).mockReturnValue(fakeUser);
});

describe('GET /places', () => {
  it('retourne 200 avec la liste paginée', async () => {
    (placeService.listPlaces as jest.Mock).mockResolvedValueOnce({
      places: [{ id: 'p1', name: 'Château', status: 'active' }],
      total: 1, page: 1, limit: 20,
    });

    const res = await request(app)
      .get('/places')
      .set('Authorization', AUTH_HEADER);

    expect(res.status).toBe(200);
    expect(res.body.places).toHaveLength(1);
    expect(res.body.total).toBe(1);
  });

  it('retourne 401 sans token', async () => {
    const res = await request(app).get('/places');
    expect(res.status).toBe(401);
  });
});

describe('POST /places', () => {
  it('retourne 201 avec la place créée', async () => {
    (placeService.createPlace as jest.Mock).mockResolvedValueOnce({
      id: 'p1', name: 'Abbaye', status: 'active',
    });

    const res = await request(app)
      .post('/places')
      .set('Authorization', AUTH_HEADER)
      .send({ name: 'Abbaye' });

    expect(res.status).toBe(201);
    expect(res.body.id).toBe('p1');
  });

  it('retourne 403 si rôle viewer', async () => {
    (verifyAccessToken as jest.Mock).mockReturnValue({ ...fakeUser, role: 'viewer' });

    const res = await request(app)
      .post('/places')
      .set('Authorization', AUTH_HEADER)
      .send({ name: 'X' });

    expect(res.status).toBe(403);
  });
});

describe('GET /places/:id', () => {
  it('retourne 200 avec la place', async () => {
    (placeService.getPlace as jest.Mock).mockResolvedValueOnce({
      id: 'p1', name: 'Musée', organization_id: 'org-uuid',
    });

    const res = await request(app)
      .get('/places/p1')
      .set('Authorization', AUTH_HEADER);

    expect(res.status).toBe(200);
    expect(res.body.id).toBe('p1');
  });
});

describe('PATCH /places/:id', () => {
  it('retourne 200 avec la place mise à jour', async () => {
    (placeService.updatePlace as jest.Mock).mockResolvedValueOnce({
      id: 'p1', name: 'New Name',
    });

    const res = await request(app)
      .patch('/places/p1')
      .set('Authorization', AUTH_HEADER)
      .send({ name: 'New Name' });

    expect(res.status).toBe(200);
    expect(res.body.name).toBe('New Name');
  });

  it('retourne 403 si rôle viewer', async () => {
    (verifyAccessToken as jest.Mock).mockReturnValue({ ...fakeUser, role: 'viewer' });

    const res = await request(app)
      .patch('/places/p1')
      .set('Authorization', AUTH_HEADER)
      .send({ name: 'X' });

    expect(res.status).toBe(403);
  });
});

describe('DELETE /places/:id', () => {
  it('retourne 204', async () => {
    (placeService.deletePlace as jest.Mock).mockResolvedValueOnce(undefined);

    const res = await request(app)
      .delete('/places/p1')
      .set('Authorization', AUTH_HEADER);

    expect(res.status).toBe(204);
  });

  it('retourne 403 si rôle editor', async () => {
    (verifyAccessToken as jest.Mock).mockReturnValue({ ...fakeUser, role: 'editor' });

    const res = await request(app)
      .delete('/places/p1')
      .set('Authorization', AUTH_HEADER);

    expect(res.status).toBe(403);
  });
});

describe('POST /places/:id/archive', () => {
  it('retourne 200 avec status archived', async () => {
    (placeService.setPlaceStatus as jest.Mock).mockResolvedValueOnce({
      id: 'p1', status: 'archived',
    });

    const res = await request(app)
      .post('/places/p1/archive')
      .set('Authorization', AUTH_HEADER);

    expect(res.status).toBe(200);
    expect(res.body.status).toBe('archived');
  });
});

describe('POST /places/:id/restore', () => {
  it('retourne 200 avec status active', async () => {
    (placeService.setPlaceStatus as jest.Mock).mockResolvedValueOnce({
      id: 'p1', status: 'active',
    });

    const res = await request(app)
      .post('/places/p1/restore')
      .set('Authorization', AUTH_HEADER);

    expect(res.status).toBe(200);
    expect(res.body.status).toBe('active');
  });
});
