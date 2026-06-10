import pool from '../db/client';
import { makeAppError } from './auth.service';

export interface Capture {
  id: string;
  place_id: string;
  video_url: string | null;
  duration_seconds: number | null;
  file_size_bytes: number | null;
  resolution: string | null;
  status: string;
  quality_score: number | null;
  quality_report: Record<string, unknown> | null;
  error_message: string | null;
  uploaded_at: string | null;
  processing_started_at: string | null;
  processing_completed_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface CreateCaptureData {
  video_url?: string | null;
}

export interface UpdateCaptureData {
  video_url?: string | null;
  duration_seconds?: number | null;
  file_size_bytes?: number | null;
  resolution?: string | null;
  error_message?: string | null;
  uploaded_at?: string | null;
}

export interface ListCapturesFilters {
  status?: string;
  place_id?: string;
  page?: number;
  limit?: number;
}

export interface CaptureList {
  captures: Capture[];
  total: number;
  page: number;
  limit: number;
}

const CAPTURE_COLS = `c.id, c.place_id, c.video_url, c.duration_seconds, c.file_size_bytes,
  c.resolution, c.status, c.quality_score, c.quality_report, c.error_message,
  c.uploaded_at, c.processing_started_at, c.processing_completed_at, c.created_at, c.updated_at`;

export async function listCaptures(orgId: string, filters: ListCapturesFilters): Promise<CaptureList> {
  const page = Math.max(1, filters.page ?? 1);
  const limit = Math.min(100, Math.max(1, filters.limit ?? 20));
  const offset = (page - 1) * limit;

  const countParams: unknown[] = [orgId];
  const selectParams: unknown[] = [orgId];
  let extraWhere = '';

  if (filters.status) {
    countParams.push(filters.status);
    selectParams.push(filters.status);
    extraWhere += ` AND c.status = $${countParams.length}`;
  }

  if (filters.place_id) {
    countParams.push(filters.place_id);
    selectParams.push(filters.place_id);
    extraWhere += ` AND c.place_id = $${countParams.length}`;
  }

  selectParams.push(limit);
  const limitParam = `$${selectParams.length}`;
  selectParams.push(offset);
  const offsetParam = `$${selectParams.length}`;

  const baseWhere = `FROM captures c JOIN places p ON p.id = c.place_id WHERE p.organization_id = $1`;

  const countResult = await pool.query(
    `SELECT COUNT(*)::int AS total ${baseWhere}${extraWhere}`,
    countParams
  );
  const selectResult = await pool.query(
    `SELECT ${CAPTURE_COLS} ${baseWhere}${extraWhere} ORDER BY c.created_at DESC LIMIT ${limitParam} OFFSET ${offsetParam}`,
    selectParams
  );

  return { captures: selectResult.rows, total: countResult.rows[0].total, page, limit };
}

export async function getCapturesByPlace(orgId: string, placeId: string): Promise<{ captures: Capture[] }> {
  const placeCheck = await pool.query(
    `SELECT id FROM places WHERE id = $1 AND organization_id = $2`,
    [placeId, orgId]
  );
  if (!placeCheck.rows[0]) throw makeAppError('Place not found', 404, 'PLACE_NOT_FOUND');

  const result = await pool.query(
    `SELECT ${CAPTURE_COLS} FROM captures c JOIN places p ON p.id = c.place_id
     WHERE c.place_id = $1 ORDER BY c.created_at DESC`,
    [placeId]
  );
  return { captures: result.rows };
}

export async function getCapture(orgId: string, captureId: string): Promise<Capture> {
  const result = await pool.query(
    `SELECT ${CAPTURE_COLS} FROM captures c JOIN places p ON p.id = c.place_id
     WHERE c.id = $1 AND p.organization_id = $2`,
    [captureId, orgId]
  );
  if (!result.rows[0]) throw makeAppError('Capture not found', 404, 'CAPTURE_NOT_FOUND');
  return result.rows[0];
}
