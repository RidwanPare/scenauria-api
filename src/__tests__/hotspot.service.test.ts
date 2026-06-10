jest.mock('../db/client', () => ({
  default: { query: jest.fn() },
  __esModule: true,
}));

import pool from '../db/client';
import {
  listHotspots,
  getHotspot,
  getHotspotsByVisit,
  createHotspot,
  updateHotspot,
  deleteHotspot,
} from '../services/hotspot.service';

const mockQuery = pool.query as jest.Mock;

describe('listHotspots', () => {
  beforeEach(() => jest.clearAllMocks());

  it('retourne les hotspots paginés', async () => {
    mockQuery
      .mockResolvedValueOnce({ rows: [{ total: 2 }] })
      .mockResolvedValueOnce({ rows: [{ id: 'h1' }, { id: 'h2' }] });

    const result = await listHotspots('org-uuid', {});
    expect(result.total).toBe(2);
    expect(result.hotspots).toHaveLength(2);
    expect(result.page).toBe(1);
    expect(result.limit).toBe(20);
  });

  it('plafonne limit à 100', async () => {
    mockQuery
      .mockResolvedValueOnce({ rows: [{ total: 0 }] })
      .mockResolvedValueOnce({ rows: [] });
    const result = await listHotspots('org-uuid', { limit: 999 });
    expect(result.limit).toBe(100);
  });

  it('filtre par visit_id', async () => {
    mockQuery
      .mockResolvedValueOnce({ rows: [{ total: 1 }] })
      .mockResolvedValueOnce({ rows: [{ id: 'h1' }] });
    const result = await listHotspots('org-uuid', { visit_id: 'v1' });
    expect(result.hotspots).toHaveLength(1);
  });
});

describe('getHotspot', () => {
  beforeEach(() => jest.clearAllMocks());

  it('retourne le hotspot', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [{ id: 'h1', title: 'Entrée' }] });
    const result = await getHotspot('org-uuid', 'h1');
    expect(result.id).toBe('h1');
    expect(result.title).toBe('Entrée');
  });

  it('lève 404 HOTSPOT_NOT_FOUND', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [] });
    await expect(getHotspot('org-uuid', 'unknown')).rejects.toMatchObject({
      statusCode: 404,
      code: 'HOTSPOT_NOT_FOUND',
    });
  });
});

describe('getHotspotsByVisit', () => {
  beforeEach(() => jest.clearAllMocks());

  it('retourne les hotspots d une visite', async () => {
    mockQuery
      .mockResolvedValueOnce({ rows: [{ id: 'v1' }] })
      .mockResolvedValueOnce({ rows: [{ id: 'h1' }] });
    const result = await getHotspotsByVisit('org-uuid', 'v1');
    expect(result.hotspots).toHaveLength(1);
  });

  it('lève 404 VISIT_NOT_FOUND si visite hors org', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [] });
    await expect(getHotspotsByVisit('org-uuid', 'alien')).rejects.toMatchObject({
      statusCode: 404,
      code: 'VISIT_NOT_FOUND',
    });
  });
});

describe('createHotspot', () => {
  beforeEach(() => jest.clearAllMocks());

  it('crée un hotspot', async () => {
    mockQuery
      .mockResolvedValueOnce({ rows: [{ id: 'v1' }] })
      .mockResolvedValueOnce({ rows: [{ id: 'h1', title: 'Panneau', type: 'info' }] });

    const result = await createHotspot('org-uuid', {
      visit_id: 'v1',
      title: 'Panneau',
      type: 'info',
    });
    expect(result.id).toBe('h1');
  });

  it('lève 404 VISIT_NOT_FOUND si visite hors org', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [] });
    await expect(
      createHotspot('org-uuid', { visit_id: 'alien', title: 'X', type: 'info' })
    ).rejects.toMatchObject({ statusCode: 404, code: 'VISIT_NOT_FOUND' });
  });
});

describe('updateHotspot', () => {
  beforeEach(() => jest.clearAllMocks());

  it('met à jour les champs fournis', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [{ id: 'h1', title: 'Nouveau titre' }] });
    const result = await updateHotspot('org-uuid', 'h1', { title: 'Nouveau titre' });
    expect(result.title).toBe('Nouveau titre');
  });

  it('lève 404 si inexistant', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [] });
    await expect(updateHotspot('org-uuid', 'unknown', { title: 'X' })).rejects.toMatchObject({
      statusCode: 404,
      code: 'HOTSPOT_NOT_FOUND',
    });
  });

  it('appelle getHotspot si aucun champ', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [{ id: 'h1', title: 'Existant' }] });
    const result = await updateHotspot('org-uuid', 'h1', {});
    expect(result.id).toBe('h1');
  });
});

describe('deleteHotspot', () => {
  beforeEach(() => jest.clearAllMocks());

  it('supprime le hotspot', async () => {
    mockQuery.mockResolvedValueOnce({ rowCount: 1 });
    await expect(deleteHotspot('org-uuid', 'h1')).resolves.toBeUndefined();
  });

  it('lève 404 si inexistant', async () => {
    mockQuery.mockResolvedValueOnce({ rowCount: 0 });
    await expect(deleteHotspot('org-uuid', 'unknown')).rejects.toMatchObject({
      statusCode: 404,
      code: 'HOTSPOT_NOT_FOUND',
    });
  });
});
