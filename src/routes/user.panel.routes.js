const express = require('express');
const router = express.Router();
const { getDashboard, getProfile, updateProfile, getWallet } = require('../controllers/user.panel.controller');

const authenticateToken = require('../middlewares/auth.middleware');
const requireUserPanel = require('../middlewares/panel.middleware');

// All user panel routes require authentication + user-type role
router.use(authenticateToken);
router.use(requireUserPanel);

// User Panel Routes
router.get('/dashboard', getDashboard);
router.get('/profile', getProfile);
router.put('/profile', updateProfile);
router.get('/wallet', getWallet);

module.exports = router;
