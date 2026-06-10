import pool from '../db/client';
import { makeAppError } from './auth.service';

export interface Place {
  id: string;
  organization_id: string;
  name: string;
  category: string | null;
  address: string | null;
  city: string | null;
  country: string | null;
  description: string | null;
  logo_url: string | null;
  cover_url: string | null;
  phone: string | null;
  whatsapp: string | null;
  website_url: string | null;
  booking_url: string | null;
  status: string;
  created_at: string;
  updated_at: string;
}

export interface CreatePlaceData {
  name: string;
  category?: string | null;
  address?: string | null;
  city?: string | null;
  country?: string | null;
  description?: string | null;
  logo_url?: string | null;
  cover_url?: string | null;
  phone?: string | null;
  whatsapp?: string | null;
  website_url?: string | null;
  booking_url?: string | null;
}

export interface ListPlacesFilters {
  status?: string;
  page?: number;
  limit?: number;
}

export interface PlaceList {
  places: Place[];
  total: number;
  page: number;
  limit: number;
}

const PLACE_COLUMNS = `id, organization_id, name, category, address, city, country, description,
  logo_url, cover_url, phone, whatsapp, website_url, booking_url, status, created_at, updated_at`;

export async function listPlaces(orgId: string, filters: ListPlacesFilters): Promise<PlaceList> {
  const page = Math.max(1, filters.page ?? 1);
  const limit = Math.min(100, Math.max(1, filters.limit ?? 20));
  const offset = (page - 1) * limit;

  const countParams: unknown[] = [orgId];
  const selectParams: unknown[] = [orgId];

  let countWhere = `WHERE organization_id = $1`;
  let selectWhere = `WHERE organization_id = $1`;

  if (filters.status) {
    countParams.push(filters.status);
    selectParams.push(filters.status);
    const idx = countParams.length;
    countWhere += ` AND status = $${idx}`;
    selectWhere += ` AND status = $${idx}`;
  }

  selectParams.push(limit);
  const limitParam = `$${selectParams.length}`;
  selectParams.push(offset);
  const offsetParam = `$${selectParams.length}`;

  const countResult = await pool.query(
    `SELECT COUNT(*)::int AS total FROM places ${countWhere}`,
    countParams
  );
  const selectResult = await pool.query(
    `SELECT ${PLACE_COLUMNS} FROM places ${selectWhere} ORDER BY created_at DESC LIMIT ${limitParam} OFFSET ${offsetParam}`,
    selectParams
  );

  return {
    places: selectResult.rows,
    total: countResult.rows[0].total,
    page,
    limit,
  };
}

export async function getPlace(orgId: string, placeId: string): Promise<Place> {
  const result = await pool.query(
    `SELECT ${PLACE_COLUMNS} FROM places WHERE id = $1 AND organization_id = $2`,
    [placeId, orgId]
  );
  if (!result.rows[0]) throw makeAppError('Place not found', 404, 'PLACE_NOT_FOUND');
  return result.rows[0];
}

export type UpdatePlaceData = Partial<CreatePlaceData>;

export async function updatePlace(
  orgId: string,
  placeId: string,
  data: UpdatePlaceData
): Promise<Place> {
  if ('name' in data && (!data.name || data.name.trim() === '')) {
    throw makeAppError('Name is required', 400, 'NAME_REQUIRED');
  }

  const updatable: (keyof UpdatePlaceData)[] = [
    'name', 'category', 'address', 'city', 'country', 'description',
    'logo_url', 'cover_url', 'phone', 'whatsapp', 'website_url', 'booking_url',
  ];

  const fields: string[] = [];
  const values: unknown[] = [];
  let paramIndex = 1;

  for (const key of updatable) {
    if (key in data) {
      fields.push(`${key} = $${paramIndex++}`);
      values.push(key === 'name' ? (data[key] as string).trim() : data[key]);
    }
  }

  if (fields.length === 0) return getPlace(orgId, placeId);

  fields.push(`updated_at = NOW()`);
  values.push(placeId, orgId);

  const result = await pool.query(
    `UPDATE places SET ${fields.join(', ')}
     WHERE id = $${paramIndex++} AND organization_id = $${paramIndex}
     RETURNING ${PLACE_COLUMNS}`,
    values
  );

  if (!result.rows[0]) throw makeAppError('Place not found', 404, 'PLACE_NOT_FOUND');
  return result.rows[0];
}

export async function deletePlace(orgId: string, placeId: string): Promise<void> {
  const countResult = await pool.query(
    `SELECT COUNT(*)::int AS count
     FROM visits v
     JOIN places p ON p.id = v.place_id
     WHERE p.id = $1 AND p.organization_id = $2 AND v.publication_status = 'published'`,
    [placeId, orgId]
  );

  if (countResult.rows[0].count > 0) {
    throw makeAppError(
      'Cannot delete a place with published visits',
      409,
      'PLACE_HAS_ACTIVE_VISITS'
    );
  }

  await pool.query(
    `DELETE FROM places WHERE id = $1 AND organization_id = $2`,
    [placeId, orgId]
  );
}

export async function setPlaceStatus(
  orgId: string,
  placeId: string,
  status: 'active' | 'archived'
): Promise<Place> {
  const result = await pool.query(
    `UPDATE places SET status = $1, updated_at = NOW()
     WHERE id = $2 AND organization_id = $3
     RETURNING ${PLACE_COLUMNS}`,
    [status, placeId, orgId]
  );
  if (!result.rows[0]) throw makeAppError('Place not found', 404, 'PLACE_NOT_FOUND');
  return result.rows[0];
}

export async function createPlace(orgId: string, data: CreatePlaceData): Promise<Place> {
  if (!data.name || data.name.trim() === '') {
    throw makeAppError('Name is required', 400, 'NAME_REQUIRED');
  }

  const result = await pool.query(
    `INSERT INTO places (organization_id, name, category, address, city, country, description,
       logo_url, cover_url, phone, whatsapp, website_url, booking_url)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
     RETURNING ${PLACE_COLUMNS}`,
    [
      orgId,
      data.name.trim(),
      data.category ?? null,
      data.address ?? null,
      data.city ?? null,
      data.country ?? null,
      data.description ?? null,
      data.logo_url ?? null,
      data.cover_url ?? null,
      data.phone ?? null,
      data.whatsapp ?? null,
      data.website_url ?? null,
      data.booking_url ?? null,
    ]
  );
  return result.rows[0];
}
