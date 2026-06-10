jest.mock('../db/client', () => ({
  default: { query: jest.fn() },
  __esModule: true,
}));

import pool from '../db/client';
import {
  listQrCodes,
  getQrCode,
  getQrCodesByVisit,
  createQrCode,
  updateQrCode,
  deleteQrCode,
} from '../services/qrcode.service';

const mockQuery = pool.query as jest.Mock;

describe('listQrCodes', () => {
  beforeEach(() => jest.clearAllMocks());

  it('retourne les QR codes paginés', async () => {
    mockQuery
      .mockResolvedValueOnce({ rows: [{ total: 2 }] })
      .mockResolvedValueOnce({ rows: [{ id: 'q1' }, { id: 'q2' }] });

    const result = await listQrCodes('org-uuid', {});
    expect(result.total).toBe(2);
    expect(result.qrcodes).toHaveLength(2);
    expect(result.page).toBe(1);
    expect(result.limit).toBe(20);
  });

  it('plafonne limit à 100', async () => {
    mockQuery
      .mockResolvedValueOnce({ rows: [{ total: 0 }] })
      .mockResolvedValueOnce({ rows: [] });
    const result = await listQrCodes('org-uuid', { limit: 999 });
    expect(result.limit).toBe(100);
  });

  it('filtre par visit_id', async () => {
    mockQuery
      .mockResolvedValueOnce({ rows: [{ total: 1 }] })
      .mockResolvedValueOnce({ rows: [{ id: 'q1' }] });
    const result = await listQrCodes('org-uuid', { visit_id: 'v1' });
    expect(result.qrcodes).toHaveLength(1);
  });
});

describe('getQrCode', () => {
  beforeEach(() => jest.clearAllMocks());

  it('retourne le QR code', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [{ id: 'q1', name: 'Vitrine' }] });
    const result = await getQrCode('org-uuid', 'q1');
    expect(result.id).toBe('q1');
    expect(result.name).toBe('Vitrine');
  });

  it('lève 404 QRCODE_NOT_FOUND', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [] });
    await expect(getQrCode('org-uuid', 'unknown')).rejects.toMatchObject({
      statusCode: 404,
      code: 'QRCODE_NOT_FOUND',
    });
  });
});

describe('getQrCodesByVisit', () => {
  beforeEach(() => jest.clearAllMocks());

  it('retourne les QR codes d une visite', async () => {
    mockQuery
      .mockResolvedValueOnce({ rows: [{ id: 'v1' }] })
      .mockResolvedValueOnce({ rows: [{ id: 'q1' }] });
    const result = await getQrCodesByVisit('org-uuid', 'v1');
    expect(result.qrcodes).toHaveLength(1);
  });

  it('lève 404 VISIT_NOT_FOUND si visite hors org', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [] });
    await expect(getQrCodesByVisit('org-uuid', 'alien')).rejects.toMatchObject({
      statusCode: 404,
      code: 'VISIT_NOT_FOUND',
    });
  });
});

describe('createQrCode', () => {
  beforeEach(() => jest.clearAllMocks());

  it('crée un QR code', async () => {
    mockQuery
      .mockResolvedValueOnce({ rows: [{ id: 'v1' }] })
      .mockResolvedValueOnce({ rows: [{ id: 'q1', name: 'Flyer', tracked_url: 'https://s.io/abc' }] });

    const result = await createQrCode('org-uuid', {
      visit_id: 'v1',
      name: 'Flyer',
      tracked_url: 'https://s.io/abc',
    });
    expect(result.id).toBe('q1');
  });

  it('lève 404 VISIT_NOT_FOUND si visite hors org', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [] });
    await expect(
      createQrCode('org-uuid', { visit_id: 'alien', name: 'X', tracked_url: 'https://x.io' })
    ).rejects.toMatchObject({ statusCode: 404, code: 'VISIT_NOT_FOUND' });
  });
});

describe('updateQrCode', () => {
  beforeEach(() => jest.clearAllMocks());

  it('met à jour les champs fournis', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [{ id: 'q1', name: 'New Name' }] });
    const result = await updateQrCode('org-uuid', 'q1', { name: 'New Name' });
    expect(result.name).toBe('New Name');
  });

  it('lève 404 si inexistant', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [] });
    await expect(updateQrCode('org-uuid', 'unknown', { name: 'X' })).rejects.toMatchObject({
      statusCode: 404,
      code: 'QRCODE_NOT_FOUND',
    });
  });

  it('appelle getQrCode si aucun champ', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [{ id: 'q1', name: 'Existing' }] });
    const result = await updateQrCode('org-uuid', 'q1', {});
    expect(result.id).toBe('q1');
  });
});

describe('deleteQrCode', () => {
  beforeEach(() => jest.clearAllMocks());

  it('supprime le QR code', async () => {
    mockQuery.mockResolvedValueOnce({ rowCount: 1 });
    await expect(deleteQrCode('org-uuid', 'q1')).resolves.toBeUndefined();
  });

  it('lève 404 si inexistant', async () => {
    mockQuery.mockResolvedValueOnce({ rowCount: 0 });
    await expect(deleteQrCode('org-uuid', 'unknown')).rejects.toMatchObject({
      statusCode: 404,
      code: 'QRCODE_NOT_FOUND',
    });
  });
});
