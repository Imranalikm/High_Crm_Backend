const express = require('express');
const router = express.Router();
const depositController = require('../controllers/deposit.controller');
const authenticateToken = require('../middlewares/auth.middleware');

const { depositUpload } = require('../config/upload');

// User and Admin deposit creation
router.post('/', authenticateToken, depositUpload.single('depositProof'), depositController.createDeposit);

// User endpoints
router.get('/my-deposits', authenticateToken, depositController.getDepositsByUserId);

// Admin endpoints
router.get('/', authenticateToken, depositController.getDepositsForAdmin);
router.put('/:id/approve', authenticateToken, depositController.approveDeposit);
router.put('/:id/reject', authenticateToken, depositController.rejectDeposit);

module.exports = router;
