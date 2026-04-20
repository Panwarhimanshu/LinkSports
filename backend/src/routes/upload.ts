import { Router } from 'express';
import { protect } from '../middleware/auth';
import { upload } from '../middleware/upload';
import { uploadToCloudinary } from '../utils/cloudinary';
import { sendSuccess, sendError } from '../utils/response';

const router = Router();

router.post('/image', protect, upload.single('image'), async (req: any, res: any) => {
  if (!req.file) {
    sendError(res, 'No file uploaded', 400);
    return;
  }

  try {
    const url = await uploadToCloudinary(req.file.buffer);
    sendSuccess(res, { url }, 'File uploaded successfully');
  } catch (err) {
    console.error('[Upload] Cloudinary error:', err);
    sendError(res, 'Failed to upload image', 500);
  }
});

export default router;
