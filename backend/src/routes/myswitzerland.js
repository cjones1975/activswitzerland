import express from 'express';
import { getDestinations, getDestinationsByGeobBox, getDestination, getTopAttractions, getAttractions, getAttraction } from '../controllers/myswitzerland.js';

const router = express.Router();

router.get('/destinations', getDestinations);
router.get('/destinationsbygeobbox', getDestinationsByGeobBox);
router.get('/destinations/:id', getDestination);
router.get('/topattractions', getTopAttractions);
router.get('/attractions', getAttractions);
router.get('/attractions/:id', getAttraction);


export default router;