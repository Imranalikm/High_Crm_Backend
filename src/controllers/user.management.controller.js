const { User, Role, Kyc } = require('../models');
const { sendOtpEmail } = require('../utils/email.helper');
const bcrypt = require('bcryptjs');
const { Op } = require('sequelize');

/**
 * Get all normal users (users whose role type is 'user')
 * Supports search, status filter, and pagination
 */
async function getAllUsers(req, res, next) {
  try {
    const {
      page = 1,
      limit = 10,
      search,
      status
    } = req.query;

    const offset = (parseInt(page) - 1) * parseInt(limit);

    // Build where clause
    const whereClause = {};

    // Filter by status if provided
    if (status && ['active', 'pending', 'blocked'].includes(status)) {
      whereClause.status = status;
    }

    // Search by name, email, or phone
    if (search) {
      whereClause[Op.or] = [
        { name: { [Op.like]: `%${search}%` } },
        { email: { [Op.like]: `%${search}%` } },
        { phone: { [Op.like]: `%${search}%` } }
      ];
    }

    const { count, rows: users } = await User.findAndCountAll({
      where: whereClause,
      include: [
        {
          model: Role,
          as: 'role',
          where: { type: 'user' },
          attributes: ['id', 'name', 'key', 'type']
        },
        { model: User, as: 'creator', attributes: ['id', 'name'] },
        { model: User, as: 'updater', attributes: ['id', 'name'] },
        { model: Kyc, as: 'kyc', attributes: ['status', 'selfieImage'] }
      ],
      order: [['createdAt', 'DESC']],
      limit: parseInt(limit),
      offset,
      distinct: true
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
      updatedBy: user.updater ? user.updater.name : null,
      avatar: user.kyc && user.kyc.length > 0 ? user.kyc[0].selfieImage : (user.kyc ? user.kyc.selfieImage : null),
      kyc: user.kyc ? { status: user.kyc.status } : null
    }));

    return res.status(200).json({
      success: true,
      data: {
        users: formattedUsers,
        pagination: {
          total: count,
          page: parseInt(page),
          limit: parseInt(limit),
          totalPages: Math.ceil(count / parseInt(limit))
        }
      }
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Get a single user by ID (must be a normal user)
 */
async function getUserById(req, res, next) {
  try {
    const { id } = req.params;

    const user = await User.findByPk(id, {
      include: [
        {
          model: Role,
          as: 'role',
          where: { type: 'user' },
          attributes: ['id', 'name', 'key', 'type']
        },
        { model: User, as: 'creator', attributes: ['id', 'name'] },
        { model: User, as: 'updater', attributes: ['id', 'name'] },
        { model: Kyc, as: 'kyc', attributes: ['id', 'status', 'fullName', 'email', 'phone', 'country', 'selfieImage'] }
      ]
    });

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found or is not a normal user.'
      });
    }

    return res.status(200).json({
      success: true,
      data: {
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
        kyc: user.kyc || null,
        createdAt: user.createdAt,
        updatedAt: user.updatedAt,
        createdBy: user.creator ? user.creator.name : null,
        updatedBy: user.updater ? user.updater.name : null
      }
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Add a new normal user (same fields as signup)
 * Creates user with 'user' role, sends OTP, and creates KYC draft
 */
async function addUser(req, res, next) {
  try {
    const { name, email, password, country, phone } = req.body;

    // Validate required fields (same as signup)
    if (!name || !email || !password) {
      return res.status(400).json({
        success: false,
        message: 'Name, email, and password are required.'
      });
    }

    // Check if email already exists
    const existingUser = await User.findOne({ where: { email } });
    if (existingUser) {
      return res.status(409).json({
        success: false,
        message: 'A user with this email already exists.'
      });
    }

    // Assign the default 'user' role
    const userRole = await Role.findOne({ where: { key: 'user' } });
    if (!userRole) {
      return res.status(500).json({
        success: false,
        message: 'Default user role not found. Please seed roles first.'
      });
    }

    // Create the user (same as signup flow)
    const newUser = await User.create({
      name,
      email,
      password,
      country,
      phone,
      roleId: userRole.id,
      status: 'pending',
      createdBy: req.user.id,
      updatedBy: req.user.id
    });

    // Generate and send OTP for email verification
    const otpCode = Math.floor(100000 + Math.random() * 900000).toString();
    const salt = await bcrypt.genSalt(10);
    const hashedOtp = await bcrypt.hash(otpCode, salt);
    const otpExpiresAt = new Date(Date.now() + 5 * 60 * 1000); // 5 minutes

    await newUser.update({
      otp: hashedOtp,
      otpExpiresAt,
      lastOtpSentAt: new Date()
    });

    // Send OTP email (non-blocking)
    sendOtpEmail(newUser.email, otpCode).catch(err => {
      console.error(`[AddUser] Failed to send OTP email to ${newUser.email}:`, err.message);
    });

    // Create blank KYC draft (same as signup)
    await Kyc.create({
      userId: newUser.id,
      fullName: name,
      email,
      phone,
      country,
      status: 'draft',
      createdBy: req.user.id,
      updatedBy: req.user.id
    });

    return res.status(201).json({
      success: true,
      message: 'User created successfully. OTP has been sent to their email for verification.',
      data: {
        id: newUser.id,
        name: newUser.name,
        email: newUser.email,
        country: newUser.country,
        phone: newUser.phone,
        status: newUser.status,
        roleId: newUser.roleId
      }
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Edit a normal user's details
 */
async function editUser(req, res, next) {
  try {
    const { id } = req.params;
    const { name, email, password, country, phone, lb_name, isIB, wallet_balance } = req.body;

    const user = await User.findByPk(id, {
      include: [{ model: Role, as: 'role' }]
    });

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found.'
      });
    }

    // Ensure this is a normal user (role type = 'user')
    if (!user.role || user.role.type !== 'user') {
      return res.status(403).json({
        success: false,
        message: 'This endpoint is only for managing normal users. Use admin user management for admin/staff users.'
      });
    }

    // Check email uniqueness if being changed
    if (email && email !== user.email) {
      const existingUser = await User.findOne({ where: { email } });
      if (existingUser) {
        return res.status(409).json({
          success: false,
          message: 'A user with this email already exists.'
        });
      }
    }

    // Build update object
    const updates = {
      updatedBy: req.user.id
    };

    if (name !== undefined) updates.name = name;
    if (email !== undefined) updates.email = email;
    if (password) updates.password = password; // triggers beforeUpdate hashing hook
    if (country !== undefined) updates.country = country;
    if (phone !== undefined) updates.phone = phone;
    if (lb_name !== undefined) updates.lb_name = lb_name;
    if (isIB !== undefined) updates.isIB = isIB;
    if (wallet_balance !== undefined) updates.wallet_balance = wallet_balance;

    await user.update(updates);

    // Fetch updated user
    const updatedUser = await User.findByPk(id, {
      attributes: ['id', 'name', 'email', 'country', 'phone', 'status', 'wallet_balance', 'lb_name', 'isIB'],
      include: [{ model: Role, as: 'role', attributes: ['id', 'name', 'key'] }]
    });

    return res.status(200).json({
      success: true,
      message: 'User updated successfully.',
      data: updatedUser
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Block or unblock a normal user
 * Toggles status between 'active' and 'blocked'
 */
async function blockUser(req, res, next) {
  try {
    const { id } = req.params;
    const { action } = req.body; // 'block' or 'unblock'

    if (!action || !['block', 'unblock'].includes(action)) {
      return res.status(400).json({
        success: false,
        message: "Action is required. Must be 'block' or 'unblock'."
      });
    }

    const user = await User.findByPk(id, {
      include: [{ model: Role, as: 'role' }]
    });

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found.'
      });
    }

    // Ensure this is a normal user
    if (!user.role || user.role.type !== 'user') {
      return res.status(403).json({
        success: false,
        message: 'This endpoint is only for managing normal users.'
      });
    }

    // Prevent blocking a user that is already in the target state
    if (action === 'block' && user.status === 'blocked') {
      return res.status(400).json({
        success: false,
        message: 'User is already blocked.'
      });
    }

    if (action === 'unblock' && user.status === 'active') {
      return res.status(400).json({
        success: false,
        message: 'User is already active.'
      });
    }

    const newStatus = action === 'block' ? 'blocked' : 'active';

    await user.update({
      status: newStatus,
      updatedBy: req.user.id
    });

    return res.status(200).json({
      success: true,
      message: `User ${action === 'block' ? 'blocked' : 'unblocked'} successfully.`,
      data: {
        id: user.id,
        name: user.name,
        email: user.email,
        status: newStatus
      }
    });
  } catch (error) {
    next(error);
  }
}

module.exports = {
  getAllUsers,
  getUserById,
  addUser,
  editUser,
  blockUser
};
