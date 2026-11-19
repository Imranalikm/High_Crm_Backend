const { Op } = require('sequelize');
const { User, Role, Module, Mt5Account } = require('../models');
const mt5Stream = require('../services/mt5Stream');

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

    // Only real, provisioned accounts. PENDING/FAILED rows carry a copy of the
    // wallet balance from creation time and must not be counted.
    const mt5Accounts = await Mt5Account.findAll({
      where: {
        userId: req.user.id,
        status: 'LIVE',
        accountid: { [Op.notLike]: 'PENDING-%' }
      },
      attributes: ['accountid', 'balance', 'groupName']
    });

    const walletBalance = user ? parseFloat(user.wallet_balance) || 0 : 0;

    // Prefer the live MT5 feed so this matches MT5 exactly; fall back to the DB copy
    const accounts = mt5Accounts.map((acc) => {
      const live = mt5Stream.liveFor(acc.accountid);
      const balance = live ? Number(live.balance) || 0 : parseFloat(acc.balance) || 0;
      return {
        login: String(acc.accountid),
        groupName: acc.groupName,
        balance,
        equity: live ? Number(live.equity) || 0 : balance,
        isLive: !!live
      };
    });

    const mt5Balance = accounts.reduce((sum, a) => sum + a.balance, 0);
    const mt5Equity = accounts.reduce((sum, a) => sum + a.equity, 0);

    return res.status(200).json({
      success: true,
      data: {
        wallet_balance: walletBalance,
        mt5_balance: mt5Balance,
        mt5_equity: mt5Equity,
        portfolio_balance: walletBalance + mt5Balance,
        accounts
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
