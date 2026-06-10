// Mock all services before importing app
jest.mock('../../services/auth.service', () => ({
  register: jest.fn(),
  login: jest.fn(),
  refreshTokens: jest.fn(),
  logout: jest.fn(),
  forgotPassword: jest.fn(),
  resetPassword: jest.fn(),
}));

jest.mock('../../services/google-oauth.service', () => ({
  getAuthorizationUrl: jest.fn().mockReturnValue('https://accounts.google.com/o/oauth2/auth?state=test'),
  handleGoogleCallback: jest.fn(),
}));

import request from 'supertest';
import app from '../../index';
import * as authService from '../../services/auth.service';
import * as googleService from '../../services/google-oauth.service';

describe('POST /auth/register', () => {
  beforeEach(() => jest.clearAllMocks());

  it('retourne 201 avec les tokens', async () => {
    (authService.register as jest.Mock).mockResolvedValueOnce({
      accessToken: 'access123',
      refreshToken: 'refresh123',
      user: { id: 'u1', email: 'test@example.com' },
    });

    const res = await request(app)
      .post('/auth/register')
      .send({ email: 'test@example.com', password: 'password123' });

    expect(res.status).toBe(201);
    expect(res.body.accessToken).toBe('access123');
  });

  it('retourne 400 si email invalide', async () => {
    const res = await request(app)
      .post('/auth/register')
      .send({ email: 'notanemail', password: 'password123' });
    expect(res.status).toBe(400);
  });

  it('retourne 400 si password trop court', async () => {
    const res = await request(app)
      .post('/auth/register')
      .send({ email: 'test@example.com', password: 'short' });
    expect(res.status).toBe(400);
  });
});

describe('POST /auth/login', () => {
  beforeEach(() => jest.clearAllMocks());

  it('retourne 200 avec les tokens', async () => {
    (authService.login as jest.Mock).mockResolvedValueOnce({
      accessToken: 'at',
      refreshToken: 'rt',
      user: { id: 'u1', email: 'test@example.com' },
    });

    const res = await request(app)
      .post('/auth/login')
      .send({ email: 'test@example.com', password: 'password123' });

    expect(res.status).toBe(200);
    expect(res.body.accessToken).toBe('at');
  });

  it('retourne 400 si email manquant', async () => {
    const res = await request(app)
      .post('/auth/login')
      .send({ password: 'password123' });
    expect(res.status).toBe(400);
  });
});

describe('POST /auth/refresh', () => {
  beforeEach(() => jest.clearAllMocks());

  it('retourne 200 avec nouveaux tokens', async () => {
    (authService.refreshTokens as jest.Mock).mockResolvedValueOnce({
      accessToken: 'new-at',
      refreshToken: 'new-rt',
    });

    const res = await request(app)
      .post('/auth/refresh')
      .send({ refreshToken: 'valid-token' });

    expect(res.status).toBe(200);
    expect(res.body.accessToken).toBe('new-at');
  });

  it('retourne 400 si refreshToken manquant', async () => {
    const res = await request(app).post('/auth/refresh').send({});
    expect(res.status).toBe(400);
  });
});

describe('POST /auth/logout', () => {
  beforeEach(() => jest.clearAllMocks());

  it('retourne 204', async () => {
    (authService.logout as jest.Mock).mockResolvedValueOnce(undefined);
    const res = await request(app)
      .post('/auth/logout')
      .send({ refreshToken: 'token' });
    expect(res.status).toBe(204);
  });
});

describe('POST /auth/forgot-password', () => {
  beforeEach(() => jest.clearAllMocks());

  it('retourne 200 avec message générique', async () => {
    (authService.forgotPassword as jest.Mock).mockResolvedValueOnce(undefined);
    const res = await request(app)
      .post('/auth/forgot-password')
      .send({ email: 'test@example.com' });
    expect(res.status).toBe(200);
    expect(res.body.message).toBeDefined();
  });
});

describe('GET /auth/google', () => {
  it('redirige vers Google (302)', async () => {
    const res = await request(app).get('/auth/google');
    expect(res.status).toBe(302);
    expect(res.headers.location).toContain('accounts.google.com');
  });
});
