import express from 'express';
import { protect } from '../middleware/auth.js';
import { requireAdmin } from '../middleware/requireAdmin.js';
import { getAdminHikes, previewHike, createAdminHike, updateAdminHike, deleteAdminHike } from '../controllers/adminHikes.js';

const router = express.Router();

router.use(protect, requireAdmin);

router.get('/', getAdminHikes);
router.post('/preview', previewHike);
router.post('/', createAdminHike);
router.patch('/:id', updateAdminHike);
router.delete('/:id', deleteAdminHike);

export default router;
