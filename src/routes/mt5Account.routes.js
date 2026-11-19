const express = require('express');
const router = express.Router();
const {
  createMT5Account,
  createDemoMT5Account,
  getDemoStatus,
  adjustDemoBalance,
  getMT5Accounts,
  getMT5AccountByLogin,
  updateMT5Password
} = require('../controllers/mt5Account.controller');
const { getTradeHistory } = require('../controllers/tradeHistory.controller');
const { getPendingOrders, getOrderHistory } = require('../controllers/orders.controller');
const authenticateToken = require('../middlewares/auth.middleware');
const requireKycApproved = require('../middlewares/kycCheck.middleware');
const requirePermission = require('../middlewares/rbac.middleware');

// Public routes: instant demo account from the login page
router.get('/demo/status', getDemoStatus);
router.post('/demo', createDemoMT5Account);

// Routes below require authentication
router.use(authenticateToken);

router.get('/', getMT5Accounts);
router.post('/', requireKycApproved, createMT5Account);
router.post('/update-password', requireKycApproved, updateMT5Password);
// Admin: closed trades for all CRM accounts (must stay above '/:accountid')
router.get('/history/trades', requirePermission('trading', 'view'), getTradeHistory);
router.get('/orders/pending', requirePermission('trading', 'view'), getPendingOrders);
router.get('/orders/history', requirePermission('trading', 'view'), getOrderHistory);
router.get('/:accountid', requirePermission('users', 'view'), getMT5AccountByLogin);
router.post('/:accountid/demo-balance', requirePermission('users', 'edit'), adjustDemoBalance);

module.exports = router;
