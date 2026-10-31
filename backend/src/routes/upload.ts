import { Router } from 'express';
import { protect } from '../middleware/auth';
import { upload } from '../middleware/upload';
import { storeImage } from '../utils/cloudinary';
import { sendSuccess, sendError } from '../utils/response';
import { sniffImageType } from '../utils/security';

const router = Router();

router.post('/image', protect, upload.single('image'), async (req: any, res: any) => {
  if (!req.file) {
    console.error('[Upload] No file in request');
    sendError(res, 'No file uploaded', 400);
    return;
  }

  // The label the browser sent is not trusted: the file's own first bytes must say it is a real image.
  // (This also rejects SVG and HTML disguised as pictures, which could run scripts when opened.)
  const realType = sniffImageType(req.file.buffer);
  if (!realType) {
    sendError(res, 'This file is not a valid JPEG, PNG, WebP or GIF image', 400, 'INVALID_FILE');
    return;
  }

  try {
    const url = await storeImage(req.file.buffer, realType, req.user._id);
    sendSuccess(res, { url }, 'File uploaded successfully');
  } catch (err: any) {
    console.error('[Upload] Failed:', err?.message || err);
    sendError(res, 'Failed to upload image', 500);
  }
});

export default router;
