import { Router } from 'express';
import { protect } from '../middleware/auth';
import { upload } from '../middleware/upload';
import { sendSuccess, sendError } from '../utils/response';

const router = Router();

router.post('/image', protect, upload.single('image'), (req: any, res: any) => {
  if (!req.file) {
    sendError(res, 'No file uploaded', 400);
    return;
  }

  // Construct URL to access the file
  const fileUrl = `${process.env.BACKEND_URL || 'http://localhost:5000'}/uploads/profiles/${req.file.filename}`;

  sendSuccess(res, { url: fileUrl }, 'File uploaded successfully');
});

export default router;
