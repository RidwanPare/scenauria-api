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

import { listMembers, changeMemberRole, removeMember } from '../services/organization.service';

describe('listMembers', () => {
  beforeEach(() => jest.clearAllMocks());

  it('retourne la liste des membres avec infos user', async () => {
    const fakeMembers = [
      {
        id: 'member-uuid',
        user_id: 'user-uuid',
        email: 'alice@example.com',
        first_name: 'Alice',
        last_name: 'Dupont',
        avatar_url: null,
        role: 'owner',
        joined_at: new Date(),
      },
    ];
    mockQuery.mockResolvedValueOnce({ rows: fakeMembers });

    const result = await listMembers('org-uuid');
    expect(result.members).toHaveLength(1);
    expect(result.members[0].email).toBe('alice@example.com');
    expect(result.members[0].role).toBe('owner');
  });
});

describe('changeMemberRole', () => {
  beforeEach(() => jest.clearAllMocks());

  it('met à jour le rôle d un membre non-owner', async () => {
    const fakeMember = { id: 'member-uuid', user_id: 'target-uuid', role: 'editor' };
    mockQuery.mockResolvedValueOnce({ rows: [fakeMember] });
    mockQuery.mockResolvedValueOnce({ rows: [{ owner_id: 'owner-uuid' }] });
    mockQuery.mockResolvedValueOnce({ rows: [{ user_id: 'target-uuid', role: 'admin' }] });

    const result = await changeMemberRole('org-uuid', 'target-uuid', 'admin');
    expect(result.role).toBe('admin');
  });

  it('lève 400 INVALID_ROLE si rôle invalide', async () => {
    await expect(changeMemberRole('org-uuid', 'target-uuid', 'owner')).rejects.toMatchObject({
      statusCode: 400,
      code: 'INVALID_ROLE',
    });
  });

  it('lève 404 MEMBER_NOT_FOUND si userId non membre', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [] });
    await expect(changeMemberRole('org-uuid', 'unknown-uuid', 'admin')).rejects.toMatchObject({
      statusCode: 404,
      code: 'MEMBER_NOT_FOUND',
    });
  });

  it('lève 403 CANNOT_CHANGE_OWNER_ROLE si target est l owner', async () => {
    const fakeMember = { id: 'member-uuid', user_id: 'owner-uuid', role: 'owner' };
    mockQuery.mockResolvedValueOnce({ rows: [fakeMember] });
    mockQuery.mockResolvedValueOnce({ rows: [{ owner_id: 'owner-uuid' }] });

    await expect(changeMemberRole('org-uuid', 'owner-uuid', 'admin')).rejects.toMatchObject({
      statusCode: 403,
      code: 'CANNOT_CHANGE_OWNER_ROLE',
    });
  });
});

describe('removeMember', () => {
  beforeEach(() => jest.clearAllMocks());

  it('supprime un membre non-owner', async () => {
    const fakeMember = { id: 'member-uuid', user_id: 'target-uuid', role: 'editor' };
    mockQuery.mockResolvedValueOnce({ rows: [fakeMember] });
    mockQuery.mockResolvedValueOnce({ rows: [{ owner_id: 'owner-uuid' }] });
    mockQuery.mockResolvedValueOnce({});

    await expect(removeMember('org-uuid', 'target-uuid')).resolves.toBeUndefined();
    expect(mockQuery).toHaveBeenCalledWith(
      expect.stringContaining('DELETE FROM organization_members'),
      expect.any(Array)
    );
  });

  it('lève 404 MEMBER_NOT_FOUND si userId non membre', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [] });
    await expect(removeMember('org-uuid', 'unknown-uuid')).rejects.toMatchObject({
      statusCode: 404,
      code: 'MEMBER_NOT_FOUND',
    });
  });

  it('lève 403 CANNOT_REMOVE_OWNER si target est l owner', async () => {
    const fakeMember = { id: 'member-uuid', user_id: 'owner-uuid', role: 'owner' };
    mockQuery.mockResolvedValueOnce({ rows: [fakeMember] });
    mockQuery.mockResolvedValueOnce({ rows: [{ owner_id: 'owner-uuid' }] });

    await expect(removeMember('org-uuid', 'owner-uuid')).rejects.toMatchObject({
      statusCode: 403,
      code: 'CANNOT_REMOVE_OWNER',
    });
  });
});
