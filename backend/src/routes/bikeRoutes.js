import express from 'express';
import { getBikes, getBikesSearch, getBikesGpx, getBikesElevation, getBikeStages } from '../controllers/bikeRoutes.js';
import { convertToLV95 } from '../middleware/lv95Converter.js';
import { cacheResponse } from '../middleware/cache.js';

const router = express.Router();

router.get('/', convertToLV95, cacheResponse(), getBikes);
router.get('/search', cacheResponse(), getBikesSearch);
router.post('/gpx', getBikesGpx);
router.post('/elevation', getBikesElevation);
router.get('/:routeNumber/stages', cacheResponse(), getBikeStages);

export default router;
