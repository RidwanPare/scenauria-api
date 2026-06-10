import pool from '../db/client';
import { makeAppError } from './auth.service';

export interface Visit {
  id: string;
  place_id: string;
  capture_id: string | null;
  scene_url: string | null;
  poster_url: string | null;
  thumbnail_url: string | null;
  slug: string;
  publication_status: string;
  viewer_settings: Record<string, unknown>;
  published_at: string | null;
  paused_at: string | null;
  required_plan: string;
  created_at: string;
  updated_at: string;
}

export interface CreateVisitData {
  place_id: string;
  capture_id?: string | null;
  scene_url?: string | null;
  poster_url?: string | null;
  thumbnail_url?: string | null;
  slug?: string;
  viewer_settings?: Record<string, unknown>;
  required_plan?: string;
}

export interface UpdateVisitData {
  capture_id?: string | null;
  scene_url?: string | null;
  poster_url?: string | null;
  thumbnail_url?: string | null;
  slug?: string;
  viewer_settings?: Record<string, unknown>;
  required_plan?: string;
}

export interface ListVisitsFilters {
  publication_status?: string;
  place_id?: string;
  page?: number;
  limit?: number;
}

export interface VisitList {
  visits: Visit[];
  total: number;
  page: number;
  limit: number;
}

const VISIT_COLS = `v.id, v.place_id, v.capture_id, v.scene_url, v.poster_url, v.thumbnail_url,
  v.slug, v.publication_status, v.viewer_settings, v.published_at, v.paused_at,
  v.required_plan, v.created_at, v.updated_at`;

export async function listVisits(orgId: string, filters: ListVisitsFilters): Promise<VisitList> {
  const page = Math.max(1, filters.page ?? 1);
  const limit = Math.min(100, Math.max(1, filters.limit ?? 20));
  const offset = (page - 1) * limit;

  const countParams: unknown[] = [orgId];
  const selectParams: unknown[] = [orgId];
  let extraWhere = '';

  if (filters.publication_status) {
    countParams.push(filters.publication_status);
    selectParams.push(filters.publication_status);
    extraWhere += ` AND v.publication_status = $${countParams.length}`;
  }

  if (filters.place_id) {
    countParams.push(filters.place_id);
    selectParams.push(filters.place_id);
    extraWhere += ` AND v.place_id = $${countParams.length}`;
  }

  selectParams.push(limit);
  const limitParam = `$${selectParams.length}`;
  selectParams.push(offset);
  const offsetParam = `$${selectParams.length}`;

  const base = `FROM visits v JOIN places p ON p.id = v.place_id WHERE p.organization_id = $1`;

  const countResult = await pool.query(`SELECT COUNT(*)::int AS total ${base}${extraWhere}`, countParams);
  const selectResult = await pool.query(
    `SELECT ${VISIT_COLS} ${base}${extraWhere} ORDER BY v.created_at DESC LIMIT ${limitParam} OFFSET ${offsetParam}`,
    selectParams
  );

  return { visits: selectResult.rows, total: countResult.rows[0].total, page, limit };
}

export async function getVisit(orgId: string, visitId: string): Promise<Visit> {
  const result = await pool.query(
    `SELECT ${VISIT_COLS} FROM visits v JOIN places p ON p.id = v.place_id
     WHERE v.id = $1 AND p.organization_id = $2`,
    [visitId, orgId]
  );
  if (!result.rows[0]) throw makeAppError('Visit not found', 404, 'VISIT_NOT_FOUND');
  return result.rows[0];
}

export async function getVisitBySlug(slug: string): Promise<Visit> {
  const result = await pool.query(
    `SELECT ${VISIT_COLS} FROM visits v JOIN places p ON p.id = v.place_id
     WHERE v.slug = $1 AND v.publication_status = 'published'`,
    [slug]
  );
  if (!result.rows[0]) throw makeAppError('Visit not found', 404, 'VISIT_NOT_FOUND');
  return result.rows[0];
}

export async function getVisitsByPlace(orgId: string, placeId: string): Promise<{ visits: Visit[] }> {
  const placeCheck = await pool.query(
    `SELECT id FROM places WHERE id = $1 AND organization_id = $2`,
    [placeId, orgId]
  );
  if (!placeCheck.rows[0]) throw makeAppError('Place not found', 404, 'PLACE_NOT_FOUND');

  const result = await pool.query(
    `SELECT ${VISIT_COLS} FROM visits v JOIN places p ON p.id = v.place_id
     WHERE v.place_id = $1 ORDER BY v.created_at DESC`,
    [placeId]
  );
  return { visits: result.rows };
}
