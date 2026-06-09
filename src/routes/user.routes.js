const express = require('express');
const router = express.Router();
const { getUsers, createUser, updateUser, deleteUser } = require('../controllers/user.controller');

const authenticateToken = require('../middlewares/auth.middleware');
const requirePermission = require('../middlewares/rbac.middleware');

// All user management routes require authentication and 'admin_management' permissions
router.use(authenticateToken);

router.get('/', requirePermission('admin_management', 'view'), getUsers);
router.post('/', requirePermission('admin_management', 'create'), createUser);
router.put('/:id', requirePermission('admin_management', 'edit'), updateUser);
router.delete('/:id', requirePermission('admin_management', 'delete'), deleteUser);

module.exports = router;
