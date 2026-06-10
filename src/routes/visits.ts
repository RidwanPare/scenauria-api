import { Router, Request, Response, NextFunction } from 'express';
import { authenticate, authorize } from '../middleware/auth';
import {
  listVisits,
  getVisit,
  getVisitBySlug,
  createVisit,
  updateVisit,
  deleteVisit,
  setPublicationStatus,
} from '../services/visit.service';
import { getQrCodesByVisit } from '../services/qrcode.service';
import { getHotspotsByVisit } from '../services/hotspot.service';
import { getCtaButtonsByVisit } from '../services/cta.service';
import { getSurveyByVisit } from '../services/survey.service';
import { AppError } from '../middleware/errorHandler';

const router = Router();
export const publicVisitRouter = Router();

function badRequest(message: string, code: string): AppError {
  const err = new Error(message) as AppError;
  err.statusCode = 400;
  err.code = code;
  return err;
}

router.get('/', authenticate, async (req: Request, res: Response) => {
  const page = req.query.page ? parseInt(req.query.page as string, 10) : 1;
  const limit = req.query.limit ? parseInt(req.query.limit as string, 10) : 20;
  const publication_status = req.query.publication_status as string | undefined;
  const place_id = req.query.place_id as string | undefined;

  const result = await listVisits(req.user!.orgId, { publication_status, place_id, page, limit });
  res.json(result);
});

router.post('/', authenticate, authorize('owner', 'admin', 'editor'), async (req: Request, res: Response, next: NextFunction) => {
  const { place_id } = req.body;
  if (!place_id || typeof place_id !== 'string') {
    return next(badRequest('place_id is required', 'PLACE_ID_REQUIRED'));
  }

  const visit = await createVisit(req.user!.orgId, req.body);
  res.status(201).json(visit);
});

// Sub-resource and action routes BEFORE /:id to avoid Express conflicts
router.get('/:visitId/qrcodes', authenticate, async (req: Request, res: Response) => {
  const result = await getQrCodesByVisit(req.user!.orgId, String(req.params.visitId));
  res.json(result);
});

router.get('/:visitId/hotspots', authenticate, async (req: Request, res: Response) => {
  const result = await getHotspotsByVisit(req.user!.orgId, String(req.params.visitId));
  res.json(result);
});

router.get('/:visitId/cta', authenticate, async (req: Request, res: Response) => {
  const result = await getCtaButtonsByVisit(req.user!.orgId, String(req.params.visitId));
  res.json(result);
});

router.get('/:visitId/survey', authenticate, async (req: Request, res: Response) => {
  const result = await getSurveyByVisit(req.user!.orgId, String(req.params.visitId));
  res.json(result);
});

// Action routes BEFORE /:id to avoid Express conflicts
router.post('/:id/publish', authenticate, authorize('owner', 'admin', 'editor'), async (req: Request, res: Response) => {
  const visit = await setPublicationStatus(req.user!.orgId, String(req.params.id), 'publish');
  res.json(visit);
});

router.post('/:id/pause', authenticate, authorize('owner', 'admin', 'editor'), async (req: Request, res: Response) => {
  const visit = await setPublicationStatus(req.user!.orgId, String(req.params.id), 'pause');
  res.json(visit);
});

router.post('/:id/unpublish', authenticate, authorize('owner', 'admin', 'editor'), async (req: Request, res: Response) => {
  const visit = await setPublicationStatus(req.user!.orgId, String(req.params.id), 'unpublish');
  res.json(visit);
});

router.get('/:id', authenticate, async (req: Request, res: Response) => {
  const visit = await getVisit(req.user!.orgId, String(req.params.id));
  res.json(visit);
});

router.patch('/:id', authenticate, authorize('owner', 'admin', 'editor'), async (req: Request, res: Response) => {
  const visit = await updateVisit(req.user!.orgId, String(req.params.id), req.body);
  res.json(visit);
});

router.delete('/:id', authenticate, authorize('owner', 'admin'), async (req: Request, res: Response) => {
  await deleteVisit(req.user!.orgId, String(req.params.id));
  res.sendStatus(204);
});

// Public route — no authenticate
publicVisitRouter.get('/:slug', async (req: Request, res: Response) => {
  const visit = await getVisitBySlug(String(req.params.slug));
  res.json(visit);
});

export default router;
