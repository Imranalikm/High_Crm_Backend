const { User, Role } = require('../models');

// ID of default admin that should not be deleted (integer ID)
const BOOTSTRAP_ADMIN_ID = 1;

/**
 * Get all users with their roles
 */
async function getUsers(req, res, next) {
  try {
    const users = await User.findAll({
      include: [
        { model: Role, as: 'role', attributes: ['id', 'name', 'key'] },
        { model: User, as: 'creator', attributes: ['id', 'name'] },
        { model: User, as: 'updater', attributes: ['id', 'name'] }
      ],
      order: [['createdAt', 'DESC']]
    });

    const formattedUsers = users.map(user => ({
      id: user.id,
      name: user.name,
      email: user.email,
      country: user.country,
      phone: user.phone,
      status: user.status,
      wallet_balance: user.wallet_balance,
      lb_name: user.lb_name,
      isIB: user.isIB,
      role: user.role ? { id: user.role.id, name: user.role.name, key: user.role.key } : null,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
      createdBy: user.creator ? user.creator.name : null,
      updatedBy: user.updater ? user.updater.name : null
    }));

    return res.status(200).json({
      success: true,
      data: formattedUsers
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Create a new user (admin/staff/user)
 */
async function createUser(req, res, next) {
  try {
    const { 
      name, email, password, roleId, status, 
      country, phone, lb_name, isIB 
    } = req.body;

    if (!name || !email || !password || !roleId) {
      return res.status(400).json({
        success: false,
        message: 'Name, email, password, and roleId are required.'
      });
    }

    // Verify role exists
    const role = await Role.findByPk(roleId);
    if (!role) {
      return res.status(404).json({
        success: false,
        message: 'Assigned role not found.'
      });
    }

    const newUser = await User.create({
      name,
      email,
      password,
      roleId,
      status: status || 'pending',
      country,
      phone,
      lb_name,
      isIB: isIB !== undefined ? isIB : false,
      createdBy: req.user.id,
      updatedBy: req.user.id
    });

    return res.status(201).json({
      success: true,
      message: 'User created successfully.',
      data: {
        id: newUser.id,
        name: newUser.name,
        email: newUser.email,
        status: newUser.status,
        roleId: newUser.roleId
      }
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Update an existing user
 */
async function updateUser(req, res, next) {
  try {
    const { id } = req.params;
    const { 
      name, email, password, roleId, status, 
      country, phone, lb_name, isIB, wallet_balance 
    } = req.body;

    const user = await User.findByPk(id);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found.'
      });
    }

    // Protect bootstrap admin status and role from modification
    if (user.id === BOOTSTRAP_ADMIN_ID) {
      if (status && status !== 'active') {
        return res.status(400).json({
          success: false,
          message: 'Cannot deactivate the bootstrap Super Admin account.'
        });
      }
      
      const superAdminRole = await Role.findOne({ where: { key: 'super_admin' } });
      if (roleId && roleId !== superAdminRole.id) {
        return res.status(400).json({
          success: false,
          message: 'Cannot demote the bootstrap Super Admin account.'
        });
      }
    }

    const updates = {
      updatedBy: req.user.id
    };

    if (name !== undefined) updates.name = name;
    if (email !== undefined) updates.email = email;
    if (password) updates.password = password; // triggers beforeUpdate hashing hook
    if (status !== undefined) updates.status = status;
    if (country !== undefined) updates.country = country;
    if (phone !== undefined) updates.phone = phone;
    if (lb_name !== undefined) updates.lb_name = lb_name;
    if (isIB !== undefined) updates.isIB = isIB;
    if (wallet_balance !== undefined) updates.wallet_balance = wallet_balance;

    if (roleId !== undefined) {
      const role = await Role.findByPk(roleId);
      if (!role) {
        return res.status(404).json({
          success: false,
          message: 'Assigned role not found.'
        });
      }
      updates.roleId = roleId;
    }

    await user.update(updates);

    return res.status(200).json({
      success: true,
      message: 'User updated successfully.'
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Delete a user
 */
async function deleteUser(req, res, next) {
  try {
    const { id } = req.params;
    const numericId = parseInt(id, 10);

    if (numericId === BOOTSTRAP_ADMIN_ID) {
      return res.status(400).json({
        success: false,
        message: 'Cannot delete the bootstrap Super Admin account.'
      });
    }

    const user = await User.findByPk(numericId);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found.'
      });
    }

    // Prevent user from deleting themselves
    if (user.id === req.user.id) {
      return res.status(400).json({
        success: false,
        message: 'You cannot delete your own logged-in user account.'
      });
    }

    await user.destroy();

    return res.status(200).json({
      success: true,
      message: 'User deleted successfully.'
    });
  } catch (error) {
    next(error);
  }
}

module.exports = {
  getUsers,
  createUser,
  updateUser,
  deleteUser
};
