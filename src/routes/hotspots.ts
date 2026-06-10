import { Router, Request, Response, NextFunction } from 'express';
import { authenticate, authorize } from '../middleware/auth';
import {
  listHotspots,
  getHotspot,
  createHotspot,
  updateHotspot,
  deleteHotspot,
} from '../services/hotspot.service';
import { AppError } from '../middleware/errorHandler';

const router = Router();

function badRequest(message: string, code: string): AppError {
  const err = new Error(message) as AppError;
  err.statusCode = 400;
  err.code = code;
  return err;
}

router.get('/', authenticate, async (req: Request, res: Response) => {
  const page = req.query.page ? parseInt(req.query.page as string, 10) : 1;
  const limit = req.query.limit ? parseInt(req.query.limit as string, 10) : 20;
  const visit_id = req.query.visit_id as string | undefined;

  const result = await listHotspots(req.user!.orgId, { visit_id, page, limit });
  res.json(result);
});

router.post('/', authenticate, authorize('owner', 'admin', 'editor'), async (req: Request, res: Response, next: NextFunction) => {
  const { visit_id, title, type } = req.body;
  if (!visit_id || typeof visit_id !== 'string') {
    return next(badRequest('visit_id is required', 'VISIT_ID_REQUIRED'));
  }
  if (!title || typeof title !== 'string') {
    return next(badRequest('title is required', 'TITLE_REQUIRED'));
  }
  if (!type || typeof type !== 'string') {
    return next(badRequest('type is required', 'TYPE_REQUIRED'));
  }

  const hotspot = await createHotspot(req.user!.orgId, req.body);
  res.status(201).json(hotspot);
});

router.get('/:id', authenticate, async (req: Request, res: Response) => {
  const hotspot = await getHotspot(req.user!.orgId, String(req.params.id));
  res.json(hotspot);
});

router.patch('/:id', authenticate, authorize('owner', 'admin', 'editor'), async (req: Request, res: Response) => {
  const hotspot = await updateHotspot(req.user!.orgId, String(req.params.id), req.body);
  res.json(hotspot);
});

router.delete('/:id', authenticate, authorize('owner', 'admin'), async (req: Request, res: Response) => {
  await deleteHotspot(req.user!.orgId, String(req.params.id));
  res.sendStatus(204);
});

export default router;
