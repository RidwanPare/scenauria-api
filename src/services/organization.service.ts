import pool from '../db/client';
import { makeAppError } from './auth.service';

const VALID_CURRENCIES = ['EUR', 'USD', 'GBP', 'CHF', 'CAD'];

export interface OrgProfile {
  id: string;
  name: string;
  business_type: string | null;
  country: string | null;
  currency: string;
  plan: string;
  subscription_status: string;
  owner_id: string;
  created_at: string;
  updated_at: string;
}

export interface UpdateProfileData {
  name?: string;
  business_type?: string | null;
  country?: string | null;
  currency?: string;
}

export async function getProfile(orgId: string): Promise<OrgProfile> {
  const result = await pool.query(
    `SELECT id, name, business_type, country, currency, plan, subscription_status,
            owner_id, created_at, updated_at
     FROM organizations WHERE id = $1`,
    [orgId]
  );
  if (!result.rows[0]) throw makeAppError('Organization not found', 404, 'ORG_NOT_FOUND');
  return result.rows[0];
}

export async function updateProfile(orgId: string, data: UpdateProfileData): Promise<OrgProfile> {
  if ('name' in data && (!data.name || (data.name as string).trim() === '')) {
    throw makeAppError('Name cannot be empty', 400, 'NAME_REQUIRED');
  }
  if ('currency' in data && data.currency && !VALID_CURRENCIES.includes(data.currency)) {
    throw makeAppError(`Currency must be one of: ${VALID_CURRENCIES.join(', ')}`, 400, 'INVALID_CURRENCY');
  }

  const fields: string[] = [];
  const values: unknown[] = [];
  let paramIndex = 1;

  if (data.name !== undefined) { fields.push(`name = $${paramIndex++}`); values.push(data.name); }
  if ('business_type' in data) { fields.push(`business_type = $${paramIndex++}`); values.push(data.business_type); }
  if ('country' in data) { fields.push(`country = $${paramIndex++}`); values.push(data.country); }
  if (data.currency !== undefined) { fields.push(`currency = $${paramIndex++}`); values.push(data.currency); }

  if (fields.length === 0) return getProfile(orgId);

  fields.push(`updated_at = NOW()`);
  values.push(orgId);

  const result = await pool.query(
    `UPDATE organizations SET ${fields.join(', ')}
     WHERE id = $${paramIndex}
     RETURNING id, name, business_type, country, currency, plan, subscription_status,
               owner_id, created_at, updated_at`,
    values
  );
  return result.rows[0];
}
