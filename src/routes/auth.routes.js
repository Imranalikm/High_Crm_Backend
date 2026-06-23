const express = require('express');
const router = express.Router();
const { register, login, refresh, getMe, sendOTP, verifyOTP, forgotPassword, resetPassword } = require('../controllers/auth.controller');
const authenticateToken = require('../middlewares/auth.middleware');

// Public routes
router.post('/register', register);
router.post('/login', login);
router.post('/refresh', refresh);
router.post('/otp/send', sendOTP);
router.post('/otp/verify', verifyOTP);
router.post('/forgot-password', forgotPassword);
router.post('/reset-password', resetPassword);

// Protected routes
router.get('/me', authenticateToken, getMe);

module.exports = router;
