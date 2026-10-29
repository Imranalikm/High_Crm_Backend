const express = require('express');
const router = express.Router();
const {
  createMT5Account,
  createDemoMT5Account,
  getMT5Accounts,
  getMT5AccountByLogin,
  updateMT5Password
} = require('../controllers/mt5Account.controller');
const authenticateToken = require('../middlewares/auth.middleware');
const requireKycApproved = require('../middlewares/kycCheck.middleware');
const requirePermission = require('../middlewares/rbac.middleware');

// Public route: instant demo account from the login page
router.post('/demo', createDemoMT5Account);

// Routes below require authentication
router.use(authenticateToken);

router.get('/', getMT5Accounts);
router.post('/', requireKycApproved, createMT5Account);
router.post('/update-password', requireKycApproved, updateMT5Password);
router.get('/:accountid', requirePermission('users', 'view'), getMT5AccountByLogin);

module.exports = router;
