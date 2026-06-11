const express = require('express');
const router = express.Router();
const { listKyc, getKycById, approveKyc, rejectKyc } = require('../controllers/kyc.controller');

const authenticateToken = require('../middlewares/auth.middleware');
const requirePermission = require('../middlewares/rbac.middleware');

// All KYC admin routes require authentication
router.use(authenticateToken);

// Admin KYC management routes
router.get('/', requirePermission('users', 'view'), listKyc);
router.get('/:id', requirePermission('users', 'view'), getKycById);
router.put('/:id/approve', requirePermission('users', 'approve'), approveKyc);
router.put('/:id/reject', requirePermission('users', 'approve'), rejectKyc);

module.exports = router;
