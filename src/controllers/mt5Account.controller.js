const axios = require('axios');
const { Op } = require('sequelize');
const { Mt5Account, User, CrmGroup } = require('../models');
const { getToken, connectManager } = require('../utils/tokenFetch');
const { sendMt5CredentialsEmail, sendMt5PasswordUpdateEmail } = require('../utils/email.helper');


// Generate random password
function generateRandomPassword(length = 10) {
  const chars = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!#_-";
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
      ({ groupName, leverage } = req.body);
      if (!groupName || !leverage) {
        return res.status(400).json({ success: false, message: 'Required user fields missing (groupName, leverage).' });
      }

      mPassword = generateRandomPassword();
      iPassword = generateRandomPassword();

      userId = req.user.id;
      name = req.user.name;
      email = req.user.email;
      phone = req.user.phone || '0000000000';
      country = req.user.country || 'Unknown';
      balance = req.user.wallet_balance || 0;
    }

    console.log('🔑 Generated Passwords - Master:', mPassword, 'Investor:', iPassword);
    
    // 1. Save to Database FIRST in PENDING state
    let savedAccount;
    try {
      savedAccount = await Mt5Account.create({
        accountid: `PENDING-${Date.now()}`,
        userId: userId,
        groupName: groupName,
        leverage: leverage,
        balance: balance,
        mPassword: mPassword,
        iPassword: iPassword,
        createdBy: req.user.id,
        status: 'PENDING',
        server: 'Agile'
      });
    } catch (dbErr) {
      console.error('Failed to create initial DB record:', dbErr.message);
      return res.status(500).json({ success: false, message: 'Database failure before contacting MT5.' });
    }

    // 2. Call MT5 API
    const token = await getToken();
    const mt5Url = `${process.env.EXTERNAL_API_BASE_URL}/Home/createAccount`;
    // Look up the CRM Group to get the mapped MT5 Group Name
    const crmGroupRec = await CrmGroup.findOne({ where: { name: groupName } });
    const mappedMt5GroupName = crmGroupRec && crmGroupRec.mt5GroupName ? crmGroupRec.mt5GroupName : groupName;

    const payload = {
      groupName: mappedMt5GroupName,
      name,
      email: '',
      phone: '',
      country,
      balance: parseFloat(balance) || 0,
      mPassword,
      iPassword,
      leverage: parseInt(String(leverage).split(':').pop()) || 100,
    };
    
    console.log('[MT5 API Request] URL:', mt5Url);
    console.log('[MT5 API Request] Payload:', JSON.stringify(payload, null, 2));

    let response;
    try {
      response = await axios.post(mt5Url, payload, {
        headers: { Authorization: `Bearer ${token}` },
      });
      console.log('[MT5 API Response] Success Status:', response.status);
      console.log('[MT5 API Response] Success Data:', JSON.stringify(response.data, null, 2));
    } catch (err) {
      if (err.response && JSON.stringify(err.response.data).toLowerCase().includes('manager is not connected')) {
        console.log('Manager not connected. Attempting login...');
        await connectManager(token);
        console.log('[MT5 API Request retry] URL:', mt5Url);
        response = await axios.post(mt5Url, payload, {
          headers: { Authorization: `Bearer ${token}` },
        });
        console.log('[MT5 API Response retry] Success Status:', response.status);
        console.log('[MT5 API Response retry] Success Data:', JSON.stringify(response.data, null, 2));
      } else {
        if (err.response) {
          console.error('[MT5 API Error Response] Status:', err.response.status);
          console.error('[MT5 API Error Response] Data:', JSON.stringify(err.response.data, null, 2));
        } else {
          console.error('[MT5 API Error Response] Message:', err.message);
        }
        await savedAccount.update({ status: 'FAILED' });
        throw err;
      }
    }

    const isSuccess = 
      response.data.retcode === 'MT_RET_OK' || 
      response.data.retcode === 0 || 
      response.data.message === 'MT_RET_OK' || 
      response.data.message === 0 ||
      response.data.message === 'User created successfully';

    if (!isSuccess) {
      await savedAccount.update({ status: 'FAILED' });
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
       await savedAccount.update({ status: 'FAILED' });
       return res.status(500).json({
        success: false,
        message: 'Account created in MT5 but no account ID returned.',
        detail: response.data,
      });
    }

    // 3. Update Database with Real Account ID and LIVE status
    await savedAccount.update({
      accountid: accountid.toString(),
      status: 'LIVE'
    });

    // Send MT5 account creation credentials email (non-blocking)
    sendMt5CredentialsEmail(
      email,
      name,
      accountid.toString(),
      mPassword,
      iPassword,
      groupName,
      leverage,
      'Agile'
    ).catch(err => {
      console.error(`[MT5 Create] Failed to send MT5 credentials email to ${email}:`, err.message);
    });

    return res.status(201).json({
      success: true,
      message: 'MT5 account created and stored successfully.',
      data: savedAccount,
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
      whereClause.status = 'LIVE';
      whereClause.accountid = { [Op.notLike]: 'PENDING-%' };
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

function isValidMT5Password(password) {
  if (!password || password.length < 8 || password.length > 16) return false;
  const hasUppercase = /[A-Z]/.test(password);
  const hasLowercase = /[a-z]/.test(password);
  const hasDigit = /[0-9]/.test(password);
  const hasSpecial = /[^A-Za-z0-9]/.test(password);
  return hasUppercase && hasLowercase && hasDigit && hasSpecial;
}

const updateMT5Password = async (req, res) => {
  try {
    const { accountid, mPassword, iPassword } = req.body;
    
    if (!accountid || !mPassword || !iPassword) {
      return res.status(400).json({ success: false, message: 'Missing required fields (accountid, mPassword, iPassword).' });
    }

    if (!isValidMT5Password(mPassword)) {
      return res.status(400).json({
        success: false,
        message: 'Master password must be 8-16 characters and contain at least one uppercase letter, one lowercase letter, one number, and one special character.'
      });
    }

    if (!isValidMT5Password(iPassword)) {
      return res.status(400).json({
        success: false,
        message: 'Investor password must be 8-16 characters and contain at least one uppercase letter, one lowercase letter, one number, and one special character.'
      });
    }

    const userId = req.user.id;
    const account = await Mt5Account.findOne({
      where: {
        accountid: accountid.toString(),
        userId: userId,
        status: 'LIVE'
      },
      include: [{ model: User, as: 'user' }]
    });

    if (!account) {
      return res.status(404).json({ success: false, message: 'Active MT5 account not found or does not belong to you.' });
    }

    // Call MT5 API
    const token = await getToken();
    const mt5Url = `${process.env.EXTERNAL_API_BASE_URL}/Home/updatePwd`;
    
    const payload = {
      loginId: parseInt(accountid),
      mPassword: mPassword,
      iPassword: iPassword
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

    const isSuccess = 
      response.data.retcode === 'MT_RET_OK' || 
      response.data.retcode === 0 || 
      response.data.message === 'MT_RET_OK' || 
      response.data.message === 0 ||
      response.data.message?.toLowerCase().includes('success');

    if (!isSuccess) {
      return res.status(500).json({
        success: false,
        message: 'Failed to update MT5 password at gateway.',
        detail: response.data,
      });
    }

    // Update DB
    await account.update({
      mPassword: mPassword,
      iPassword: iPassword
    });

    // Send Email
    const name = account.user ? account.user.name : req.user.name;
    const email = account.user ? account.user.email : req.user.email;
    sendMt5PasswordUpdateEmail(email, name, accountid, mPassword, iPassword).catch(err => {
      console.error(`[MT5 Update Password] Failed to send email to ${email}:`, err.message);
    });

    return res.status(200).json({
      success: true,
      message: 'MT5 password updated successfully.'
    });
  } catch (err) {
    if (err.response) {
      console.error('Error updating MT5 password. Gateway responded with 400:', err.response.data);
      return res.status(500).json({ success: false, message: 'MT5 Gateway Error', details: err.response.data });
    }
    console.error('Error updating MT5 password:', err.message);
    return res.status(500).json({ success: false, message: 'Internal Server Error' });
  }
};

module.exports = {
  createMT5Account,
  getMT5Accounts,
  updateMT5Password
};
