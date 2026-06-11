import { Router, Request, Response, NextFunction } from 'express';
import multer from 'multer';
import { authenticate } from '../middleware/auth';
import { uploadVideo } from '../services/storage.service';
import { AppError } from '../middleware/errorHandler';

const router = Router();

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 500 * 1024 * 1024 }, // 500 MB
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('video/')) return cb(null, true);
    const err = new Error('Only video files are accepted') as AppError;
    err.statusCode = 400;
    err.code = 'INVALID_FILE_TYPE';
    cb(err);
  },
});

router.post(
  '/video',
  authenticate,
  upload.single('file'),
  async (req: Request, res: Response, next: NextFunction) => {
    if (!req.file) {
      const err = new Error('file is required') as AppError;
      err.statusCode = 400;
      err.code = 'FILE_REQUIRED';
      return next(err);
    }

    const video_url = await uploadVideo(req.file.buffer, req.file.mimetype, req.user!.orgId);
    res.status(201).json({ video_url });
  }
);

export default router;
