import express from 'express';
import { getTrips, createTrip, updateTrip, deleteTrip } from '../controllers/trips.js';
import protect from '../middleware/auth.js';

const router = express.Router();

router.use(protect);

router.route('/').get(getTrips).post(createTrip);
router.route('/:id').put(updateTrip).delete(deleteTrip);

export default router;
