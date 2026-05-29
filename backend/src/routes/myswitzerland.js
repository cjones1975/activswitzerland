import express from 'express';
import { getDestinations, getDestinationsByGeobBox, getDestination } from '../controllers/myswitzerland.js';

const router = express.Router();

router.get('/destinations', getDestinations);
router.get('/destinationsbygeobbox', getDestinationsByGeobBox);
router.get('/destinations/:id', getDestination);


export default router;