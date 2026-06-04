import express from 'express';
import { getDestinations, getDestinationsByGeobBox, getDestination, getTopAttractions, getAttractions, getAttraction, searchAttractions } from '../controllers/myswitzerland.js';

const router = express.Router();

router.get('/destinations', getDestinations);
router.get('/destinationsbygeobbox', getDestinationsByGeobBox);
router.get('/destinations/:id', getDestination);
router.get('/topattractions', getTopAttractions);
router.get('/attractions', getAttractions);
router.get('/attractions/:id', getAttraction);
router.get('/searchattractions', searchAttractions);


export default router;