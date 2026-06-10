import pool from '../db/client';

export interface Subscription {
  id: string;
  organization_id: string;
  stripe_subscription_id: string | null;
  plan: string;
  billing_interval: string;
  status: string;
  current_period_start: string | null;
  current_period_end: string | null;
  canceled_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface Invoice {
  id: string;
  organization_id: string;
  subscription_id: string | null;
  stripe_invoice_id: string | null;
  type: string;
  amount_cents: number;
  currency: string;
  status: string;
  paid_at: string | null;
  created_at: string;
}

export async function getSubscription(orgId: string): Promise<Subscription | null> {
  const result = await pool.query(
    `SELECT id, organization_id, stripe_subscription_id, plan, billing_interval, status, current_period_start, current_period_end, canceled_at, created_at, updated_at
     FROM subscriptions WHERE organization_id = $1 AND status NOT IN ('canceled') ORDER BY created_at DESC LIMIT 1`,
    [orgId]
  );
  return result.rows[0] ?? null;
}

export async function listInvoices(
  orgId: string,
  filters: { page?: number; limit?: number }
): Promise<{ invoices: Invoice[]; total: number; page: number; limit: number }> {
  const page = Math.max(1, filters.page ?? 1);
  const limit = Math.min(100, Math.max(1, filters.limit ?? 20));
  const offset = (page - 1) * limit;

  const countResult = await pool.query(
    `SELECT COUNT(*)::int AS total FROM invoices WHERE organization_id = $1`,
    [orgId]
  );
  const selectResult = await pool.query(
    `SELECT id, organization_id, subscription_id, stripe_invoice_id, type, amount_cents, currency, status, paid_at, created_at
     FROM invoices WHERE organization_id = $1 ORDER BY created_at DESC LIMIT $2 OFFSET $3`,
    [orgId, limit, offset]
  );

  return { invoices: selectResult.rows, total: countResult.rows[0].total, page, limit };
}

// Stripe webhook handler — processes raw body
export async function handleStripeWebhook(payload: string, signature: string): Promise<void> {
  // Minimal implementation: just acknowledge
  // Real Stripe signature verification would use stripe.webhooks.constructEvent()
  // but requires STRIPE_WEBHOOK_SECRET and the stripe package configured
  // For now, log and return (future: process event types subscription.updated, invoice.paid, etc.)
  if (!signature) {
    throw Object.assign(new Error('Missing stripe-signature'), { statusCode: 400, code: 'MISSING_SIGNATURE' });
  }
  // In production: verify signature here
}
