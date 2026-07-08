import express from 'express';
import { getHikes } from '../controllers/hikingRoutes.js';
import { convertToLV95 } from '../middleware/lv95Converter.js';
import { cacheResponse } from '../middleware/cache.js';

const router = express.Router();

router.get('/', convertToLV95, cacheResponse(), getHikes);

export default router;
