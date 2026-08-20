import express from 'express';
import { getHikes, getHikesSearch, getHikesGpx, getHikesElevation, getHikeStages } from '../controllers/hikingRoutes.js';
import { convertToLV95 } from '../middleware/lv95Converter.js';
import { cacheResponse } from '../middleware/cache.js';

const router = express.Router();

router.get('/', convertToLV95, cacheResponse(), getHikes);
router.get('/search', cacheResponse(), getHikesSearch);
router.post('/gpx', getHikesGpx);
router.post('/elevation', getHikesElevation);
router.get('/:routeNumber/stages', cacheResponse(), getHikeStages);

export default router;
