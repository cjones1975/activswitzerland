import express from 'express';
import { getHotelDestinations, getHotelDeeplink } from '../controllers/hotels.js';

const router = express.Router();

router.get('/destinations', getHotelDestinations);
router.get('/deeplink', getHotelDeeplink);

export default router;
