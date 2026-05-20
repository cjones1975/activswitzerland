import express from 'express';
import { register, login, getMe, updateUser, updatePassword, forgotPassword, resetPassword } from '../controllers/auth.js';
import protect from '../middleware/auth.js';
import loginLimiter from '../middleware/rateLimiter.js';

const router = express.Router();


router.post('/register', register);
router.post('/login', loginLimiter, login);
router.get('/me', protect, getMe);
router.put('/updateUser', protect, updateUser);
router.post('/updatePassword', protect, updatePassword);
router.post('/forgotPassword', forgotPassword);


export default router;