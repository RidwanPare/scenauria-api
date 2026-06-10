import { Router, Request, Response, NextFunction } from 'express';
import { authenticate, authorize } from '../middleware/auth';
import { inviteByEmail, addExistingUser } from '../services/invitation.service';
import { AppError } from '../middleware/errorHandler';

const router = Router();
const VALID_ROLES = ['admin', 'editor', 'viewer'];

function badRequest(message: string, code: string): AppError {
  const err = new Error(message) as AppError;
  err.statusCode = 400;
  err.code = code;
  return err;
}

// POST /organizations/:id/members/invite
router.post(
  '/:id/members/invite',
  authenticate,
  authorize('owner', 'admin'),
  async (req: Request, res: Response, next: NextFunction) => {
    const { email, role = 'editor' } = req.body;
    if (!email || typeof email !== 'string') return next(badRequest('Email required', 'EMAIL_REQUIRED'));
    if (!VALID_ROLES.includes(role)) return next(badRequest('Invalid role', 'INVALID_ROLE'));

    // Verify the authenticated user belongs to the requested organization
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

// POST /organizations/:id/members/add
router.post(
  '/:id/members/add',
  authenticate,
  authorize('owner', 'admin'),
  async (req: Request, res: Response, next: NextFunction) => {
    const { email, role = 'editor' } = req.body;
    if (!email || typeof email !== 'string') return next(badRequest('Email required', 'EMAIL_REQUIRED'));
    if (!VALID_ROLES.includes(role)) return next(badRequest('Invalid role', 'INVALID_ROLE'));

    // Verify the authenticated user belongs to the requested organization
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
