const { Role, User, Module, RolePermission, sequelize } = require('../models');

// Default system roles that cannot be deleted
const PROTECTED_ROLES = ['super_admin', 'risk_officer', 'compliance', 'finance', 'support_agent', 'read_only'];

/**
 * Get all roles with admin count, status, scope and audit details
 */
async function getRoles(req, res, next) {
  try {
    const roles = await Role.findAll({
      include: [
        { model: User, as: 'users', attributes: ['id'] },
        { model: User, as: 'creator', attributes: ['id', 'name'] },
        { model: User, as: 'updater', attributes: ['id', 'name'] }
      ],
      order: [['createdAt', 'ASC']]
    });

    const formattedRoles = roles.map(role => ({
      id: role.id,
      name: role.name,
      key: role.key,
      description: role.description,
      scope: role.scope,
      status: role.status,
      adminsCount: role.users ? role.users.length : 0,
      createdAt: role.createdAt,
      updatedAt: role.updatedAt,
      createdBy: role.creator ? role.creator.name : null,
      updatedBy: role.updater ? role.updater.name : null
    }));

    return res.status(200).json({
      success: true,
      data: formattedRoles
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Get a specific role with its permissions matrix layout
 */
async function getRoleById(req, res, next) {
  try {
    const { id } = req.params;

    const role = await Role.findByPk(id, {
      include: [
        { model: User, as: 'creator', attributes: ['id', 'name'] },
        { model: User, as: 'updater', attributes: ['id', 'name'] }
      ]
    });

    if (!role) {
      return res.status(404).json({
        success: false,
        message: 'Role not found.'
      });
    }

    const modules = await Module.findAll({ order: [['name', 'ASC']] });
    const permissions = await RolePermission.findAll({ where: { roleId: role.id } });

    // Build permission matrix structure
    const allActions = ['view', 'create', 'edit', 'approve', 'delete', 'export', 'assign'];
    
    const matrix = modules.map(mod => {
      const modPermissions = permissions.filter(p => p.moduleId === mod.id);
      
      const actionsState = {};
      allActions.forEach(act => {
        actionsState[act] = modPermissions.some(p => p.action === act);
      });

      return {
        moduleId: mod.id,
        moduleName: mod.name,
        moduleKey: mod.key,
        actions: actionsState
      };
    });

    return res.status(200).json({
      success: true,
      data: {
        role: {
          id: role.id,
          name: role.name,
          key: role.key,
          description: role.description,
          scope: role.scope,
          status: role.status,
          createdAt: role.createdAt,
          updatedAt: role.updatedAt,
          createdBy: role.creator ? role.creator.name : null,
          updatedBy: role.updater ? role.updater.name : null
        },
        matrix
      }
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Create a new custom role and seed its permissions matrix
 */
async function createRole(req, res, next) {
  const transaction = await sequelize.transaction();
  try {
    const { name, description, scope, status, permissions } = req.body;

    if (!name) {
      return res.status(400).json({
        success: false,
        message: 'Role name is required.'
      });
    }

    const key = name.toLowerCase().trim().replace(/[^a-z0-9]+/g, '_');

    // Check if role name/key already exists
    const existingRole = await Role.findOne({ where: { key }, transaction });
    if (existingRole) {
      return res.status(400).json({
        success: false,
        message: `Role with key '${key}' (derived from '${name}') already exists.`
      });
    }

    const newRole = await Role.create({
      name,
      key,
      description,
      scope: scope || 'CUSTOM_MODULES',
      status: status || 'ACTIVE',
      createdBy: req.user.id,
      updatedBy: req.user.id
    }, { transaction });

    // Seed permissions matrix if provided in request
    if (permissions && Array.isArray(permissions)) {
      const modules = await Module.findAll({ transaction });
      const moduleMap = {};
      modules.forEach(m => { moduleMap[m.key] = m.id; });

      for (const item of permissions) {
        const moduleId = moduleMap[item.moduleKey];
        if (!moduleId) continue;

        if (item.actions && Array.isArray(item.actions)) {
          for (const action of item.actions) {
            await RolePermission.create({
              roleId: newRole.id,
              moduleId,
              action,
              createdBy: req.user.id,
              updatedBy: req.user.id
            }, { transaction });
          }
        }
      }
    }

    await transaction.commit();

    return res.status(201).json({
      success: true,
      message: 'Role created successfully.',
      data: newRole
    });
  } catch (error) {
    await transaction.rollback();
    next(error);
  }
}

/**
 * Update an existing role and its permissions matrix
 */
async function updateRole(req, res, next) {
  const transaction = await sequelize.transaction();
  try {
    const { id } = req.params;
    const { name, description, scope, status, permissions } = req.body;

    const role = await Role.findByPk(id, { transaction });
    if (!role) {
      await transaction.rollback();
      return res.status(404).json({
        success: false,
        message: 'Role not found.'
      });
    }

    // Prevent changing key/name of protected roles
    if (PROTECTED_ROLES.includes(role.key) && name && name !== role.name) {
      await transaction.rollback();
      return res.status(400).json({
        success: false,
        message: `Cannot modify the name/key of system protected role: ${role.name}.`
      });
    }

    const updates = {
      description: description !== undefined ? description : role.description,
      scope: scope !== undefined ? scope : role.scope,
      status: status !== undefined ? status : role.status,
      updatedBy: req.user.id
    };

    if (name && !PROTECTED_ROLES.includes(role.key)) {
      updates.name = name;
      updates.key = name.toLowerCase().trim().replace(/[^a-z0-9]+/g, '_');
    }

    await role.update(updates, { transaction });

    // Update permissions matrix if provided
    if (permissions && Array.isArray(permissions)) {
      // 1. Delete all existing permissions for this role
      await RolePermission.destroy({ where: { roleId: role.id }, transaction });

      // 2. Fetch system modules
      const modules = await Module.findAll({ transaction });
      const moduleMap = {};
      modules.forEach(m => { moduleMap[m.key] = m.id; });

      // 3. Insert new permissions
      for (const item of permissions) {
        const moduleId = moduleMap[item.moduleKey];
        if (!moduleId) continue;

        if (item.actions && Array.isArray(item.actions)) {
          for (const action of item.actions) {
            await RolePermission.create({
              roleId: role.id,
              moduleId,
              action,
              createdBy: req.user.id,
              updatedBy: req.user.id
            }, { transaction });
          }
        }
      }
    }

    await transaction.commit();

    return res.status(200).json({
      success: true,
      message: 'Role updated successfully.'
    });
  } catch (error) {
    await transaction.rollback();
    next(error);
  }
}

/**
 * Delete a custom role
 */
async function deleteRole(req, res, next) {
  try {
    const { id } = req.params;

    const role = await Role.findByPk(id);
    if (!role) {
      return res.status(404).json({
        success: false,
        message: 'Role not found.'
      });
    }

    // Check if it is a protected system role
    if (PROTECTED_ROLES.includes(role.key)) {
      return res.status(400).json({
        success: false,
        message: `Cannot delete protected system role: ${role.name}.`
      });
    }

    // Check if role is assigned to any active/inactive users
    const usersCount = await User.count({ where: { roleId: role.id } });
    if (usersCount > 0) {
      return res.status(400).json({
        success: false,
        message: `Cannot delete role. It is currently assigned to ${usersCount} admin user(s).`
      });
    }

    // Delete role (associated role_permissions will cascade delete due to onDelete: 'CASCADE')
    await role.destroy();

    return res.status(200).json({
      success: true,
      message: 'Role deleted successfully.'
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Get the full global permissions matrix (Screenshot 1)
 */
async function getPermissionsMatrix(req, res, next) {
  try {
    const roles = await Role.findAll({ order: [['createdAt', 'ASC']] });
    const modules = await Module.findAll({ order: [['name', 'ASC']] });
    const permissions = await RolePermission.findAll();

    const matrix = {};
    roles.forEach(role => {
      matrix[role.id] = {
        roleName: role.name,
        roleKey: role.key,
        permissionsByModule: {}
      };

      modules.forEach(mod => {
        // Find permissions for this role & module
        const activeActions = permissions
          .filter(p => p.roleId === role.id && p.moduleId === mod.id)
          .map(p => p.action);
        
        matrix[role.id].permissionsByModule[mod.id] = {
          moduleName: mod.name,
          moduleKey: mod.key,
          actions: activeActions
        };
      });
    });

    return res.status(200).json({
      success: true,
      data: {
        roles: roles.map(r => ({ id: r.id, name: r.name, key: r.key })),
        modules: modules.map(m => ({ id: m.id, name: m.name, key: m.key })),
        matrix
      }
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Get all system modules
 */
async function getModules(req, res, next) {
  try {
    const modules = await Module.findAll({ order: [['name', 'ASC']] });
    return res.status(200).json({
      success: true,
      data: modules
    });
  } catch (error) {
    next(error);
  }
}

module.exports = {
  getRoles,
  getRoleById,
  createRole,
  updateRole,
  deleteRole,
  getPermissionsMatrix,
  getModules
};
