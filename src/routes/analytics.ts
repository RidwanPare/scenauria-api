import { Router, Request, Response } from 'express';
import { authenticate } from '../middleware/auth';
import { ingestEvent, listEvents, getSummary, getVisitStats } from '../services/analytics.service';

const router = Router();

// Public — no auth
router.post('/events', async (req: Request, res: Response) => {
  const { visit_id, place_id, event_type } = req.body;
  if (!visit_id || !place_id || !event_type) {
    const err: any = new Error('visit_id, place_id and event_type are required');
    err.statusCode = 400; err.code = 'INVALID_EVENT';
    throw err;
  }
  const event = await ingestEvent(req.body);
  res.status(201).json(event);
});

// Auth routes
router.get('/summary', authenticate, async (req: Request, res: Response) => {
  res.json(await getSummary(req.user!.orgId));
});

router.get('/visits/:visitId', authenticate, async (req: Request, res: Response) => {
  res.json(await getVisitStats(req.user!.orgId, String(req.params.visitId)));
});

router.get('/events', authenticate, async (req: Request, res: Response) => {
  const page = req.query.page ? parseInt(req.query.page as string, 10) : 1;
  const limit = req.query.limit ? parseInt(req.query.limit as string, 10) : 50;
  const { visit_id, place_id, event_type, date_from, date_to } = req.query as Record<string, string | undefined>;
  res.json(await listEvents(req.user!.orgId, { visit_id, place_id, event_type, date_from, date_to, page, limit }));
});

export default router;
