const { User, Role, Module } = require('../models');

/**
 * Get user panel dashboard data
 */
async function getDashboard(req, res, next) {
  try {
    return res.status(200).json({
      success: true,
      data: {
        message: 'Welcome to your dashboard',
        userId: req.user.id,
        name: req.user.name,
        wallet_balance: req.user.wallet_balance || 0
      }
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Get user profile
 */
async function getProfile(req, res, next) {
  try {
    const user = await User.findByPk(req.user.id, {
      attributes: ['id', 'name', 'email', 'country', 'phone', 'wallet_balance', 'lb_name', 'isIB', 'status', 'createdAt'],
      include: [{ model: Role, as: 'role', attributes: ['name', 'key', 'type'] }]
    });

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found.'
      });
    }

    return res.status(200).json({
      success: true,
      data: { user }
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Update user profile
 */
async function updateProfile(req, res, next) {
  try {
    const { name, country, phone, lb_name } = req.body;
    const user = await User.findByPk(req.user.id);

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found.'
      });
    }

    await user.update({
      ...(name && { name }),
      ...(country && { country }),
      ...(phone && { phone }),
      ...(lb_name && { lb_name }),
      updatedBy: req.user.id
    });

    return res.status(200).json({
      success: true,
      message: 'Profile updated successfully.',
      data: {
        user: {
          id: user.id,
          name: user.name,
          email: user.email,
          country: user.country,
          phone: user.phone,
          lb_name: user.lb_name
        }
      }
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Get wallet balance
 */
async function getWallet(req, res, next) {
  try {
    const user = await User.findByPk(req.user.id, {
      attributes: ['id', 'wallet_balance']
    });

    return res.status(200).json({
      success: true,
      data: {
        wallet_balance: user ? user.wallet_balance : 0
      }
    });
  } catch (error) {
    next(error);
  }
}

module.exports = {
  getDashboard,
  getProfile,
  updateProfile,
  getWallet
};
