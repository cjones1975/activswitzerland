import express from 'express';
import { createCheckoutSession, createPortalSession, handleWebhook } from '../controllers/billing.js';
import { protect } from '../middleware/auth.js';

const router = express.Router();

// This whole router is mounted ahead of the global express.json() in server.js so /webhook can
// get Stripe's raw body for signature verification — no protect either, verified by signature
// instead. /checkout and /portal need parsed JSON (createCheckoutSession reads req.body.plan),
// so they get their own express.json() here rather than relying on the (deliberately skipped)
// global parser.
router.post('/webhook', express.raw({ type: 'application/json' }), handleWebhook);
router.post('/checkout', express.json(), protect, createCheckoutSession);
router.post('/portal', express.json(), protect, createPortalSession);

export default router;
