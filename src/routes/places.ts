import { Router, Request, Response } from 'express';
import { authenticate, authorize } from '../middleware/auth';
import {
  listPlaces,
  getPlace,
  createPlace,
  updatePlace,
  deletePlace,
  setPlaceStatus,
} from '../services/place.service';
import { getCapturesByPlace } from '../services/capture.service';

const router = Router();

router.get('/', authenticate, async (req: Request, res: Response) => {
  const page = req.query.page ? parseInt(req.query.page as string, 10) : 1;
  const limit = req.query.limit ? parseInt(req.query.limit as string, 10) : 20;
  const status = req.query.status as string | undefined;

  const result = await listPlaces(req.user!.orgId, { status, page, limit });
  res.json(result);
});

router.post('/', authenticate, authorize('owner', 'admin', 'editor'), async (req: Request, res: Response) => {
  const place = await createPlace(req.user!.orgId, req.body);
  res.status(201).json(place);
});

router.get('/:placeId/captures', authenticate, async (req: Request, res: Response) => {
  const result = await getCapturesByPlace(req.user!.orgId, String(req.params.placeId));
  res.json(result);
});

router.get('/:id', authenticate, async (req: Request, res: Response) => {
  const place = await getPlace(req.user!.orgId, String(req.params.id));
  res.json(place);
});

router.patch('/:id', authenticate, authorize('owner', 'admin', 'editor'), async (req: Request, res: Response) => {
  const place = await updatePlace(req.user!.orgId, String(req.params.id), req.body);
  res.json(place);
});

router.delete('/:id', authenticate, authorize('owner', 'admin'), async (req: Request, res: Response) => {
  await deletePlace(req.user!.orgId, String(req.params.id));
  res.sendStatus(204);
});

router.post('/:id/archive', authenticate, authorize('owner', 'admin'), async (req: Request, res: Response) => {
  const place = await setPlaceStatus(req.user!.orgId, String(req.params.id), 'archived');
  res.json(place);
});

router.post('/:id/restore', authenticate, authorize('owner', 'admin'), async (req: Request, res: Response) => {
  const place = await setPlaceStatus(req.user!.orgId, String(req.params.id), 'active');
  res.json(place);
});

export default router;
