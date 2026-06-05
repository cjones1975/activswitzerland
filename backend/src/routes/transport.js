import express from 'express';
import { getLocations, getConnections } from '../controllers/transport.js';

const router = express.Router();

router.get('/locations', getLocations);
router.get('/connections', getConnections);



export default router;