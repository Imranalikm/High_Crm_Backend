const express = require('express');
const router = express.Router();
const { createMT5Account, getMT5Accounts, updateMT5Password } = require('../controllers/mt5Account.controller');
const authenticateToken = require('../middlewares/auth.middleware');
const requireKycApproved = require('../middlewares/kycCheck.middleware');

// Routes require authentication
router.use(authenticateToken);

router.get('/', getMT5Accounts);
router.post('/', requireKycApproved, createMT5Account);
router.post('/update-password', requireKycApproved, updateMT5Password);

module.exports = router;
