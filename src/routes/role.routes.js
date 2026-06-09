const express = require('express');
const router = express.Router();
const {
  getRoles,
  getRoleById,
  createRole,
  updateRole,
  deleteRole,
  getPermissionsMatrix,
  getModules
} = require('../controllers/role.controller');

const authenticateToken = require('../middlewares/auth.middleware');
const requirePermission = require('../middlewares/rbac.middleware');

// All role routes require authentication
router.use(authenticateToken);

// Core Modules list (needed by many pages, just requires active auth)
router.get('/modules', getModules);

// Permissions Matrix view
router.get('/matrix', requirePermission('admin_management', 'view'), getPermissionsMatrix);

// Roles CRUD
router.get('/', requirePermission('admin_management', 'view'), getRoles);
router.get('/:id', requirePermission('admin_management', 'view'), getRoleById);
router.post('/', requirePermission('admin_management', 'create'), createRole);
router.put('/:id', requirePermission('admin_management', 'edit'), updateRole);
router.delete('/:id', requirePermission('admin_management', 'delete'), deleteRole);

module.exports = router;
