import { Router } from 'express';
import { protect } from '../middleware/auth';
import { upload } from '../middleware/upload';
import { storeImage } from '../utils/cloudinary';
import { sendSuccess, sendError } from '../utils/response';

const router = Router();

router.post('/image', protect, upload.single('image'), async (req: any, res: any) => {
  if (!req.file) {
    console.error('[Upload] No file in request');
    sendError(res, 'No file uploaded', 400);
    return;
  }

  console.log('[Upload] File received:', req.file.originalname, req.file.mimetype, req.file.size, 'bytes');

  try {
    const url = await storeImage(req.file.buffer, req.file.mimetype, req.user._id);
    console.log('[Upload] Success:', url);
    sendSuccess(res, { url }, 'File uploaded successfully');
  } catch (err: any) {
    console.error('[Upload] Failed:', err?.message || err);
    sendError(res, 'Failed to upload image', 500);
  }
});

export default router;
