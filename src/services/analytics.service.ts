import pool from '../db/client';
import { makeAppError } from './auth.service';

export interface AnalyticsEvent {
  id: string;
  visit_id: string;
  place_id: string;
  event_type: string;
  session_id: string | null;
  source: string | null;
  device_type: string | null;
  duration_seconds: number | null;
  metadata: Record<string, unknown>;
  occurred_at: string;
}

export interface IngestEventData {
  visit_id: string;
  place_id: string;
  event_type: string;
  session_id?: string;
  source?: string;
  device_type?: string;
  duration_seconds?: number;
  metadata?: Record<string, unknown>;
}

export interface ListEventsFilters {
  visit_id?: string;
  place_id?: string;
  event_type?: string;
  date_from?: string;
  date_to?: string;
  page?: number;
  limit?: number;
}

const EVENT_COLS = `e.id, e.visit_id, e.place_id, e.event_type, e.session_id, e.source, e.device_type, e.duration_seconds, e.metadata, e.occurred_at`;

export async function ingestEvent(data: IngestEventData): Promise<AnalyticsEvent> {
  const result = await pool.query(
    `INSERT INTO analytics_events (visit_id, place_id, event_type, session_id, source, device_type, duration_seconds, metadata)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
     RETURNING id, visit_id, place_id, event_type, session_id, source, device_type, duration_seconds, metadata, occurred_at`,
    [data.visit_id, data.place_id, data.event_type, data.session_id ?? null, data.source ?? null, data.device_type ?? null, data.duration_seconds ?? null, JSON.stringify(data.metadata ?? {})]
  );
  return result.rows[0];
}

export async function listEvents(orgId: string, filters: ListEventsFilters): Promise<{ events: AnalyticsEvent[]; total: number; page: number; limit: number }> {
  const page = Math.max(1, filters.page ?? 1);
  const limit = Math.min(100, Math.max(1, filters.limit ?? 50));
  const offset = (page - 1) * limit;

  const params: unknown[] = [orgId];
  let extraWhere = '';

  if (filters.visit_id) { params.push(filters.visit_id); extraWhere += ` AND e.visit_id = $${params.length}`; }
  if (filters.place_id) { params.push(filters.place_id); extraWhere += ` AND e.place_id = $${params.length}`; }
  if (filters.event_type) { params.push(filters.event_type); extraWhere += ` AND e.event_type = $${params.length}`; }
  if (filters.date_from) { params.push(filters.date_from); extraWhere += ` AND e.occurred_at >= $${params.length}`; }
  if (filters.date_to) { params.push(filters.date_to); extraWhere += ` AND e.occurred_at <= $${params.length}`; }

  const countParams = [...params];
  const selectParams = [...params, limit, offset];

  const base = `FROM analytics_events e JOIN places p ON p.id = e.place_id WHERE p.organization_id = $1`;

  const countResult = await pool.query(`SELECT COUNT(*)::int AS total ${base}${extraWhere}`, countParams);
  const selectResult = await pool.query(
    `SELECT ${EVENT_COLS} ${base}${extraWhere} ORDER BY e.occurred_at DESC LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
    selectParams
  );

  return { events: selectResult.rows, total: countResult.rows[0].total, page, limit };
}

export async function getSummary(orgId: string): Promise<{ summary: Array<{ event_type: string; count: number }> }> {
  const result = await pool.query(
    `SELECT e.event_type, COUNT(*)::int AS count
     FROM analytics_events e JOIN places p ON p.id = e.place_id
     WHERE p.organization_id = $1
     GROUP BY e.event_type ORDER BY count DESC`,
    [orgId]
  );
  return { summary: result.rows };
}

export async function getVisitStats(orgId: string, visitId: string): Promise<{ visit_id: string; stats: Array<{ event_type: string; count: number }> }> {
  const visitCheck = await pool.query(
    `SELECT v.id FROM visits v JOIN places p ON p.id = v.place_id WHERE v.id = $1 AND p.organization_id = $2`,
    [visitId, orgId]
  );
  if (!visitCheck.rows[0]) throw makeAppError('Visit not found', 404, 'VISIT_NOT_FOUND');

  const result = await pool.query(
    `SELECT event_type, COUNT(*)::int AS count FROM analytics_events WHERE visit_id = $1 GROUP BY event_type ORDER BY count DESC`,
    [visitId]
  );
  return { visit_id: visitId, stats: result.rows };
}
