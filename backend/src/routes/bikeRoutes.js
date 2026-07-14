import express from 'express';
import { getBikes, getBikesGpx, getBikesElevation } from '../controllers/bikeRoutes.js';
import { convertToLV95 } from '../middleware/lv95Converter.js';
import { cacheResponse } from '../middleware/cache.js';

const router = express.Router();

router.get('/', convertToLV95, cacheResponse(), getBikes);
router.post('/gpx', getBikesGpx);
router.post('/elevation', getBikesElevation);

export default router;
