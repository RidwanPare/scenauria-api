import pool from '../db/client';
import { makeAppError } from './auth.service';

export interface QrCode {
  id: string;
  visit_id: string;
  name: string;
  source: string | null;
  tracked_url: string;
  qr_image_url: string | null;
  scan_count: number;
  status: string;
  created_at: string;
  updated_at: string;
}

export interface CreateQrCodeData {
  visit_id: string;
  name: string;
  source?: string;
  tracked_url: string;
  qr_image_url?: string;
}

export interface UpdateQrCodeData {
  name?: string;
  source?: string;
  tracked_url?: string;
  qr_image_url?: string;
}

export interface ListQrCodesFilters {
  visit_id?: string;
  page?: number;
  limit?: number;
}

const QR_COLS = `q.id, q.visit_id, q.name, q.source, q.tracked_url, q.qr_image_url, q.scan_count, q.status, q.created_at, q.updated_at`;

export async function listQrCodes(
  orgId: string,
  filters: ListQrCodesFilters
): Promise<{ qrcodes: QrCode[]; total: number; page: number; limit: number }> {
  const page = Math.max(1, filters.page ?? 1);
  const limit = Math.min(100, Math.max(1, filters.limit ?? 20));
  const offset = (page - 1) * limit;

  const countParams: unknown[] = [orgId];
  const selectParams: unknown[] = [orgId];
  let extraWhere = '';

  if (filters.visit_id) {
    countParams.push(filters.visit_id);
    selectParams.push(filters.visit_id);
    extraWhere += ` AND q.visit_id = $${countParams.length}`;
  }

  selectParams.push(limit);
  const limitParam = `$${selectParams.length}`;
  selectParams.push(offset);
  const offsetParam = `$${selectParams.length}`;

  const base = `FROM qr_codes q JOIN visits v ON v.id = q.visit_id JOIN places p ON p.id = v.place_id WHERE p.organization_id = $1`;

  const countResult = await pool.query(
    `SELECT COUNT(*)::int AS total ${base}${extraWhere}`,
    countParams
  );
  const selectResult = await pool.query(
    `SELECT ${QR_COLS} ${base}${extraWhere} ORDER BY q.created_at DESC LIMIT ${limitParam} OFFSET ${offsetParam}`,
    selectParams
  );

  return { qrcodes: selectResult.rows, total: countResult.rows[0].total, page, limit };
}

export async function getQrCodesByVisit(
  orgId: string,
  visitId: string
): Promise<{ qrcodes: QrCode[] }> {
  const visitCheck = await pool.query(
    `SELECT v.id FROM visits v JOIN places p ON p.id = v.place_id WHERE v.id = $1 AND p.organization_id = $2`,
    [visitId, orgId]
  );
  if (!visitCheck.rows[0]) throw makeAppError('Visit not found', 404, 'VISIT_NOT_FOUND');

  const result = await pool.query(
    `SELECT ${QR_COLS} FROM qr_codes q JOIN visits v ON v.id = q.visit_id JOIN places p ON p.id = v.place_id WHERE q.visit_id = $1 ORDER BY q.created_at DESC`,
    [visitId]
  );
  return { qrcodes: result.rows };
}

export async function getQrCode(orgId: string, qrId: string): Promise<QrCode> {
  const result = await pool.query(
    `SELECT ${QR_COLS} FROM qr_codes q JOIN visits v ON v.id = q.visit_id JOIN places p ON p.id = v.place_id WHERE q.id = $1 AND p.organization_id = $2`,
    [qrId, orgId]
  );
  if (!result.rows[0]) throw makeAppError('QR code not found', 404, 'QRCODE_NOT_FOUND');
  return result.rows[0];
}

export async function createQrCode(orgId: string, data: CreateQrCodeData): Promise<QrCode> {
  const visitCheck = await pool.query(
    `SELECT v.id FROM visits v JOIN places p ON p.id = v.place_id WHERE v.id = $1 AND p.organization_id = $2`,
    [data.visit_id, orgId]
  );
  if (!visitCheck.rows[0]) throw makeAppError('Visit not found', 404, 'VISIT_NOT_FOUND');

  const result = await pool.query(
    `INSERT INTO qr_codes (visit_id, name, source, tracked_url, qr_image_url)
     VALUES ($1, $2, $3, $4, $5)
     RETURNING id, visit_id, name, source, tracked_url, qr_image_url, scan_count, status, created_at, updated_at`,
    [data.visit_id, data.name, data.source ?? null, data.tracked_url, data.qr_image_url ?? null]
  );
  return result.rows[0];
}

export async function updateQrCode(
  orgId: string,
  qrId: string,
  data: UpdateQrCodeData
): Promise<QrCode> {
  const updatable: (keyof UpdateQrCodeData)[] = ['name', 'source', 'tracked_url', 'qr_image_url'];
  const fields: string[] = [];
  const values: unknown[] = [];
  let paramIndex = 1;

  for (const key of updatable) {
    if (key in data) {
      fields.push(`${key} = $${paramIndex++}`);
      values.push(data[key] ?? null);
    }
  }

  if (fields.length === 0) return getQrCode(orgId, qrId);

  fields.push(`updated_at = NOW()`);
  values.push(qrId, orgId);

  const result = await pool.query(
    `UPDATE qr_codes q SET ${fields.join(', ')}
     FROM visits v JOIN places p ON p.id = v.place_id
     WHERE q.id = $${paramIndex++} AND q.visit_id = v.id AND p.organization_id = $${paramIndex}
     RETURNING q.id, q.visit_id, q.name, q.source, q.tracked_url, q.qr_image_url, q.scan_count, q.status, q.created_at, q.updated_at`,
    values
  );
  if (!result.rows[0]) throw makeAppError('QR code not found', 404, 'QRCODE_NOT_FOUND');
  return result.rows[0];
}

export async function deleteQrCode(orgId: string, qrId: string): Promise<void> {
  const result = await pool.query(
    `DELETE FROM qr_codes q
     USING visits v, places p
     WHERE q.id = $1 AND q.visit_id = v.id AND v.place_id = p.id AND p.organization_id = $2`,
    [qrId, orgId]
  );
  if ((result as any).rowCount === 0) {
    throw makeAppError('QR code not found', 404, 'QRCODE_NOT_FOUND');
  }
}
