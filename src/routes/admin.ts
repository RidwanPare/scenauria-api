import { Router, Request, Response, NextFunction } from 'express';
import { authenticate } from '../middleware/auth';
import { listUsers, getUser, updateUserStatus, listOrganizations, getOrganization, updateOrgPlan, getGlobalStats } from '../services/admin.service';

const router = Router();

function requireSuperadmin(req: Request, res: Response, next: NextFunction): void {
  if (req.user?.role !== 'superadmin') {
    const err: any = new Error('Superadmin access required'); err.statusCode = 403; err.code = 'FORBIDDEN'; next(err);
  } else {
    next();
  }
}

router.use(authenticate, requireSuperadmin);

router.get('/stats', async (req: Request, res: Response) => {
  res.json(await getGlobalStats());
});

router.get('/users', async (req: Request, res: Response) => {
  const page = req.query.page ? parseInt(req.query.page as string, 10) : 1;
  const limit = req.query.limit ? parseInt(req.query.limit as string, 10) : 20;
  const status = req.query.status as string | undefined;
  res.json(await listUsers({ page, limit, status }));
});

router.get('/users/:id', async (req: Request, res: Response) => {
  res.json(await getUser(String(req.params.id)));
});

router.patch('/users/:id', async (req: Request, res: Response) => {
  res.json(await updateUserStatus(String(req.params.id), req.body.status));
});

router.get('/organizations', async (req: Request, res: Response) => {
  const page = req.query.page ? parseInt(req.query.page as string, 10) : 1;
  const limit = req.query.limit ? parseInt(req.query.limit as string, 10) : 20;
  res.json(await listOrganizations({ page, limit }));
});

router.get('/organizations/:id', async (req: Request, res: Response) => {
  res.json(await getOrganization(String(req.params.id)));
});

router.patch('/organizations/:id', async (req: Request, res: Response) => {
  res.json(await updateOrgPlan(String(req.params.id), req.body.plan));
});

export default router;
