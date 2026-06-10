import pool from '../db/client';
import { makeAppError } from './auth.service';

export interface Hotspot {
  id: string;
  visit_id: string;
  title: string;
  description: string | null;
  type: string;
  position: Record<string, unknown>;
  action: string | null;
  action_url: string | null;
  display_order: number;
  status: string;
  created_at: string;
  updated_at: string;
}

export interface CreateHotspotData {
  visit_id: string;
  title: string;
  type: string;
  description?: string;
  position?: Record<string, unknown>;
  action?: string;
  action_url?: string;
  display_order?: number;
}

export interface UpdateHotspotData {
  title?: string;
  description?: string;
  type?: string;
  position?: Record<string, unknown>;
  action?: string;
  action_url?: string;
  display_order?: number;
}

export interface ListHotspotsFilters {
  visit_id?: string;
  page?: number;
  limit?: number;
}

const HOTSPOT_COLS = `h.id, h.visit_id, h.title, h.description, h.type, h.position, h.action, h.action_url, h.display_order, h.status, h.created_at, h.updated_at`;

export async function listHotspots(
  orgId: string,
  filters: ListHotspotsFilters
): Promise<{ hotspots: Hotspot[]; total: number; page: number; limit: number }> {
  const page = Math.max(1, filters.page ?? 1);
  const limit = Math.min(100, Math.max(1, filters.limit ?? 20));
  const offset = (page - 1) * limit;

  const countParams: unknown[] = [orgId];
  const selectParams: unknown[] = [orgId];
  let extraWhere = '';

  if (filters.visit_id) {
    countParams.push(filters.visit_id);
    selectParams.push(filters.visit_id);
    extraWhere += ` AND h.visit_id = $${countParams.length}`;
  }

  selectParams.push(limit);
  const limitParam = `$${selectParams.length}`;
  selectParams.push(offset);
  const offsetParam = `$${selectParams.length}`;

  const base = `FROM hotspots h JOIN visits v ON v.id = h.visit_id JOIN places p ON p.id = v.place_id WHERE p.organization_id = $1`;

  const countResult = await pool.query(
    `SELECT COUNT(*)::int AS total ${base}${extraWhere}`,
    countParams
  );
  const selectResult = await pool.query(
    `SELECT ${HOTSPOT_COLS} ${base}${extraWhere} ORDER BY h.display_order ASC, h.created_at DESC LIMIT ${limitParam} OFFSET ${offsetParam}`,
    selectParams
  );

  return { hotspots: selectResult.rows, total: countResult.rows[0].total, page, limit };
}

export async function getHotspotsByVisit(
  orgId: string,
  visitId: string
): Promise<{ hotspots: Hotspot[] }> {
  const visitCheck = await pool.query(
    `SELECT v.id FROM visits v JOIN places p ON p.id = v.place_id WHERE v.id = $1 AND p.organization_id = $2`,
    [visitId, orgId]
  );
  if (!visitCheck.rows[0]) throw makeAppError('Visit not found', 404, 'VISIT_NOT_FOUND');

  const result = await pool.query(
    `SELECT ${HOTSPOT_COLS} FROM hotspots h JOIN visits v ON v.id = h.visit_id JOIN places p ON p.id = v.place_id WHERE h.visit_id = $1 ORDER BY h.display_order ASC, h.created_at DESC`,
    [visitId]
  );
  return { hotspots: result.rows };
}

export async function getHotspot(orgId: string, id: string): Promise<Hotspot> {
  const result = await pool.query(
    `SELECT ${HOTSPOT_COLS} FROM hotspots h JOIN visits v ON v.id = h.visit_id JOIN places p ON p.id = v.place_id WHERE h.id = $1 AND p.organization_id = $2`,
    [id, orgId]
  );
  if (!result.rows[0]) throw makeAppError('Hotspot not found', 404, 'HOTSPOT_NOT_FOUND');
  return result.rows[0];
}

export async function createHotspot(orgId: string, data: CreateHotspotData): Promise<Hotspot> {
  const visitCheck = await pool.query(
    `SELECT v.id FROM visits v JOIN places p ON p.id = v.place_id WHERE v.id = $1 AND p.organization_id = $2`,
    [data.visit_id, orgId]
  );
  if (!visitCheck.rows[0]) throw makeAppError('Visit not found', 404, 'VISIT_NOT_FOUND');

  const result = await pool.query(
    `INSERT INTO hotspots (visit_id, title, description, type, position, action, action_url, display_order)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
     RETURNING id, visit_id, title, description, type, position, action, action_url, display_order, status, created_at, updated_at`,
    [
      data.visit_id,
      data.title,
      data.description ?? null,
      data.type,
      data.position ?? {},
      data.action ?? null,
      data.action_url ?? null,
      data.display_order ?? 0,
    ]
  );
  return result.rows[0];
}

export async function updateHotspot(
  orgId: string,
  id: string,
  data: UpdateHotspotData
): Promise<Hotspot> {
  const updatable = ['title', 'description', 'type', 'position', 'action', 'action_url', 'display_order'] as const;
  const fields: string[] = [];
  const values: unknown[] = [];
  let paramIndex = 1;

  for (const key of updatable) {
    if (key in data) {
      fields.push(`${key} = $${paramIndex++}`);
      values.push(data[key] ?? null);
    }
  }

  if (fields.length === 0) return getHotspot(orgId, id);

  fields.push(`updated_at = NOW()`);
  values.push(id, orgId);

  const result = await pool.query(
    `UPDATE hotspots h SET ${fields.join(', ')}
     FROM visits v JOIN places p ON p.id = v.place_id
     WHERE h.id = $${paramIndex++} AND h.visit_id = v.id AND p.organization_id = $${paramIndex}
     RETURNING h.id, h.visit_id, h.title, h.description, h.type, h.position, h.action, h.action_url, h.display_order, h.status, h.created_at, h.updated_at`,
    values
  );
  if (!result.rows[0]) throw makeAppError('Hotspot not found', 404, 'HOTSPOT_NOT_FOUND');
  return result.rows[0];
}

export async function deleteHotspot(orgId: string, id: string): Promise<void> {
  const result = await pool.query(
    `DELETE FROM hotspots h
     USING visits v, places p
     WHERE h.id = $1 AND h.visit_id = v.id AND v.place_id = p.id AND p.organization_id = $2`,
    [id, orgId]
  );
  if ((result as any).rowCount === 0) {
    throw makeAppError('Hotspot not found', 404, 'HOTSPOT_NOT_FOUND');
  }
}
