const express = require('express');
const router = express.Router();
const withdrawalController = require('../controllers/withdrawal.controller');
const authenticateToken = require('../middlewares/auth.middleware');
const requireKycApproved = require('../middlewares/kycCheck.middleware');

// User and Admin withdrawal creation
router.post('/', authenticateToken, requireKycApproved, withdrawalController.createWithdrawal);

// User endpoints
router.get('/my-withdrawals', authenticateToken, withdrawalController.getWithdrawalsByUserId);

// Admin endpoints
router.get('/', authenticateToken, withdrawalController.getWithdrawalsForAdmin);
router.get('/:id', authenticateToken, withdrawalController.getWithdrawalById);
router.put('/:id/approve', authenticateToken, withdrawalController.approveWithdrawal);
router.put('/:id/reject', authenticateToken, withdrawalController.rejectWithdrawal);

module.exports = router;
