jest.mock('../db/client', () => ({
  default: { query: jest.fn() },
  __esModule: true,
}));

import pool from '../db/client';
import { listVisits, getVisit, getVisitBySlug, getVisitsByPlace } from '../services/visit.service';

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
