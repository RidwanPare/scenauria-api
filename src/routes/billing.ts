import { Router, Request, Response } from 'express';
import { authenticate, authorize } from '../middleware/auth';
import { getSubscription, listInvoices, handleStripeWebhook } from '../services/billing.service';

const router = Router();

// Public webhook — raw body (Express json middleware won't parse this)
router.post('/webhook', async (req: Request, res: Response) => {
  const signature = (req.headers['stripe-signature'] as string) ?? '';
  const payload = JSON.stringify(req.body); // in prod: use raw body
  await handleStripeWebhook(payload, signature);
  res.json({ received: true });
});

// Owner-only billing routes
router.get('/subscription', authenticate, authorize('owner'), async (req: Request, res: Response) => {
  const subscription = await getSubscription(req.user!.orgId);
  res.json({ subscription });
});

router.get('/invoices', authenticate, authorize('owner'), async (req: Request, res: Response) => {
  const page = req.query.page ? parseInt(req.query.page as string, 10) : 1;
  const limit = req.query.limit ? parseInt(req.query.limit as string, 10) : 20;
  res.json(await listInvoices(req.user!.orgId, { page, limit }));
});

export default router;
