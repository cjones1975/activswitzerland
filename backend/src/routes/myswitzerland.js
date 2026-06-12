import express from 'express';
import { getDestinations, getDestinationsByGeobBox, getDestination, getTopAttractions, getAttractions, getAttraction, searchAttractions } from '../controllers/myswitzerland.js';
import { cacheResponse } from '../middleware/cache.js';

const router = express.Router();

router.get('/destinations', cacheResponse(), getDestinations);
router.get('/destinationsbygeobbox', cacheResponse(), getDestinationsByGeobBox);
router.get('/destinations/:id', cacheResponse(), getDestination);
router.get('/topattractions', cacheResponse(), getTopAttractions);
router.get('/attractions', cacheResponse(), getAttractions);
router.get('/attractions/:id', cacheResponse(), getAttraction);
router.get('/searchattractions', cacheResponse(), searchAttractions);


export default router;