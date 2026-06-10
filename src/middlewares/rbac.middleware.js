const { RolePermission, Module } = require('../models');

/**
 * Middleware to check if the user has permission to perform a specific action on a module.
 * @param {string} moduleKey - The unique key of the system module (e.g. 'users', 'finance')
 * @param {string} action - The action type (e.g. 'view', 'create', 'edit', 'approve', 'delete', 'export', 'assign')
 */
function requirePermission(moduleKey, action) {
  return async (req, res, next) => {
    try {
      const user = req.user;
      if (!user) {
        return res.status(401).json({
          success: false,
          message: 'Access denied. User authentication required.'
        });
      }

      // 1. Check if user is Super Admin (bypasses all matrix checks)
      if (user.role && user.role.key === 'super_admin') {
        return next();
      }

      // 2. Block user-type roles from admin routes
      if (user.role && user.role.type === 'user') {
        return res.status(403).json({
          success: false,
          message: 'Access denied. This route is restricted to admin panel users.'
        });
      }

      const roleId = user.roleId;
      if (!roleId) {
        return res.status(403).json({
          success: false,
          message: 'Access denied. Your account is not assigned to any role.'
        });
      }

      // 2. Query the permissions matrix
      const permission = await RolePermission.findOne({
        where: {
          roleId,
          action
        },
        include: [{
          model: Module,
          as: 'module',
          where: { key: moduleKey }
        }]
      });

      if (!permission) {
        return res.status(403).json({
          success: false,
          message: `Access denied. You do not have permission to '${action}' on module '${moduleKey}'.`
        });
      }

      // Permission granted, proceed
      next();
    } catch (error) {
      console.error('[RBAC Middleware] Authorization error:', error);
      return res.status(500).json({
        success: false,
        message: 'Internal server error validating authorization.'
      });
    }
  };
}

module.exports = requirePermission;
