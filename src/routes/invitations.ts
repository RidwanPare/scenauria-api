import { Router, Request, Response, NextFunction } from 'express';
import { acceptInvitation } from '../services/invitation.service';

const router = Router();

// POST /invitations/:token/accept
router.post('/:token/accept', async (req: Request, res: Response, next: NextFunction) => {
  await acceptInvitation(req.params.token as string);
  res.json({ message: 'Invitation accepted.' });
});

export default router;
