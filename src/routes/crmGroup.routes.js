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

// GET is accessible to any authenticated user (clients need groups for MT5 creation)
router.get('/', getAllCrmGroups);

// Write operations require admin permission
router.post('/', requirePermission('users', 'create'), createCrmGroup);
router.put('/:id', requirePermission('users', 'edit'), updateCrmGroup);
router.delete('/:id', requirePermission('users', 'delete'), softDeleteCrmGroup);

module.exports = router;
