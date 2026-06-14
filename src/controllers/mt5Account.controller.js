const axios = require('axios');
const { Mt5Account, User } = require('../models');
const { getToken, connectManager } = require('../utils/tokenFetch');

// Generate random password
function generateRandomPassword(length = 10) {
  const chars = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*()_+";
  let password = "";
  for (let i = 0; i < length; i++) {
    password += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  // Ensure it meets basic requirements
  password += "A1!"; 
  return password;
}

const createMT5Account = async (req, res) => {
  try {
    const isAdmin = req.user?.role?.type === 'admin';

    let groupName, leverage, mPassword, iPassword;
    let name, email, phone, country, balance, userId;

    if (isAdmin) {
      ({ groupName, leverage, userId } = req.body);
      
      if (!groupName || !leverage || !userId) {
        return res.status(400).json({ success: false, message: 'Required admin fields missing (groupName, leverage, userId).' });
      }

      // Look up target user details
      const targetUser = await User.findByPk(userId);
      if (!targetUser) {
        return res.status(404).json({ success: false, message: 'User not found.' });
      }

      name = targetUser.name;
      email = targetUser.email;
      phone = targetUser.phone || '0000000000';
      country = targetUser.country || 'Unknown';
      balance = targetUser.wallet_balance || 0;

      mPassword = generateRandomPassword();
      iPassword = generateRandomPassword();
    } else {
      // It's a normal user
      ({ groupName, leverage, mPassword, iPassword } = req.body);
      if (!groupName || !leverage || !mPassword || !iPassword) {
        return res.status(400).json({ success: false, message: 'Required user fields missing.' });
      }

      const regex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*\W).{8,}$/;
      if (!regex.test(mPassword) || !regex.test(iPassword)) {
        return res.status(400).json({
          success: false,
          message: 'Password does not meet complexity requirements.',
        });
      }

      userId = req.user.id;
      name = req.user.name;
      email = req.user.email;
      phone = req.user.phone || '0000000000';
      country = req.user.country || 'Unknown';
      balance = req.user.wallet_balance || 0;
    }
    
    // 1. Call MT5 API First
    const token = await getToken();
    const mt5Url = `${process.env.EXTERNAL_API_BASE_URL}/Home/createAccount`;
    const payload = {
      groupName,
      name,
      email,
      phone,
      country,
      balance: parseFloat(balance) || 0,
      mPassword,
      iPassword,
      leverage: parseInt(String(leverage).split(':').pop()) || 100,
    };
    
    let response;
    try {
      response = await axios.post(mt5Url, payload, {
        headers: { Authorization: `Bearer ${token}` },
      });
    } catch (err) {
      if (err.response && JSON.stringify(err.response.data).toLowerCase().includes('manager is not connected')) {
        console.log('Manager not connected. Attempting login...');
        await connectManager(token);
        response = await axios.post(mt5Url, payload, {
          headers: { Authorization: `Bearer ${token}` },
        });
      } else {
        throw err;
      }
    }

    if (response.data.message !== 'MT_RET_OK') {
      return res.status(500).json({
        success: false,
        message: 'MT5 account creation failed at gateway.',
        detail: response.data,
      });
    }

    const mt5Data = response.data.user;
    
    // mt5Data usually returns the ID in 'accountid' or 'login'
    const accountid = mt5Data.accountid || mt5Data.login;

    if (!accountid) {
       return res.status(500).json({
        success: false,
        message: 'Account created in MT5 but no account ID returned.',
        detail: response.data,
      });
    }

    // 2. Save to our Database
    const saved = await Mt5Account.create({
      accountid: accountid.toString(),
      userId: userId,
      groupName: groupName,
      leverage: leverage,
      balance: balance,
      mPassword: mPassword,
      iPassword: iPassword,
      createdBy: req.user.id,
      status: 'LIVE',
      server: 'MT5-LIVE-EU1'
    });

    return res.status(201).json({
      success: true,
      message: 'MT5 account created and stored successfully.',
      data: saved,
    });

  } catch (err) {
    if (err.response) {
      console.error('Error creating MT5 account. Gateway responded with 400:', err.response.data);
      return res.status(500).json({ success: false, message: 'MT5 Gateway Error', details: err.response.data });
    }
    console.error('Error creating MT5 account:', err.message);
    return res.status(500).json({ success: false, message: 'Internal Server Error' });
  }
};

const getMT5Accounts = async (req, res) => {
  try {
    const isAdmin = req.user?.role?.type === 'admin';

    let whereClause = {};
    if (!isAdmin) {
      whereClause.userId = req.user.id;
    }

    const accounts = await Mt5Account.findAll({
      where: whereClause,
      include: [
        { model: User, as: 'user', attributes: ['id', 'name', 'email', 'country'] }
      ],
      order: [['createdAt', 'DESC']]
    });

    return res.status(200).json({
      success: true,
      data: accounts
    });
  } catch (err) {
    console.error('Error fetching MT5 accounts:', err.message);
    return res.status(500).json({ success: false, message: 'Internal Server Error' });
  }
};

module.exports = {
  createMT5Account,
  getMT5Accounts
};
