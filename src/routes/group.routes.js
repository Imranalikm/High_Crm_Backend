const express = require('express');
const router = express.Router();
const { fetchAndStoreMt5Groups, getAllMt5Groups } = require('../controllers/group.controller');
const authenticateToken = require('../middlewares/auth.middleware');
const requirePermission = require('../middlewares/rbac.middleware');

// All group routes require authentication and admin permission
router.use(authenticateToken);
// Example permission: require 'users' view/edit or something similar for groups.
// If there's a specific 'groups' module, we would use it here.
// I will use requirePermission('settings', 'view') as a placeholder, or 'users' if that's what fits group management.
// Assuming group management is generally for managing users/settings. We'll use ('users', 'view') and ('users', 'edit') for now
// so that only admin roles with those permissions can access.
router.get('/', requirePermission('users', 'view'), getAllMt5Groups);
router.post('/sync', requirePermission('users', 'edit'), fetchAndStoreMt5Groups);

module.exports = router;
