import { Router } from 'express';
import { getPublicSettings } from '../controllers/adminManageController';

// Public site/app settings managed from the admin panel (banner, maintenance notice, sports list…)
const router = Router();
router.get('/', getPublicSettings);

export default router;
