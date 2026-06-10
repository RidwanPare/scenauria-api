jest.mock('../db/client', () => ({
  default: { query: jest.fn() },
  __esModule: true,
}));

import pool from '../db/client';
import { getProfile, updateProfile } from '../services/organization.service';

const mockQuery = pool.query as jest.Mock;

describe('getProfile', () => {
  beforeEach(() => jest.clearAllMocks());

  it('retourne le profil de l organisation', async () => {
    const fakeOrg = {
      id: 'org-uuid',
      name: 'Acme',
      business_type: 'hotel',
      country: 'FR',
      currency: 'EUR',
      plan: 'start',
      subscription_status: 'inactive',
      owner_id: 'user-uuid',
      created_at: new Date(),
      updated_at: new Date(),
    };
    mockQuery.mockResolvedValueOnce({ rows: [fakeOrg] });

    const result = await getProfile('org-uuid');
    expect(result.id).toBe('org-uuid');
    expect(result.name).toBe('Acme');
    expect((result as any).stripe_customer_id).toBeUndefined();
  });

  it('lève 404 ORG_NOT_FOUND si organisation inconnue', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [] });
    await expect(getProfile('unknown-uuid')).rejects.toMatchObject({
      statusCode: 404,
      code: 'ORG_NOT_FOUND',
    });
  });
});

describe('updateProfile', () => {
  beforeEach(() => jest.clearAllMocks());

  it('met à jour le profil et retourne l organisation mise à jour', async () => {
    const updatedOrg = {
      id: 'org-uuid',
      name: 'New Name',
      business_type: 'restaurant',
      country: 'FR',
      currency: 'EUR',
      plan: 'start',
      subscription_status: 'inactive',
      owner_id: 'user-uuid',
      created_at: new Date(),
      updated_at: new Date(),
    };
    mockQuery.mockResolvedValueOnce({ rows: [updatedOrg] });

    const result = await updateProfile('org-uuid', { name: 'New Name', business_type: 'restaurant' });
    expect(result.name).toBe('New Name');
    expect(mockQuery).toHaveBeenCalledWith(
      expect.stringContaining('UPDATE organizations'),
      expect.any(Array)
    );
  });

  it('lève 400 NAME_REQUIRED si name est une chaîne vide', async () => {
    await expect(updateProfile('org-uuid', { name: '' })).rejects.toMatchObject({
      statusCode: 400,
      code: 'NAME_REQUIRED',
    });
  });

  it('lève 400 INVALID_CURRENCY si currency hors liste', async () => {
    await expect(updateProfile('org-uuid', { currency: 'BTC' })).rejects.toMatchObject({
      statusCode: 400,
      code: 'INVALID_CURRENCY',
    });
  });

  it('retourne le profil sans UPDATE si aucun champ fourni', async () => {
    const fakeOrg = {
      id: 'org-uuid',
      name: 'Acme',
      business_type: null,
      country: 'FR',
      currency: 'EUR',
      plan: 'start',
      subscription_status: 'inactive',
      owner_id: 'user-uuid',
      created_at: new Date(),
      updated_at: new Date(),
    };
    // getProfile is called internally when no fields to update
    mockQuery.mockResolvedValueOnce({ rows: [fakeOrg] });

    const result = await updateProfile('org-uuid', {});
    expect(result.name).toBe('Acme');
    // Verify no UPDATE was called, only SELECT from getProfile
    expect(mockQuery).toHaveBeenCalledWith(
      expect.stringContaining('SELECT'),
      expect.any(Array)
    );
    expect(mockQuery).not.toHaveBeenCalledWith(
      expect.stringContaining('UPDATE'),
      expect.any(Array)
    );
  });

  it('lève 404 ORG_NOT_FOUND si l org n existe pas lors de l update', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [] }); // UPDATE retourne 0 lignes
    await expect(updateProfile('nonexistent-uuid', { name: 'X' })).rejects.toMatchObject({
      statusCode: 404,
      code: 'ORG_NOT_FOUND',
    });
  });
});
