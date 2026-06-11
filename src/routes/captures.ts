import { Router, Request, Response, NextFunction } from 'express';
import { authenticate, authorize } from '../middleware/auth';
import {
  listCaptures,
  getCapture,
  createCapture,
  updateCapture,
  deleteCapture,
} from '../services/capture.service';
import { AppError } from '../middleware/errorHandler';
import { workerAuth } from '../middleware/workerAuth';
import { updateCaptureStatusFromWorker } from '../services/capture.service';
import { enqueueProcessCapture } from '../services/queue.service';

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
  const status = req.query.status as string | undefined;
  const place_id = req.query.place_id as string | undefined;

  const result = await listCaptures(req.user!.orgId, { status, place_id, page, limit });
  res.json(result);
});

router.post('/', authenticate, authorize('owner', 'admin', 'editor'), async (req: Request, res: Response, next: NextFunction) => {
  const { place_id, video_url } = req.body;
  if (!place_id || typeof place_id !== 'string') {
    return next(badRequest('place_id is required', 'PLACE_ID_REQUIRED'));
  }

  const capture = await createCapture(req.user!.orgId, place_id, { video_url });

  // Lance le pipeline de traitement si une vidéo est fournie
  if (video_url) {
    try {
      await enqueueProcessCapture(capture.id, place_id, video_url);
    } catch (e) {
      // Queue indisponible : la capture reste en "uploaded", relançable plus tard
      console.error('enqueueProcessCapture failed:', e);
    }
  }

  res.status(201).json(capture);
});

// Callback worker (X-Worker-Secret) — avant /:id pour priorité de matching
router.patch('/:id/status', workerAuth, async (req: Request, res: Response, next: NextFunction) => {
  const { status } = req.body;
  if (!status || typeof status !== 'string') {
    return next(badRequest('status is required', 'STATUS_REQUIRED'));
  }
  const capture = await updateCaptureStatusFromWorker(String(req.params.id), req.body);
  res.json(capture);
});

router.get('/:id', authenticate, async (req: Request, res: Response) => {
  const capture = await getCapture(req.user!.orgId, String(req.params.id));
  res.json(capture);
});

router.patch('/:id', authenticate, authorize('owner', 'admin', 'editor'), async (req: Request, res: Response) => {
  const capture = await updateCapture(req.user!.orgId, String(req.params.id), req.body);
  res.json(capture);
});

router.delete('/:id', authenticate, authorize('owner', 'admin'), async (req: Request, res: Response) => {
  await deleteCapture(req.user!.orgId, String(req.params.id));
  res.sendStatus(204);
});

export default router;
