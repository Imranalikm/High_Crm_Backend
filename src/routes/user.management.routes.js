const express = require('express');
const router = express.Router();
const {
  getAllUsers,
  getUserById,
  addUser,
  editUser,
  blockUser
} = require('../controllers/user.management.controller');

const authenticateToken = require('../middlewares/auth.middleware');
const requirePermission = require('../middlewares/rbac.middleware');

// All routes require authentication
router.use(authenticateToken);

// GET    /api/user-management          - Get all normal users (with search, filter, pagination)
router.get('/', requirePermission('user_management', 'view'), getAllUsers);

// GET    /api/user-management/:id      - Get a single user by ID
router.get('/:id', requirePermission('user_management', 'view'), getUserById);

// POST   /api/user-management          - Add a new normal user (same fields as signup)
router.post('/', requirePermission('user_management', 'create'), addUser);

// PUT    /api/user-management/:id      - Edit an existing normal user
router.put('/:id', requirePermission('user_management', 'edit'), editUser);

// PATCH  /api/user-management/:id/block - Block or unblock a normal user
router.patch('/:id/block', requirePermission('user_management', 'edit'), blockUser);

module.exports = router;
