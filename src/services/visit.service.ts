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

export async function createVisit(orgId: string, data: CreateVisitData): Promise<Visit> {
  const placeCheck = await pool.query(
    `SELECT id FROM places WHERE id = $1 AND organization_id = $2`,
    [data.place_id, orgId]
  );
  if (!placeCheck.rows[0]) throw makeAppError('Place not found', 404, 'PLACE_NOT_FOUND');

  const slug = data.slug ?? `${data.place_id.substring(0, 8)}-${Date.now().toString(36)}`;

  const slugCheck = await pool.query(`SELECT id FROM visits WHERE slug = $1`, [slug]);
  if (slugCheck.rows[0]) throw makeAppError('Slug already taken', 400, 'SLUG_TAKEN');

  const result = await pool.query(
    `INSERT INTO visits (place_id, capture_id, scene_url, poster_url, thumbnail_url, slug, viewer_settings, required_plan)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
     RETURNING id, place_id, capture_id, scene_url, poster_url, thumbnail_url,
       slug, publication_status, viewer_settings, published_at, paused_at,
       required_plan, created_at, updated_at`,
    [
      data.place_id,
      data.capture_id ?? null,
      data.scene_url ?? null,
      data.poster_url ?? null,
      data.thumbnail_url ?? null,
      slug,
      JSON.stringify(data.viewer_settings ?? {}),
      data.required_plan ?? 'start',
    ]
  );
  return result.rows[0];
}

/** Création de visite par le worker (pas de scoping org — protégé par workerAuth). Statut draft. */
export async function createVisitFromWorker(data: {
  place_id: string;
  capture_id?: string | null;
  scene_url?: string | null;
  poster_url?: string | null;
}): Promise<Visit> {
  const placeCheck = await pool.query(`SELECT id FROM places WHERE id = $1`, [data.place_id]);
  if (!placeCheck.rows[0]) throw makeAppError('Place not found', 404, 'PLACE_NOT_FOUND');

  const slug = `${data.place_id.substring(0, 8)}-${Date.now().toString(36)}`;

  const result = await pool.query(
    `INSERT INTO visits (place_id, capture_id, scene_url, poster_url, slug, publication_status, viewer_settings)
     VALUES ($1, $2, $3, $4, $5, 'draft', '{}')
     RETURNING id, place_id, capture_id, scene_url, poster_url, thumbnail_url,
       slug, publication_status, viewer_settings, published_at, paused_at,
       required_plan, created_at, updated_at`,
    [data.place_id, data.capture_id ?? null, data.scene_url ?? null, data.poster_url ?? null, slug]
  );
  return result.rows[0];
}

export async function updateVisit(orgId: string, visitId: string, data: UpdateVisitData): Promise<Visit> {
  const UPDATABLE = ['capture_id', 'scene_url', 'poster_url', 'thumbnail_url', 'slug', 'viewer_settings', 'required_plan'] as const;
  const fields: string[] = [];
  const params: unknown[] = [];

  for (const key of UPDATABLE) {
    if (key in data) {
      params.push(data[key] ?? null);
      fields.push(`${key} = $${params.length}`);
    }
  }

  if (fields.length === 0) {
    return getVisit(orgId, visitId);
  }

  params.push(visitId);
  params.push(orgId);

  const result = await pool.query(
    `UPDATE visits v SET ${fields.join(', ')}, updated_at = NOW()
     FROM places p
     WHERE v.id = $${params.length - 1} AND v.place_id = p.id AND p.organization_id = $${params.length}
     RETURNING ${VISIT_COLS}`,
    params
  );
  if (!result.rows[0]) throw makeAppError('Visit not found', 404, 'VISIT_NOT_FOUND');
  return result.rows[0];
}

export async function deleteVisit(orgId: string, visitId: string): Promise<void> {
  const result = await pool.query(
    `DELETE FROM visits v USING places p
     WHERE v.id = $1 AND v.place_id = p.id AND p.organization_id = $2`,
    [visitId, orgId]
  );
  if ((result as any).rowCount === 0) throw makeAppError('Visit not found', 404, 'VISIT_NOT_FOUND');
}

export async function setPublicationStatus(orgId: string, visitId: string, action: 'publish' | 'pause' | 'unpublish'): Promise<Visit> {
  let setClause: string;
  if (action === 'publish') {
    setClause = `publication_status = 'published', published_at = NOW()`;
  } else if (action === 'pause') {
    setClause = `publication_status = 'paused', paused_at = NOW()`;
  } else {
    setClause = `publication_status = 'draft', published_at = NULL, paused_at = NULL`;
  }

  const result = await pool.query(
    `UPDATE visits v SET ${setClause}, updated_at = NOW()
     FROM places p
     WHERE v.id = $1 AND v.place_id = p.id AND p.organization_id = $2
     RETURNING ${VISIT_COLS}`,
    [visitId, orgId]
  );
  if (!result.rows[0]) throw makeAppError('Visit not found', 404, 'VISIT_NOT_FOUND');
  return result.rows[0];
}
