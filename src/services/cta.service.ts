import pool from '../db/client';
import { makeAppError } from './auth.service';

export interface CtaButton {
  id: string;
  visit_id: string;
  label: string;
  type: string;
  url: string | null;
  display_order: number;
  status: string;
  created_at: string;
  updated_at: string;
}

export interface CreateCtaButtonData {
  visit_id: string;
  label: string;
  type: string;
  url?: string;
  display_order?: number;
}

export interface UpdateCtaButtonData {
  label?: string;
  type?: string;
  url?: string;
  display_order?: number;
}

export interface ListCtaButtonsFilters {
  visit_id?: string;
  page?: number;
  limit?: number;
}

const CTA_COLS = `c.id, c.visit_id, c.label, c.type, c.url, c.display_order, c.status, c.created_at, c.updated_at`;

export async function listCtaButtons(
  orgId: string,
  filters: ListCtaButtonsFilters
): Promise<{ cta_buttons: CtaButton[]; total: number; page: number; limit: number }> {
  const page = Math.max(1, filters.page ?? 1);
  const limit = Math.min(100, Math.max(1, filters.limit ?? 20));
  const offset = (page - 1) * limit;

  const countParams: unknown[] = [orgId];
  const selectParams: unknown[] = [orgId];
  let extraWhere = '';

  if (filters.visit_id) {
    countParams.push(filters.visit_id);
    selectParams.push(filters.visit_id);
    extraWhere += ` AND c.visit_id = $${countParams.length}`;
  }

  selectParams.push(limit);
  const limitParam = `$${selectParams.length}`;
  selectParams.push(offset);
  const offsetParam = `$${selectParams.length}`;

  const base = `FROM cta_buttons c JOIN visits v ON v.id = c.visit_id JOIN places p ON p.id = v.place_id WHERE p.organization_id = $1`;

  const countResult = await pool.query(
    `SELECT COUNT(*)::int AS total ${base}${extraWhere}`,
    countParams
  );
  const selectResult = await pool.query(
    `SELECT ${CTA_COLS} ${base}${extraWhere} ORDER BY c.display_order ASC, c.created_at DESC LIMIT ${limitParam} OFFSET ${offsetParam}`,
    selectParams
  );

  return { cta_buttons: selectResult.rows, total: countResult.rows[0].total, page, limit };
}

export async function getCtaButtonsByVisit(
  orgId: string,
  visitId: string
): Promise<{ cta_buttons: CtaButton[] }> {
  const visitCheck = await pool.query(
    `SELECT v.id FROM visits v JOIN places p ON p.id = v.place_id WHERE v.id = $1 AND p.organization_id = $2`,
    [visitId, orgId]
  );
  if (!visitCheck.rows[0]) throw makeAppError('Visit not found', 404, 'VISIT_NOT_FOUND');

  const result = await pool.query(
    `SELECT ${CTA_COLS} FROM cta_buttons c JOIN visits v ON v.id = c.visit_id JOIN places p ON p.id = v.place_id WHERE c.visit_id = $1 ORDER BY c.display_order ASC, c.created_at DESC`,
    [visitId]
  );
  return { cta_buttons: result.rows };
}

export async function getCtaButton(orgId: string, id: string): Promise<CtaButton> {
  const result = await pool.query(
    `SELECT ${CTA_COLS} FROM cta_buttons c JOIN visits v ON v.id = c.visit_id JOIN places p ON p.id = v.place_id WHERE c.id = $1 AND p.organization_id = $2`,
    [id, orgId]
  );
  if (!result.rows[0]) throw makeAppError('CTA button not found', 404, 'CTA_NOT_FOUND');
  return result.rows[0];
}

export async function createCtaButton(orgId: string, data: CreateCtaButtonData): Promise<CtaButton> {
  const visitCheck = await pool.query(
    `SELECT v.id FROM visits v JOIN places p ON p.id = v.place_id WHERE v.id = $1 AND p.organization_id = $2`,
    [data.visit_id, orgId]
  );
  if (!visitCheck.rows[0]) throw makeAppError('Visit not found', 404, 'VISIT_NOT_FOUND');

  const result = await pool.query(
    `INSERT INTO cta_buttons (visit_id, label, type, url, display_order)
     VALUES ($1, $2, $3, $4, $5)
     RETURNING id, visit_id, label, type, url, display_order, status, created_at, updated_at`,
    [data.visit_id, data.label, data.type, data.url ?? null, data.display_order ?? 0]
  );
  return result.rows[0];
}

export async function updateCtaButton(
  orgId: string,
  id: string,
  data: UpdateCtaButtonData
): Promise<CtaButton> {
  const updatable = ['label', 'type', 'url', 'display_order'] as const;
  const fields: string[] = [];
  const values: unknown[] = [];
  let paramIndex = 1;

  for (const key of updatable) {
    if (key in data) {
      fields.push(`${key} = $${paramIndex++}`);
      values.push(data[key] ?? null);
    }
  }

  if (fields.length === 0) return getCtaButton(orgId, id);

  fields.push(`updated_at = NOW()`);
  values.push(id, orgId);

  const result = await pool.query(
    `UPDATE cta_buttons c SET ${fields.join(', ')}
     FROM visits v JOIN places p ON p.id = v.place_id
     WHERE c.id = $${paramIndex++} AND c.visit_id = v.id AND p.organization_id = $${paramIndex}
     RETURNING c.id, c.visit_id, c.label, c.type, c.url, c.display_order, c.status, c.created_at, c.updated_at`,
    values
  );
  if (!result.rows[0]) throw makeAppError('CTA button not found', 404, 'CTA_NOT_FOUND');
  return result.rows[0];
}

export async function deleteCtaButton(orgId: string, id: string): Promise<void> {
  const result = await pool.query(
    `DELETE FROM cta_buttons c
     USING visits v, places p
     WHERE c.id = $1 AND c.visit_id = v.id AND v.place_id = p.id AND p.organization_id = $2`,
    [id, orgId]
  );
  if ((result as any).rowCount === 0) {
    throw makeAppError('CTA button not found', 404, 'CTA_NOT_FOUND');
  }
}
