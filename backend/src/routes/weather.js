import express from 'express';
import { getWeather } from '../controllers/weather.js';

const router = express.Router();

router.get('/', getWeather);

export default router;