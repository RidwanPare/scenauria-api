import pool from '../db/client';

export async function listUsers(filters: { page?: number; limit?: number; status?: string }): Promise<{ users: any[]; total: number; page: number; limit: number }> {
  const page = Math.max(1, filters.page ?? 1);
  const limit = Math.min(100, Math.max(1, filters.limit ?? 20));
  const offset = (page - 1) * limit;

  const params: unknown[] = [];
  let extraWhere = '';
  if (filters.status) { params.push(filters.status); extraWhere = `WHERE status = $${params.length}`; }

  const countParams = [...params];
  const selectParams = [...params, limit, offset];

  const countResult = await pool.query(`SELECT COUNT(*)::int AS total FROM users ${extraWhere}`, countParams);
  const selectResult = await pool.query(
    `SELECT id, email, first_name, last_name, locale, status, created_at FROM users ${extraWhere} ORDER BY created_at DESC LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
    selectParams
  );
  return { users: selectResult.rows, total: countResult.rows[0].total, page, limit };
}

export async function getUser(userId: string): Promise<any> {
  const result = await pool.query(
    `SELECT id, email, first_name, last_name, locale, status, created_at, updated_at FROM users WHERE id = $1`,
    [userId]
  );
  if (!result.rows[0]) {
    const err: any = new Error('User not found'); err.statusCode = 404; err.code = 'USER_NOT_FOUND'; throw err;
  }
  return result.rows[0];
}

export async function updateUserStatus(userId: string, status: string): Promise<any> {
  const VALID = ['active', 'suspended', 'deleted'];
  if (!VALID.includes(status)) {
    const err: any = new Error('Invalid status'); err.statusCode = 400; err.code = 'INVALID_STATUS'; throw err;
  }
  const result = await pool.query(
    `UPDATE users SET status = $1, updated_at = NOW() WHERE id = $2 RETURNING id, email, first_name, last_name, locale, status, updated_at`,
    [status, userId]
  );
  if (!result.rows[0]) {
    const err: any = new Error('User not found'); err.statusCode = 404; err.code = 'USER_NOT_FOUND'; throw err;
  }
  return result.rows[0];
}

export async function listOrganizations(filters: { page?: number; limit?: number }): Promise<{ organizations: any[]; total: number; page: number; limit: number }> {
  const page = Math.max(1, filters.page ?? 1);
  const limit = Math.min(100, Math.max(1, filters.limit ?? 20));
  const offset = (page - 1) * limit;

  const countResult = await pool.query(`SELECT COUNT(*)::int AS total FROM organizations`);
  const selectResult = await pool.query(
    `SELECT id, name, plan, subscription_status, country, created_at FROM organizations ORDER BY created_at DESC LIMIT $1 OFFSET $2`,
    [limit, offset]
  );
  return { organizations: selectResult.rows, total: countResult.rows[0].total, page, limit };
}

export async function getOrganization(orgId: string): Promise<any> {
  const result = await pool.query(
    `SELECT id, name, plan, subscription_status, country, currency, created_at FROM organizations WHERE id = $1`,
    [orgId]
  );
  if (!result.rows[0]) {
    const err: any = new Error('Organization not found'); err.statusCode = 404; err.code = 'ORG_NOT_FOUND'; throw err;
  }
  return result.rows[0];
}

export async function updateOrgPlan(orgId: string, plan: string): Promise<any> {
  const VALID = ['start', 'plus', 'pro', 'multi'];
  if (!VALID.includes(plan)) {
    const err: any = new Error('Invalid plan'); err.statusCode = 400; err.code = 'INVALID_PLAN'; throw err;
  }
  const result = await pool.query(
    `UPDATE organizations SET plan = $1 WHERE id = $2 RETURNING id, name, plan, subscription_status`,
    [plan, orgId]
  );
  if (!result.rows[0]) {
    const err: any = new Error('Organization not found'); err.statusCode = 404; err.code = 'ORG_NOT_FOUND'; throw err;
  }
  return result.rows[0];
}

export async function getGlobalStats(): Promise<Record<string, number>> {
  const [users, orgs, places, visits] = await Promise.all([
    pool.query(`SELECT COUNT(*)::int AS count FROM users`),
    pool.query(`SELECT COUNT(*)::int AS count FROM organizations`),
    pool.query(`SELECT COUNT(*)::int AS count FROM places`),
    pool.query(`SELECT COUNT(*)::int AS count FROM visits`),
  ]);
  return {
    users: users.rows[0].count,
    organizations: orgs.rows[0].count,
    places: places.rows[0].count,
    visits: visits.rows[0].count,
  };
}
