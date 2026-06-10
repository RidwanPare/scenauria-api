import { Router, Request, Response, NextFunction } from 'express';
import { authenticate, authorize } from '../middleware/auth';
import {
  listQrCodes,
  getQrCode,
  createQrCode,
  updateQrCode,
  deleteQrCode,
} from '../services/qrcode.service';
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

  const result = await listQrCodes(req.user!.orgId, { visit_id, page, limit });
  res.json(result);
});

router.post('/', authenticate, authorize('owner', 'admin', 'editor'), async (req: Request, res: Response, next: NextFunction) => {
  const { visit_id, name, tracked_url } = req.body;
  if (!visit_id || typeof visit_id !== 'string') {
    return next(badRequest('visit_id is required', 'VISIT_ID_REQUIRED'));
  }
  if (!name || typeof name !== 'string') {
    return next(badRequest('name is required', 'NAME_REQUIRED'));
  }
  if (!tracked_url || typeof tracked_url !== 'string') {
    return next(badRequest('tracked_url is required', 'TRACKED_URL_REQUIRED'));
  }

  const qrcode = await createQrCode(req.user!.orgId, req.body);
  res.status(201).json(qrcode);
});

router.get('/:id', authenticate, async (req: Request, res: Response) => {
  const qrcode = await getQrCode(req.user!.orgId, String(req.params.id));
  res.json(qrcode);
});

router.patch('/:id', authenticate, authorize('owner', 'admin', 'editor'), async (req: Request, res: Response) => {
  const qrcode = await updateQrCode(req.user!.orgId, String(req.params.id), req.body);
  res.json(qrcode);
});

router.delete('/:id', authenticate, authorize('owner', 'admin'), async (req: Request, res: Response) => {
  await deleteQrCode(req.user!.orgId, String(req.params.id));
  res.sendStatus(204);
});

export default router;
