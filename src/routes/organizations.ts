import { Router, Request, Response, NextFunction } from 'express';
import { authenticate, authorize } from '../middleware/auth';
import { inviteByEmail, addExistingUser } from '../services/invitation.service';
import {
  getProfile,
  updateProfile,
  listMembers,
  changeMemberRole,
  removeMember,
  getPlanInfo,
} from '../services/organization.service';
import { AppError } from '../middleware/errorHandler';

const router = Router();
const VALID_ROLES = ['admin', 'editor', 'viewer'];

function badRequest(message: string, code: string): AppError {
  const err = new Error(message) as AppError;
  err.statusCode = 400;
  err.code = code;
  return err;
}

// ─── Routes /me (doivent être avant /:id) ────────────────────────────────────

router.get('/me', authenticate, async (req: Request, res: Response) => {
  const profile = await getProfile(req.user!.orgId);
  res.json(profile);
});

router.patch('/me', authenticate, authorize('owner', 'admin'), async (req: Request, res: Response) => {
  const { name, business_type, country, currency } = req.body;
  const updated = await updateProfile(req.user!.orgId, { name, business_type, country, currency });
  res.json(updated);
});

router.get('/me/members', authenticate, async (req: Request, res: Response) => {
  const result = await listMembers(req.user!.orgId);
  res.json(result);
});

router.patch(
  '/me/members/:userId',
  authenticate,
  authorize('owner'),
  async (req: Request, res: Response, next: NextFunction) => {
    const { role } = req.body;
    if (!role || typeof role !== 'string') return next(badRequest('role required', 'ROLE_REQUIRED'));
    const result = await changeMemberRole(req.user!.orgId, req.params.userId as string, role);
    res.json(result);
  }
);

router.delete(
  '/me/members/:userId',
  authenticate,
  authorize('owner', 'admin'),
  async (req: Request, res: Response) => {
    await removeMember(req.user!.orgId, req.params.userId as string);
    res.sendStatus(204);
  }
);

router.get('/me/plan', authenticate, async (req: Request, res: Response) => {
  const info = await getPlanInfo(req.user!.orgId);
  res.json(info);
});

// ─── Routes /:id ─────────────────────────────────────────────────────────────

router.post(
  '/:id/members/invite',
  authenticate,
  authorize('owner', 'admin'),
  async (req: Request, res: Response, next: NextFunction) => {
    const { email, role = 'editor' } = req.body;
    if (!email || typeof email !== 'string') return next(badRequest('Email required', 'EMAIL_REQUIRED'));
    if (!VALID_ROLES.includes(role)) return next(badRequest('Invalid role', 'INVALID_ROLE'));

    if (req.user!.orgId !== req.params.id) {
      const err = new Error('Access denied to this organization') as AppError;
      err.statusCode = 403;
      err.code = 'FORBIDDEN';
      return next(err);
    }

    await inviteByEmail(req.params.id as string, req.user!.userId, email, role);
    res.status(201).json({ message: 'Invitation sent.' });
  }
);

router.post(
  '/:id/members/add',
  authenticate,
  authorize('owner', 'admin'),
  async (req: Request, res: Response, next: NextFunction) => {
    const { email, role = 'editor' } = req.body;
    if (!email || typeof email !== 'string') return next(badRequest('Email required', 'EMAIL_REQUIRED'));
    if (!VALID_ROLES.includes(role)) return next(badRequest('Invalid role', 'INVALID_ROLE'));

    if (req.user!.orgId !== req.params.id) {
      const err = new Error('Access denied to this organization') as AppError;
      err.statusCode = 403;
      err.code = 'FORBIDDEN';
      return next(err);
    }

    await addExistingUser(req.params.id as string, email, role);
    res.status(201).json({ message: 'Member added.' });
  }
);

export default router;
