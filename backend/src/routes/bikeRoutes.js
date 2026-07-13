import express from 'express';
import { getBikes, getBikesGpx } from '../controllers/bikeRoutes.js';
import { convertToLV95 } from '../middleware/lv95Converter.js';
import { cacheResponse } from '../middleware/cache.js';

const router = express.Router();

router.get('/', convertToLV95, cacheResponse(), getBikes);
router.post('/gpx', getBikesGpx);

export default router;
