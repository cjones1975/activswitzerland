import express from 'express';
import { getTrips, createTrip, updateTrip, deleteTrip, getPublicTrips, getTripBySlug, toggleLike } from '../controllers/trips.js';
import protect, { optionalAuth } from '../middleware/auth.js';

const router = express.Router();

// Must be registered before '/:id'-shaped routes below, or '/public' would be swallowed as an :id.
router.get('/public', optionalAuth, getPublicTrips);
router.get('/slug/:slug', optionalAuth, getTripBySlug);
router.post('/:id/like', protect, toggleLike);

router.route('/').get(protect, getTrips).post(protect, createTrip);
router.route('/:id').put(protect, updateTrip).delete(protect, deleteTrip);

export default router;
