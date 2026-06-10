jest.mock('../db/client', () => ({ default: { query: jest.fn() }, __esModule: true }));

import pool from '../db/client';
import { getSubscription, listInvoices, handleStripeWebhook } from '../services/billing.service';

const mockQuery = pool.query as jest.Mock;

describe('getSubscription', () => {
  beforeEach(() => jest.clearAllMocks());

  it('retourne la subscription active', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [{ id: 's1', plan: 'pro', status: 'active' }] });
    const result = await getSubscription('org-uuid');
    expect(result).not.toBeNull();
    expect(result!.plan).toBe('pro');
  });

  it('retourne null si pas de subscription', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [] });
    const result = await getSubscription('org-uuid');
    expect(result).toBeNull();
  });
});

describe('listInvoices', () => {
  beforeEach(() => jest.clearAllMocks());

  it('retourne les factures paginées', async () => {
    mockQuery
      .mockResolvedValueOnce({ rows: [{ total: 3 }] })
      .mockResolvedValueOnce({ rows: [{ id: 'i1' }, { id: 'i2' }] });
    const result = await listInvoices('org-uuid', {});
    expect(result.total).toBe(3);
    expect(result.invoices).toHaveLength(2);
  });

  it('plafonne limit à 100', async () => {
    mockQuery
      .mockResolvedValueOnce({ rows: [{ total: 0 }] })
      .mockResolvedValueOnce({ rows: [] });
    const result = await listInvoices('org-uuid', { limit: 999 });
    expect(result.limit).toBe(100);
  });
});

describe('handleStripeWebhook', () => {
  it('lève 400 si signature manquante', async () => {
    await expect(handleStripeWebhook('payload', '')).rejects.toMatchObject({
      statusCode: 400,
      code: 'MISSING_SIGNATURE',
    });
  });

  it('réussit si signature présente', async () => {
    await expect(handleStripeWebhook('payload', 'sig_xxx')).resolves.toBeUndefined();
  });
});
