jest.mock('../db/client', () => ({
  default: { query: jest.fn() },
  __esModule: true,
}));

import pool from '../db/client';
import {
  listCtaButtons,
  getCtaButton,
  getCtaButtonsByVisit,
  createCtaButton,
  updateCtaButton,
  deleteCtaButton,
} from '../services/cta.service';

const mockQuery = pool.query as jest.Mock;

describe('listCtaButtons', () => {
  beforeEach(() => jest.clearAllMocks());

  it('retourne les CTA paginés', async () => {
    mockQuery
      .mockResolvedValueOnce({ rows: [{ total: 2 }] })
      .mockResolvedValueOnce({ rows: [{ id: 'c1' }, { id: 'c2' }] });

    const result = await listCtaButtons('org-uuid', {});
    expect(result.total).toBe(2);
    expect(result.cta_buttons).toHaveLength(2);
    expect(result.page).toBe(1);
    expect(result.limit).toBe(20);
  });

  it('plafonne limit à 100', async () => {
    mockQuery
      .mockResolvedValueOnce({ rows: [{ total: 0 }] })
      .mockResolvedValueOnce({ rows: [] });
    const result = await listCtaButtons('org-uuid', { limit: 999 });
    expect(result.limit).toBe(100);
  });
});

describe('getCtaButton', () => {
  beforeEach(() => jest.clearAllMocks());

  it('retourne le CTA button', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [{ id: 'c1', label: 'Réserver' }] });
    const result = await getCtaButton('org-uuid', 'c1');
    expect(result.id).toBe('c1');
    expect(result.label).toBe('Réserver');
  });

  it('lève 404 CTA_NOT_FOUND', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [] });
    await expect(getCtaButton('org-uuid', 'unknown')).rejects.toMatchObject({
      statusCode: 404,
      code: 'CTA_NOT_FOUND',
    });
  });
});

describe('getCtaButtonsByVisit', () => {
  beforeEach(() => jest.clearAllMocks());

  it('retourne les CTA d une visite', async () => {
    mockQuery
      .mockResolvedValueOnce({ rows: [{ id: 'v1' }] })
      .mockResolvedValueOnce({ rows: [{ id: 'c1' }] });
    const result = await getCtaButtonsByVisit('org-uuid', 'v1');
    expect(result.cta_buttons).toHaveLength(1);
  });

  it('lève 404 VISIT_NOT_FOUND si visite hors org', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [] });
    await expect(getCtaButtonsByVisit('org-uuid', 'alien')).rejects.toMatchObject({
      statusCode: 404,
      code: 'VISIT_NOT_FOUND',
    });
  });
});

describe('createCtaButton', () => {
  beforeEach(() => jest.clearAllMocks());

  it('crée un CTA button', async () => {
    mockQuery
      .mockResolvedValueOnce({ rows: [{ id: 'v1' }] })
      .mockResolvedValueOnce({ rows: [{ id: 'c1', label: 'Acheter', type: 'link' }] });

    const result = await createCtaButton('org-uuid', {
      visit_id: 'v1',
      label: 'Acheter',
      type: 'link',
    });
    expect(result.id).toBe('c1');
  });

  it('lève 404 VISIT_NOT_FOUND si visite hors org', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [] });
    await expect(
      createCtaButton('org-uuid', { visit_id: 'alien', label: 'X', type: 'link' })
    ).rejects.toMatchObject({ statusCode: 404, code: 'VISIT_NOT_FOUND' });
  });
});

describe('updateCtaButton', () => {
  beforeEach(() => jest.clearAllMocks());

  it('met à jour les champs fournis', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [{ id: 'c1', label: 'Nouveau label' }] });
    const result = await updateCtaButton('org-uuid', 'c1', { label: 'Nouveau label' });
    expect(result.label).toBe('Nouveau label');
  });

  it('lève 404 si inexistant', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [] });
    await expect(updateCtaButton('org-uuid', 'unknown', { label: 'X' })).rejects.toMatchObject({
      statusCode: 404,
      code: 'CTA_NOT_FOUND',
    });
  });
});

describe('deleteCtaButton', () => {
  beforeEach(() => jest.clearAllMocks());

  it('supprime le CTA button', async () => {
    mockQuery.mockResolvedValueOnce({ rowCount: 1 });
    await expect(deleteCtaButton('org-uuid', 'c1')).resolves.toBeUndefined();
  });

  it('lève 404 si inexistant', async () => {
    mockQuery.mockResolvedValueOnce({ rowCount: 0 });
    await expect(deleteCtaButton('org-uuid', 'unknown')).rejects.toMatchObject({
      statusCode: 404,
      code: 'CTA_NOT_FOUND',
    });
  });
});
