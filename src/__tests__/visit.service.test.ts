jest.mock('../db/client', () => ({
  default: { query: jest.fn() },
  __esModule: true,
}));

import pool from '../db/client';
import { listVisits, getVisit, getVisitBySlug, getVisitsByPlace, createVisit, updateVisit, deleteVisit, setPublicationStatus } from '../services/visit.service';

const mockQuery = pool.query as jest.Mock;

describe('listVisits', () => {
  beforeEach(() => jest.clearAllMocks());

  it('retourne les visites paginées avec total', async () => {
    mockQuery
      .mockResolvedValueOnce({ rows: [{ total: 2 }] })
      .mockResolvedValueOnce({ rows: [{ id: 'v1', slug: 'slug-1' }, { id: 'v2', slug: 'slug-2' }] });

    const result = await listVisits('org-uuid', {});
    expect(result.total).toBe(2);
    expect(result.visits).toHaveLength(2);
    expect(result.page).toBe(1);
    expect(result.limit).toBe(20);
  });

  it('filtre par publication_status', async () => {
    mockQuery
      .mockResolvedValueOnce({ rows: [{ total: 0 }] })
      .mockResolvedValueOnce({ rows: [] });

    await listVisits('org-uuid', { publication_status: 'published' });
    expect(mockQuery).toHaveBeenNthCalledWith(
      1,
      expect.stringContaining('publication_status'),
      expect.arrayContaining(['org-uuid', 'published'])
    );
  });

  it('plafonne limit à 100', async () => {
    mockQuery
      .mockResolvedValueOnce({ rows: [{ total: 0 }] })
      .mockResolvedValueOnce({ rows: [] });

    const result = await listVisits('org-uuid', { limit: 999 });
    expect(result.limit).toBe(100);
  });
});

describe('getVisit', () => {
  beforeEach(() => jest.clearAllMocks());

  it('retourne la visite appartenant à l org', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [{ id: 'v1', slug: 'my-visit' }] });
    const result = await getVisit('org-uuid', 'v1');
    expect(result.id).toBe('v1');
  });

  it('lève 404 VISIT_NOT_FOUND si inexistante', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [] });
    await expect(getVisit('org-uuid', 'unknown')).rejects.toMatchObject({
      statusCode: 404, code: 'VISIT_NOT_FOUND',
    });
  });
});

describe('getVisitBySlug', () => {
  beforeEach(() => jest.clearAllMocks());

  it('retourne la visite publiée par slug', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [{ id: 'v1', slug: 'my-visit', publication_status: 'published' }] });
    const result = await getVisitBySlug('my-visit');
    expect(result.id).toBe('v1');
  });

  it('lève 404 VISIT_NOT_FOUND si slug non publié', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [] });
    await expect(getVisitBySlug('draft-slug')).rejects.toMatchObject({
      statusCode: 404, code: 'VISIT_NOT_FOUND',
    });
  });
});

describe('getVisitsByPlace', () => {
  beforeEach(() => jest.clearAllMocks());

  it('retourne les visites d un lieu appartenant à l org', async () => {
    mockQuery
      .mockResolvedValueOnce({ rows: [{ id: 'p1' }] })
      .mockResolvedValueOnce({ rows: [{ id: 'v1', place_id: 'p1' }] });

    const result = await getVisitsByPlace('org-uuid', 'p1');
    expect(result.visits).toHaveLength(1);
  });

  it('lève 404 PLACE_NOT_FOUND si place hors org', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [] });
    await expect(getVisitsByPlace('org-uuid', 'alien')).rejects.toMatchObject({
      statusCode: 404, code: 'PLACE_NOT_FOUND',
    });
  });
});

describe('createVisit', () => {
  beforeEach(() => jest.clearAllMocks());

  it('crée une visite avec slug auto-généré', async () => {
    mockQuery
      .mockResolvedValueOnce({ rows: [{ id: 'p1', name: 'My Place' }] })
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [{ id: 'v1', slug: expect.any(String) }] });

    const result = await createVisit('org-uuid', { place_id: 'p1' });
    expect(result.id).toBe('v1');
    const insertCall = mockQuery.mock.calls[2];
    expect(insertCall[1]).toEqual(expect.arrayContaining(['p1']));
  });

  it('crée une visite avec slug fourni et unique', async () => {
    mockQuery
      .mockResolvedValueOnce({ rows: [{ id: 'p1' }] })
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [{ id: 'v1', slug: 'custom-slug' }] });

    const result = await createVisit('org-uuid', { place_id: 'p1', slug: 'custom-slug' });
    expect(result.id).toBe('v1');
  });

  it('lève 400 SLUG_TAKEN si slug déjà pris', async () => {
    mockQuery
      .mockResolvedValueOnce({ rows: [{ id: 'p1' }] })
      .mockResolvedValueOnce({ rows: [{ id: 'existing' }] });

    await expect(createVisit('org-uuid', { place_id: 'p1', slug: 'taken' })).rejects.toMatchObject({
      statusCode: 400, code: 'SLUG_TAKEN',
    });
  });

  it('lève 404 PLACE_NOT_FOUND si place hors org', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [] });

    await expect(createVisit('org-uuid', { place_id: 'alien' })).rejects.toMatchObject({
      statusCode: 404, code: 'PLACE_NOT_FOUND',
    });
  });
});

describe('updateVisit', () => {
  beforeEach(() => jest.clearAllMocks());

  it('met à jour les champs fournis', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [{ id: 'v1', scene_url: 'https://new.url' }] });

    const result = await updateVisit('org-uuid', 'v1', { scene_url: 'https://new.url' });
    expect(result.scene_url).toBe('https://new.url');
    const sql = mockQuery.mock.calls[0][0] as string;
    expect(sql).toContain('scene_url');
  });

  it('retourne la visite sans UPDATE si aucun champ', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [{ id: 'v1' }] });

    const result = await updateVisit('org-uuid', 'v1', {});
    expect(result.id).toBe('v1');
    expect(mockQuery).toHaveBeenCalledTimes(1);
  });

  it('lève 404 VISIT_NOT_FOUND si visite hors org', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [] });

    await expect(updateVisit('org-uuid', 'unknown', { scene_url: 'x' })).rejects.toMatchObject({
      statusCode: 404, code: 'VISIT_NOT_FOUND',
    });
  });
});

describe('deleteVisit', () => {
  beforeEach(() => jest.clearAllMocks());

  it('supprime la visite', async () => {
    mockQuery.mockResolvedValueOnce({ rowCount: 1 });
    await expect(deleteVisit('org-uuid', 'v1')).resolves.toBeUndefined();
  });

  it('lève 404 VISIT_NOT_FOUND si visite hors org', async () => {
    mockQuery.mockResolvedValueOnce({ rowCount: 0 });
    await expect(deleteVisit('org-uuid', 'unknown')).rejects.toMatchObject({
      statusCode: 404, code: 'VISIT_NOT_FOUND',
    });
  });
});

describe('setPublicationStatus', () => {
  beforeEach(() => jest.clearAllMocks());

  it('publie la visite (status → published)', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [{ id: 'v1', publication_status: 'published' }] });

    const result = await setPublicationStatus('org-uuid', 'v1', 'publish');
    expect(result.publication_status).toBe('published');
    const sql = mockQuery.mock.calls[0][0] as string;
    expect(sql).toContain('published_at');
  });

  it('met en pause la visite (status → paused)', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [{ id: 'v1', publication_status: 'paused' }] });

    const result = await setPublicationStatus('org-uuid', 'v1', 'pause');
    expect(result.publication_status).toBe('paused');
    const sql = mockQuery.mock.calls[0][0] as string;
    expect(sql).toContain('paused_at');
  });

  it('dépublie la visite (status → draft)', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [{ id: 'v1', publication_status: 'draft' }] });

    const result = await setPublicationStatus('org-uuid', 'v1', 'unpublish');
    expect(result.publication_status).toBe('draft');
  });

  it('lève 404 VISIT_NOT_FOUND si visite hors org', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [] });
    await expect(setPublicationStatus('org-uuid', 'unknown', 'publish')).rejects.toMatchObject({
      statusCode: 404, code: 'VISIT_NOT_FOUND',
    });
  });
});
