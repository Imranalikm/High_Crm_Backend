const express = require('express');
const router = express.Router();
const {
  createCrmGroup,
  getAllCrmGroups,
  updateCrmGroup,
  softDeleteCrmGroup
} = require('../controllers/crmGroup.controller');
const authenticateToken = require('../middlewares/auth.middleware');
const requirePermission = require('../middlewares/rbac.middleware');

// All CRM Group routes require authentication and admin permission
router.use(authenticateToken);

// We use 'users' permission to match the existing MT5 group implementation.
// Feel free to update this if a dedicated 'groups' or 'settings' module exists.
router.get('/', requirePermission('users', 'view'), getAllCrmGroups);
router.post('/', requirePermission('users', 'create'), createCrmGroup);
router.put('/:id', requirePermission('users', 'edit'), updateCrmGroup);
router.delete('/:id', requirePermission('users', 'delete'), softDeleteCrmGroup);

module.exports = router;
