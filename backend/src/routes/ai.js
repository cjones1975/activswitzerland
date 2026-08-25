import express from 'express';
import { postChatMessage, getChatUsage } from '../controllers/ai.js';
import { protect } from '../middleware/auth.js';
import { chatLimiter } from '../middleware/rateLimiter.js';

const router = express.Router();

router.post('/chat', protect, chatLimiter, postChatMessage);
router.get('/usage', protect, getChatUsage);

export default router;
