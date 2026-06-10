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
  if (!result.rows[0]) throw makeAppError('Organization not found', 404, 'ORG_NOT_FOUND');
  return result.rows[0];
}

export interface MemberEntry {
  id: string;
  user_id: string;
  email: string;
  first_name: string | null;
  last_name: string | null;
  avatar_url: string | null;
  role: string;
  joined_at: string;
}

const MEMBER_ROLES = ['admin', 'editor', 'viewer'];

async function getMemberAndOwner(
  orgId: string,
  targetUserId: string
): Promise<{ member: { id: string; user_id: string; role: string }; ownerId: string }> {
  const memberResult = await pool.query(
    `SELECT id, user_id, role FROM organization_members
     WHERE organization_id = $1 AND user_id = $2`,
    [orgId, targetUserId]
  );
  if (!memberResult.rows[0]) throw makeAppError('Member not found', 404, 'MEMBER_NOT_FOUND');

  const orgResult = await pool.query(
    `SELECT owner_id FROM organizations WHERE id = $1`,
    [orgId]
  );
  return { member: memberResult.rows[0], ownerId: orgResult.rows[0].owner_id };
}

export async function listMembers(orgId: string): Promise<{ members: MemberEntry[] }> {
  const result = await pool.query(
    `SELECT om.id, om.user_id, u.email, u.first_name, u.last_name, u.avatar_url,
            om.role, om.created_at AS joined_at
     FROM organization_members om
     JOIN users u ON u.id = om.user_id
     WHERE om.organization_id = $1
     ORDER BY om.created_at ASC`,
    [orgId]
  );
  return { members: result.rows };
}

export async function changeMemberRole(
  orgId: string,
  targetUserId: string,
  newRole: string
): Promise<{ user_id: string; role: string }> {
  if (!MEMBER_ROLES.includes(newRole)) {
    throw makeAppError(`Role must be one of: ${MEMBER_ROLES.join(', ')}`, 400, 'INVALID_ROLE');
  }

  const { member, ownerId } = await getMemberAndOwner(orgId, targetUserId);
  if (member.user_id === ownerId) {
    throw makeAppError('Cannot change owner role', 403, 'CANNOT_CHANGE_OWNER_ROLE');
  }

  const updateResult = await pool.query(
    `UPDATE organization_members SET role = $1
     WHERE organization_id = $2 AND user_id = $3
     RETURNING user_id, role`,
    [newRole, orgId, targetUserId]
  );
  return updateResult.rows[0];
}

export async function removeMember(orgId: string, targetUserId: string): Promise<void> {
  const { member, ownerId } = await getMemberAndOwner(orgId, targetUserId);
  if (member.user_id === ownerId) {
    throw makeAppError('Cannot remove the organization owner', 403, 'CANNOT_REMOVE_OWNER');
  }

  await pool.query(
    `DELETE FROM organization_members WHERE organization_id = $1 AND user_id = $2`,
    [orgId, targetUserId]
  );
}

export interface PlanInfo {
  plan: string;
  subscription_status: string;
  billing_interval: string | null;
  current_period_end: string | null;
  usage: {
    places_count: number;
    published_visits_count: number;
    active_captures_count: number;
    members_count: number;
  };
}

export async function getPlanInfo(orgId: string): Promise<PlanInfo> {
  const orgResult = await pool.query(
    `SELECT plan, subscription_status FROM organizations WHERE id = $1`,
    [orgId]
  );
  if (!orgResult.rows[0]) throw makeAppError('Organization not found', 404, 'ORG_NOT_FOUND');
  const { plan, subscription_status } = orgResult.rows[0];

  const [subResult, placesResult, visitsResult, capturesResult, membersResult] = await Promise.all([
    pool.query(
      `SELECT billing_interval, current_period_end
       FROM subscriptions WHERE organization_id = $1
       ORDER BY created_at DESC LIMIT 1`,
      [orgId]
    ),
    pool.query(
      `SELECT COUNT(*)::int AS count FROM places WHERE organization_id = $1`,
      [orgId]
    ),
    pool.query(
      `SELECT COUNT(*)::int AS count FROM visits v
       JOIN places p ON p.id = v.place_id
       WHERE p.organization_id = $1 AND v.publication_status = 'published'`,
      [orgId]
    ),
    pool.query(
      `SELECT COUNT(*)::int AS count FROM captures c
       JOIN places p ON p.id = c.place_id
       WHERE p.organization_id = $1 AND c.status NOT IN ('failed', 'draft')`,
      [orgId]
    ),
    pool.query(
      `SELECT COUNT(*)::int AS count FROM organization_members WHERE organization_id = $1`,
      [orgId]
    ),
  ]);

  const sub = subResult.rows[0];

  return {
    plan,
    subscription_status,
    billing_interval: sub?.billing_interval ?? null,
    current_period_end: sub?.current_period_end ?? null,
    usage: {
      places_count: placesResult.rows[0].count,
      published_visits_count: visitsResult.rows[0].count,
      active_captures_count: capturesResult.rows[0].count,
      members_count: membersResult.rows[0].count,
    },
  };
}
