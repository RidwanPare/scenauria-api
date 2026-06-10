jest.mock('../../services/organization.service', () => ({
  getProfile: jest.fn(),
  updateProfile: jest.fn(),
  listMembers: jest.fn(),
  changeMemberRole: jest.fn(),
  removeMember: jest.fn(),
  getPlanInfo: jest.fn(),
}));

jest.mock('../../services/token.service', () => ({
  verifyAccessToken: jest.fn(),
}));

import request from 'supertest';
import app from '../../index';
import * as orgService from '../../services/organization.service';
import { verifyAccessToken } from '../../services/token.service';

const fakeUser = { userId: 'user-uuid', orgId: 'org-uuid', role: 'owner' };
const AUTH_HEADER = 'Bearer faketoken';

beforeEach(() => {
  jest.clearAllMocks();
  (verifyAccessToken as jest.Mock).mockReturnValue(fakeUser);
});

describe('GET /organizations/me', () => {
  it('retourne 200 avec le profil', async () => {
    (orgService.getProfile as jest.Mock).mockResolvedValueOnce({
      id: 'org-uuid', name: 'Acme', plan: 'start', subscription_status: 'inactive',
    });

    const res = await request(app)
      .get('/organizations/me')
      .set('Authorization', AUTH_HEADER);

    expect(res.status).toBe(200);
    expect(res.body.id).toBe('org-uuid');
  });

  it('retourne 401 sans token', async () => {
    const res = await request(app).get('/organizations/me');
    expect(res.status).toBe(401);
  });
});

describe('PATCH /organizations/me', () => {
  it('retourne 200 avec le profil mis à jour', async () => {
    (orgService.updateProfile as jest.Mock).mockResolvedValueOnce({
      id: 'org-uuid', name: 'New Name',
    });

    const res = await request(app)
      .patch('/organizations/me')
      .set('Authorization', AUTH_HEADER)
      .send({ name: 'New Name' });

    expect(res.status).toBe(200);
    expect(res.body.name).toBe('New Name');
  });

  it('retourne 403 si rôle insuffisant (viewer)', async () => {
    (verifyAccessToken as jest.Mock).mockReturnValue({ ...fakeUser, role: 'viewer' });

    const res = await request(app)
      .patch('/organizations/me')
      .set('Authorization', AUTH_HEADER)
      .send({ name: 'X' });

    expect(res.status).toBe(403);
  });
});

describe('GET /organizations/me/members', () => {
  it('retourne 200 avec la liste des membres', async () => {
    (orgService.listMembers as jest.Mock).mockResolvedValueOnce({
      members: [{ user_id: 'u1', email: 'a@b.com', role: 'owner', joined_at: new Date() }],
    });

    const res = await request(app)
      .get('/organizations/me/members')
      .set('Authorization', AUTH_HEADER);

    expect(res.status).toBe(200);
    expect(res.body.members).toHaveLength(1);
  });
});

describe('PATCH /organizations/me/members/:userId', () => {
  it('retourne 200 avec le nouveau rôle', async () => {
    (orgService.changeMemberRole as jest.Mock).mockResolvedValueOnce({
      user_id: 'target-uuid', role: 'admin',
    });

    const res = await request(app)
      .patch('/organizations/me/members/target-uuid')
      .set('Authorization', AUTH_HEADER)
      .send({ role: 'admin' });

    expect(res.status).toBe(200);
    expect(res.body.role).toBe('admin');
  });

  it('retourne 400 si role manquant', async () => {
    const res = await request(app)
      .patch('/organizations/me/members/target-uuid')
      .set('Authorization', AUTH_HEADER)
      .send({});

    expect(res.status).toBe(400);
  });

  it('retourne 403 si rôle insuffisant (non-owner)', async () => {
    (verifyAccessToken as jest.Mock).mockReturnValue({ ...fakeUser, role: 'admin' });

    const res = await request(app)
      .patch('/organizations/me/members/target-uuid')
      .set('Authorization', AUTH_HEADER)
      .send({ role: 'editor' });

    expect(res.status).toBe(403);
  });
});

describe('DELETE /organizations/me/members/:userId', () => {
  it('retourne 204', async () => {
    (orgService.removeMember as jest.Mock).mockResolvedValueOnce(undefined);

    const res = await request(app)
      .delete('/organizations/me/members/target-uuid')
      .set('Authorization', AUTH_HEADER);

    expect(res.status).toBe(204);
  });
});

describe('GET /organizations/me/plan', () => {
  it('retourne 200 avec plan et usage', async () => {
    (orgService.getPlanInfo as jest.Mock).mockResolvedValueOnce({
      plan: 'start',
      subscription_status: 'inactive',
      billing_interval: null,
      current_period_end: null,
      usage: { places_count: 0, published_visits_count: 0, active_captures_count: 0, members_count: 1 },
    });

    const res = await request(app)
      .get('/organizations/me/plan')
      .set('Authorization', AUTH_HEADER);

    expect(res.status).toBe(200);
    expect(res.body.plan).toBe('start');
    expect(res.body.usage.members_count).toBe(1);
  });
});
