import express from 'express';
import { getHikes, getHikesGpx, getHikesElevation } from '../controllers/hikingRoutes.js';
import { convertToLV95 } from '../middleware/lv95Converter.js';
import { cacheResponse } from '../middleware/cache.js';

const router = express.Router();

router.get('/', convertToLV95, cacheResponse(), getHikes);
router.post('/gpx', getHikesGpx);
router.post('/elevation', getHikesElevation);

export default router;
