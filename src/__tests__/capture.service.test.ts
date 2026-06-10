jest.mock('../db/client', () => ({
  default: { query: jest.fn() },
  __esModule: true,
}));

import pool from '../db/client';
import { listCaptures, getCapturesByPlace, getCapture } from '../services/capture.service';

const mockQuery = pool.query as jest.Mock;

describe('listCaptures', () => {
  beforeEach(() => jest.clearAllMocks());

  it('retourne les captures paginées avec total', async () => {
    const fakeCaptures = [{ id: 'c1', place_id: 'p1', status: 'draft' }];
    mockQuery
      .mockResolvedValueOnce({ rows: [{ total: 1 }] })
      .mockResolvedValueOnce({ rows: fakeCaptures });

    const result = await listCaptures('org-uuid', {});
    expect(result.total).toBe(1);
    expect(result.captures).toHaveLength(1);
    expect(result.page).toBe(1);
    expect(result.limit).toBe(20);
  });

  it('filtre par status si fourni', async () => {
    mockQuery
      .mockResolvedValueOnce({ rows: [{ total: 0 }] })
      .mockResolvedValueOnce({ rows: [] });

    await listCaptures('org-uuid', { status: 'ready' });
    expect(mockQuery).toHaveBeenNthCalledWith(
      1,
      expect.stringContaining('status'),
      expect.arrayContaining(['org-uuid', 'ready'])
    );
  });

  it('filtre par place_id si fourni', async () => {
    mockQuery
      .mockResolvedValueOnce({ rows: [{ total: 0 }] })
      .mockResolvedValueOnce({ rows: [] });

    await listCaptures('org-uuid', { place_id: 'p1' });
    expect(mockQuery).toHaveBeenNthCalledWith(
      1,
      expect.stringContaining('place_id'),
      expect.arrayContaining(['org-uuid', 'p1'])
    );
  });

  it('plafonne limit à 100', async () => {
    mockQuery
      .mockResolvedValueOnce({ rows: [{ total: 0 }] })
      .mockResolvedValueOnce({ rows: [] });

    const result = await listCaptures('org-uuid', { limit: 999 });
    expect(result.limit).toBe(100);
  });
});

describe('getCapturesByPlace', () => {
  beforeEach(() => jest.clearAllMocks());

  it('retourne les captures d une place appartenant à l org', async () => {
    const fakePlace = { id: 'p1', organization_id: 'org-uuid' };
    const fakeCaptures = [{ id: 'c1', place_id: 'p1' }];
    mockQuery
      .mockResolvedValueOnce({ rows: [fakePlace] })
      .mockResolvedValueOnce({ rows: fakeCaptures });

    const result = await getCapturesByPlace('org-uuid', 'p1');
    expect(result.captures).toHaveLength(1);
  });

  it('lève 404 PLACE_NOT_FOUND si place hors org', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [] });
    await expect(getCapturesByPlace('org-uuid', 'alien-place')).rejects.toMatchObject({
      statusCode: 404,
      code: 'PLACE_NOT_FOUND',
    });
  });
});

describe('getCapture', () => {
  beforeEach(() => jest.clearAllMocks());

  it('retourne la capture si elle appartient à l org', async () => {
    const fakeCapture = { id: 'c1', place_id: 'p1', organization_id: 'org-uuid' };
    mockQuery.mockResolvedValueOnce({ rows: [fakeCapture] });

    const result = await getCapture('org-uuid', 'c1');
    expect(result.id).toBe('c1');
  });

  it('lève 404 CAPTURE_NOT_FOUND si inexistante', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [] });
    await expect(getCapture('org-uuid', 'unknown')).rejects.toMatchObject({
      statusCode: 404,
      code: 'CAPTURE_NOT_FOUND',
    });
  });
});
