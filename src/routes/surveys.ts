import { Router, Request, Response, NextFunction } from 'express';
import { authenticate, authorize } from '../middleware/auth';
import {
  listSurveys,
  getSurvey,
  createSurvey,
  updateSurvey,
  deleteSurvey,
  addQuestion,
  updateQuestion,
  deleteQuestion,
  submitResponse,
  listResponses,
} from '../services/survey.service';
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
  res.json(await listSurveys(req.user!.orgId, { page, limit }));
});

router.post('/', authenticate, authorize('owner', 'admin', 'editor'), async (req: Request, res: Response, next: NextFunction) => {
  if (!req.body.visit_id) return next(badRequest('visit_id is required', 'VISIT_ID_REQUIRED'));
  if (!req.body.title) return next(badRequest('title is required', 'TITLE_REQUIRED'));
  res.status(201).json(await createSurvey(req.user!.orgId, req.body));
});

// Specific sub-resource routes BEFORE /:id to avoid Express conflicts
router.get('/:id/responses', authenticate, authorize('owner', 'admin'), async (req: Request, res: Response) => {
  const page = req.query.page ? parseInt(req.query.page as string, 10) : 1;
  const limit = req.query.limit ? parseInt(req.query.limit as string, 10) : 20;
  res.json(await listResponses(req.user!.orgId, String(req.params.id), { page, limit }));
});

router.post('/:id/responses', async (req: Request, res: Response, next: NextFunction) => {
  // public — no auth
  if (!req.body.visit_id) return next(badRequest('visit_id is required', 'VISIT_ID_REQUIRED'));
  res.status(201).json(await submitResponse(String(req.params.id), req.body));
});

router.post('/:id/questions', authenticate, authorize('owner', 'admin', 'editor'), async (req: Request, res: Response, next: NextFunction) => {
  if (!req.body.label) return next(badRequest('label is required', 'LABEL_REQUIRED'));
  if (!req.body.type) return next(badRequest('type is required', 'TYPE_REQUIRED'));
  res.status(201).json(await addQuestion(req.user!.orgId, String(req.params.id), req.body));
});

router.patch('/:id/questions/:qId', authenticate, authorize('owner', 'admin', 'editor'), async (req: Request, res: Response) => {
  res.json(await updateQuestion(req.user!.orgId, String(req.params.id), String(req.params.qId), req.body));
});

router.delete('/:id/questions/:qId', authenticate, authorize('owner', 'admin'), async (req: Request, res: Response) => {
  await deleteQuestion(req.user!.orgId, String(req.params.id), String(req.params.qId));
  res.sendStatus(204);
});

router.get('/:id', authenticate, async (req: Request, res: Response) => {
  res.json(await getSurvey(req.user!.orgId, String(req.params.id)));
});

router.patch('/:id', authenticate, authorize('owner', 'admin', 'editor'), async (req: Request, res: Response) => {
  res.json(await updateSurvey(req.user!.orgId, String(req.params.id), req.body));
});

router.delete('/:id', authenticate, authorize('owner', 'admin'), async (req: Request, res: Response) => {
  await deleteSurvey(req.user!.orgId, String(req.params.id));
  res.sendStatus(204);
});

export default router;
