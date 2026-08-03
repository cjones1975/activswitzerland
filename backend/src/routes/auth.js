import express from 'express';
import {
    register,
    login,
    verifyEmail,
    resendVerification,
    getMe,
    updateUser,
    verifyEmailChange,
    updatePassword,
    forgotPassword,
    resetPassword,
} from '../controllers/auth.js';
import protect from '../middleware/auth.js';
import { loginLimiter, verifyLimiter, resendLimiter } from '../middleware/rateLimiter.js';

const router = express.Router();


router.post('/register', register);
router.post('/login', loginLimiter, login);
router.post('/verifyEmail', verifyLimiter, verifyEmail);
router.post('/resendVerification', resendLimiter, resendVerification);
router.get('/me', protect, getMe);
router.put('/updateUser', protect, updateUser);
router.post('/verifyEmailChange', protect, verifyLimiter, verifyEmailChange);
router.post('/updatePassword', protect, updatePassword);
router.post('/forgotPassword', forgotPassword);


export default router;
