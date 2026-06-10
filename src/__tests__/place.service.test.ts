jest.mock('../db/client', () => ({
  default: { query: jest.fn() },
  __esModule: true,
}));

import pool from '../db/client';
import { listPlaces, getPlace, createPlace, updatePlace, deletePlace, setPlaceStatus } from '../services/place.service';

const mockQuery = pool.query as jest.Mock;

describe('listPlaces', () => {
  beforeEach(() => jest.clearAllMocks());

  it('retourne les places paginées avec total', async () => {
    const fakePlaces = [
      { id: 'p1', name: 'Le Louvre', status: 'active', organization_id: 'org-uuid' },
    ];
    mockQuery
      .mockResolvedValueOnce({ rows: [{ total: 1 }] })
      .mockResolvedValueOnce({ rows: fakePlaces });

    const result = await listPlaces('org-uuid', {});
    expect(result.total).toBe(1);
    expect(result.places).toHaveLength(1);
    expect(result.places[0].name).toBe('Le Louvre');
    expect(result.page).toBe(1);
    expect(result.limit).toBe(20);
  });

  it('filtre par status si fourni', async () => {
    mockQuery
      .mockResolvedValueOnce({ rows: [{ total: 0 }] })
      .mockResolvedValueOnce({ rows: [] });

    const result = await listPlaces('org-uuid', { status: 'archived' });
    expect(result.total).toBe(0);
    expect(mockQuery).toHaveBeenNthCalledWith(
      1,
      expect.stringContaining('status'),
      expect.arrayContaining(['org-uuid', 'archived'])
    );
  });

  it('respecte la pagination (page + limit)', async () => {
    mockQuery
      .mockResolvedValueOnce({ rows: [{ total: 50 }] })
      .mockResolvedValueOnce({ rows: [] });

    const result = await listPlaces('org-uuid', { page: 3, limit: 10 });
    expect(result.page).toBe(3);
    expect(result.limit).toBe(10);
    expect(mockQuery).toHaveBeenNthCalledWith(
      2,
      expect.stringContaining('LIMIT'),
      expect.arrayContaining([10, 20])
    );
  });

  it('plafonne limit à 100', async () => {
    mockQuery
      .mockResolvedValueOnce({ rows: [{ total: 0 }] })
      .mockResolvedValueOnce({ rows: [] });

    const result = await listPlaces('org-uuid', { limit: 999 });
    expect(result.limit).toBe(100);
  });
});

describe('getPlace', () => {
  beforeEach(() => jest.clearAllMocks());

  it('retourne la place si elle appartient à l org', async () => {
    const fakePlace = { id: 'p1', name: 'Château', organization_id: 'org-uuid' };
    mockQuery.mockResolvedValueOnce({ rows: [fakePlace] });

    const result = await getPlace('org-uuid', 'p1');
    expect(result.id).toBe('p1');
    expect(result.name).toBe('Château');
  });

  it('lève 404 PLACE_NOT_FOUND si inexistante ou hors org', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [] });
    await expect(getPlace('org-uuid', 'unknown')).rejects.toMatchObject({
      statusCode: 404,
      code: 'PLACE_NOT_FOUND',
    });
  });
});

describe('createPlace', () => {
  beforeEach(() => jest.clearAllMocks());

  it('crée une place et la retourne', async () => {
    const fakePlace = { id: 'p1', name: 'Abbaye', organization_id: 'org-uuid', status: 'active' };
    mockQuery.mockResolvedValueOnce({ rows: [fakePlace] });

    const result = await createPlace('org-uuid', { name: 'Abbaye' });
    expect(result.id).toBe('p1');
    expect(result.name).toBe('Abbaye');
    expect(mockQuery).toHaveBeenCalledWith(
      expect.stringContaining('INSERT INTO places'),
      expect.any(Array)
    );
  });

  it('lève 400 NAME_REQUIRED si name absent', async () => {
    await expect(createPlace('org-uuid', { name: '' })).rejects.toMatchObject({
      statusCode: 400,
      code: 'NAME_REQUIRED',
    });
  });

  it('lève 400 NAME_REQUIRED si name uniquement des espaces', async () => {
    await expect(createPlace('org-uuid', { name: '   ' })).rejects.toMatchObject({
      statusCode: 400,
      code: 'NAME_REQUIRED',
    });
  });
});

describe('updatePlace', () => {
  beforeEach(() => jest.clearAllMocks());

  it('met à jour les champs fournis et retourne la place', async () => {
    const updated = { id: 'p1', name: 'New Name', status: 'active', organization_id: 'org-uuid' };
    mockQuery.mockResolvedValueOnce({ rows: [updated] });

    const result = await updatePlace('org-uuid', 'p1', { name: 'New Name' });
    expect(result.name).toBe('New Name');
    expect(mockQuery).toHaveBeenCalledWith(
      expect.stringContaining('UPDATE places'),
      expect.any(Array)
    );
  });

  it('lève 400 NAME_REQUIRED si name vide', async () => {
    await expect(updatePlace('org-uuid', 'p1', { name: '' })).rejects.toMatchObject({
      statusCode: 400,
      code: 'NAME_REQUIRED',
    });
  });

  it('lève 404 PLACE_NOT_FOUND si place inexistante', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [] });
    await expect(updatePlace('org-uuid', 'unknown', { city: 'Paris' })).rejects.toMatchObject({
      statusCode: 404,
      code: 'PLACE_NOT_FOUND',
    });
  });

  it('retourne la place sans UPDATE si aucun champ fourni', async () => {
    const fakePlace = { id: 'p1', name: 'Abbaye', organization_id: 'org-uuid', status: 'active' };
    mockQuery.mockResolvedValueOnce({ rows: [fakePlace] });

    const result = await updatePlace('org-uuid', 'p1', {});
    expect(result.name).toBe('Abbaye');
    expect(mockQuery).not.toHaveBeenCalledWith(
      expect.stringContaining('UPDATE'),
      expect.any(Array)
    );
  });
});

describe('deletePlace', () => {
  beforeEach(() => jest.clearAllMocks());

  it('supprime une place sans visites publiées', async () => {
    mockQuery
      .mockResolvedValueOnce({ rows: [{ count: 0 }] })
      .mockResolvedValueOnce({});

    await expect(deletePlace('org-uuid', 'p1')).resolves.toBeUndefined();
    expect(mockQuery).toHaveBeenCalledWith(
      expect.stringContaining('DELETE FROM places'),
      expect.any(Array)
    );
  });

  it('lève 409 PLACE_HAS_ACTIVE_VISITS si des visites sont publiées', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [{ count: 2 }] });

    await expect(deletePlace('org-uuid', 'p1')).rejects.toMatchObject({
      statusCode: 409,
      code: 'PLACE_HAS_ACTIVE_VISITS',
    });
  });
});

describe('setPlaceStatus', () => {
  beforeEach(() => jest.clearAllMocks());

  it('archive une place (status → archived)', async () => {
    const archived = { id: 'p1', status: 'archived', organization_id: 'org-uuid' };
    mockQuery.mockResolvedValueOnce({ rows: [archived] });

    const result = await setPlaceStatus('org-uuid', 'p1', 'archived');
    expect(result.status).toBe('archived');
    expect(mockQuery).toHaveBeenCalledWith(
      expect.stringContaining('UPDATE places SET status'),
      expect.arrayContaining(['archived', 'p1', 'org-uuid'])
    );
  });

  it('restaure une place (status → active)', async () => {
    const active = { id: 'p1', status: 'active', organization_id: 'org-uuid' };
    mockQuery.mockResolvedValueOnce({ rows: [active] });

    const result = await setPlaceStatus('org-uuid', 'p1', 'active');
    expect(result.status).toBe('active');
  });

  it('lève 404 PLACE_NOT_FOUND si place inexistante', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [] });
    await expect(setPlaceStatus('org-uuid', 'unknown', 'archived')).rejects.toMatchObject({
      statusCode: 404,
      code: 'PLACE_NOT_FOUND',
    });
  });
});
