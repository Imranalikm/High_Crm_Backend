const express = require('express');
const router = express.Router();
const {
  getAllUsers,
  getUserById,
  addUser,
  editUser,
  blockUser,
  verifyUserOtp
} = require('../controllers/user.management.controller');

const authenticateToken = require('../middlewares/auth.middleware');
const requirePermission = require('../middlewares/rbac.middleware');

// All routes require authentication
router.use(authenticateToken);

// GET    /api/user-management          - Get all normal users (with search, filter, pagination)
router.get('/', requirePermission('users', 'view'), getAllUsers);

// GET    /api/user-management/:id      - Get a single user by ID
router.get('/:id', requirePermission('users', 'view'), getUserById);

// POST   /api/user-management          - Add a new normal user (same fields as signup)
router.post('/', requirePermission('users', 'create'), addUser);

// PUT    /api/user-management/:id      - Edit an existing normal user
router.put('/:id', requirePermission('users', 'edit'), editUser);

// PATCH  /api/user-management/:id/block - Block or unblock a normal user
router.patch('/:id/block', requirePermission('users', 'edit'), blockUser);

// PATCH  /api/user-management/:id/verify-otp - Manually mark a user's OTP as verified
router.patch('/:id/verify-otp', requirePermission('users', 'edit'), verifyUserOtp);

module.exports = router;
