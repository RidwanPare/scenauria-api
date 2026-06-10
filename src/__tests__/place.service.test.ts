jest.mock('../db/client', () => ({
  default: { query: jest.fn() },
  __esModule: true,
}));

import pool from '../db/client';
import { listPlaces, getPlace, createPlace } from '../services/place.service';

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
