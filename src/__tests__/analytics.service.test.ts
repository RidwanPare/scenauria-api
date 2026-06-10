jest.mock('../db/client', () => ({ default: { query: jest.fn() }, __esModule: true }));

import pool from '../db/client';
import { ingestEvent, listEvents, getSummary, getVisitStats } from '../services/analytics.service';

const mockQuery = pool.query as jest.Mock;

describe('ingestEvent', () => {
  beforeEach(() => jest.clearAllMocks());

  it('insère un événement', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [{ id: 'e1', event_type: 'visit_start' }] });
    const result = await ingestEvent({ visit_id: 'v1', place_id: 'p1', event_type: 'visit_start' });
    expect(result.event_type).toBe('visit_start');
  });
});

describe('listEvents', () => {
  beforeEach(() => jest.clearAllMocks());

  it('retourne les événements paginés', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [{ total: 5 }] }).mockResolvedValueOnce({ rows: [{ id: 'e1' }] });
    const result = await listEvents('org-uuid', {});
    expect(result.total).toBe(5);
    expect(result.events).toHaveLength(1);
  });

  it('plafonne limit à 100', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [{ total: 0 }] }).mockResolvedValueOnce({ rows: [] });
    const result = await listEvents('org-uuid', { limit: 999 });
    expect(result.limit).toBe(100);
  });

  it('filtre par event_type', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [{ total: 0 }] }).mockResolvedValueOnce({ rows: [] });
    await listEvents('org-uuid', { event_type: 'visit_start' });
    expect(mockQuery.mock.calls[0][0]).toContain('event_type');
  });
});

describe('getSummary', () => {
  beforeEach(() => jest.clearAllMocks());

  it('retourne le résumé par event_type', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [{ event_type: 'visit_start', count: 42 }] });
    const result = await getSummary('org-uuid');
    expect(result.summary).toHaveLength(1);
    expect(result.summary[0].count).toBe(42);
  });
});

describe('getVisitStats', () => {
  beforeEach(() => jest.clearAllMocks());

  it('retourne les stats de la visite', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [{ id: 'v1' }] }).mockResolvedValueOnce({ rows: [{ event_type: 'visit_start', count: 10 }] });
    const result = await getVisitStats('org-uuid', 'v1');
    expect(result.visit_id).toBe('v1');
    expect(result.stats).toHaveLength(1);
  });

  it('lève 404 VISIT_NOT_FOUND', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [] });
    await expect(getVisitStats('org-uuid', 'alien')).rejects.toMatchObject({ statusCode: 404, code: 'VISIT_NOT_FOUND' });
  });
});
