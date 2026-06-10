import { Router, Request, Response, NextFunction } from 'express';
import { authenticate, authorize } from '../middleware/auth';
import {
  listCtaButtons,
  getCtaButton,
  createCtaButton,
  updateCtaButton,
  deleteCtaButton,
} from '../services/cta.service';
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

  const result = await listCtaButtons(req.user!.orgId, { visit_id, page, limit });
  res.json(result);
});

router.post('/', authenticate, authorize('owner', 'admin', 'editor'), async (req: Request, res: Response, next: NextFunction) => {
  const { visit_id, label, type } = req.body;
  if (!visit_id || typeof visit_id !== 'string') {
    return next(badRequest('visit_id is required', 'VISIT_ID_REQUIRED'));
  }
  if (!label || typeof label !== 'string') {
    return next(badRequest('label is required', 'LABEL_REQUIRED'));
  }
  if (!type || typeof type !== 'string') {
    return next(badRequest('type is required', 'TYPE_REQUIRED'));
  }

  const cta = await createCtaButton(req.user!.orgId, req.body);
  res.status(201).json(cta);
});

router.get('/:id', authenticate, async (req: Request, res: Response) => {
  const cta = await getCtaButton(req.user!.orgId, String(req.params.id));
  res.json(cta);
});

router.patch('/:id', authenticate, authorize('owner', 'admin', 'editor'), async (req: Request, res: Response) => {
  const cta = await updateCtaButton(req.user!.orgId, String(req.params.id), req.body);
  res.json(cta);
});

router.delete('/:id', authenticate, authorize('owner', 'admin'), async (req: Request, res: Response) => {
  await deleteCtaButton(req.user!.orgId, String(req.params.id));
  res.sendStatus(204);
});

export default router;
