import express from 'express';
import { getLocations, getConnections, getConnectionJourneys } from '../controllers/transport.js';

const router = express.Router();

router.get('/locations', getLocations);
router.get('/connections', getConnections);
router.get('/connections/journeys', getConnectionJourneys);



export default router;