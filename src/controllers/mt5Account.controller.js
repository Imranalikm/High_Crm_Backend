const axios = require('axios');
const { Op } = require('sequelize');
const { Mt5Account, User, CrmGroup } = require('../models');
const { getToken, connectManager } = require('../utils/tokenFetch');
const { mt5BalanceOperation } = require('../utils/mt5Balance');
const { sendMt5CredentialsEmail, sendMt5PasswordUpdateEmail } = require('../utils/email.helper');
const { getDemoSettingsRecord } = require('./demoSetting.controller');
const VALID_COUNTRIES = require('../utils/countries.constant');

const MT5_SERVER_NAME = process.env.MT5_SERVER_NAME || 'Agile';


// Generate random password
function generateRandomPassword(length = 10) {
  const chars = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!#_-";
  let password = "";
  for (let i = 0; i < length; i++) {
    password += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  // Ensure it meets basic requirements
  password += "@A1";
  return password;
}

/**
 * Create the account on the MT5 gateway.
 * Returns { ok, accountid, detail }. Throws on gateway/network errors.
 */
async function provisionOnMt5({ groupName, name, country, balance, leverage, mPassword, iPassword }) {
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
  console.log('[MT5 API Request] Group:', payload.groupName, 'Leverage:', payload.leverage);

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
    return { ok: false, message: 'MT5 account creation failed at gateway.', detail: response.data };
  }

  // mt5Data usually returns the ID in 'accountid' or 'login'
  const mt5Data = response.data.user || {};
  const accountid = mt5Data.accountid || mt5Data.login;

  if (!accountid) {
    return { ok: false, message: 'Account created in MT5 but no account ID returned.', detail: response.data };
  }

  return { ok: true, accountid: accountid.toString() };
}

const createMT5Account = async (req, res) => {
  try {
    const isAdmin = req.user?.role?.type === 'admin';

    let groupName, leverage, mPassword, iPassword;
    let name, email, country, balance, userId;

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
      country = req.user.country || 'Unknown';
      balance = req.user.wallet_balance || 0;
    }

    // Demo groups are only provisioned through the public demo flow
    const selectedGroup = await CrmGroup.findOne({ where: { name: groupName } });
    if (selectedGroup && selectedGroup.groupType === 'Demo') {
      return res.status(400).json({ success: false, message: 'Demo groups cannot be used for live accounts.' });
    }

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
        accountType: 'LIVE',
        server: MT5_SERVER_NAME
      });
    } catch (dbErr) {
      console.error('Failed to create initial DB record:', dbErr.message);
      return res.status(500).json({ success: false, message: 'Database failure before contacting MT5.' });
    }

    // 2. Call MT5 API
    let result;
    try {
      result = await provisionOnMt5({ groupName, name, country, balance, leverage, mPassword, iPassword });
    } catch (err) {
      await savedAccount.update({ status: 'FAILED' });
      throw err;
    }

    if (!result.ok) {
      await savedAccount.update({ status: 'FAILED' });
      return res.status(500).json({ success: false, message: result.message, detail: result.detail });
    }

    // 3. Update Database with Real Account ID and LIVE status
    await savedAccount.update({
      accountid: result.accountid,
      status: 'LIVE'
    });

    // Send MT5 account creation credentials email (non-blocking)
    sendMt5CredentialsEmail(
      email,
      name,
      result.accountid,
      mPassword,
      iPassword,
      groupName,
      leverage,
      MT5_SERVER_NAME
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

/**
 * Public: instantly create an MT5 demo account (no CRM user).
 */
const createDemoMT5Account = async (req, res) => {
  try {
    const name = String(req.body.name || '').trim();
    const email = String(req.body.email || '').trim().toLowerCase();
    const phone = String(req.body.phone || '').trim();
    const country = String(req.body.country || '').trim();

    if (!name || !email || !phone || !country) {
      return res.status(400).json({ success: false, message: 'Name, email, phone, and country are required.' });
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return res.status(400).json({ success: false, message: 'Invalid email address.' });
    }
    if (!VALID_COUNTRIES.includes(country)) {
      return res.status(400).json({ success: false, message: 'Invalid country selected.' });
    }
    if (!/^\+\d{7,15}$/.test(phone)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid phone number format. Must include country code (e.g., +919876543210).'
      });
    }

    // Admin-configured demo settings (group, balance, leverage, cooldown)
    const settings = await getDemoSettingsRecord();
    if (!settings.enabled) {
      return res.status(403).json({ success: false, message: 'Demo account registration is currently disabled.' });
    }
    const groupName = settings.mt5GroupName;
    const leverage = settings.leverage || '1:100';
    const initialBalance = parseFloat(settings.initialBalance) || 0;
    const cooldownHours = Number(settings.cooldownHours) || 0;

    // Abuse guard: one demo account per email per cooldown window (0 = unlimited)
    if (cooldownHours > 0) {
      const recent = await Mt5Account.findOne({
        where: {
          accountType: 'DEMO',
          contactEmail: email,
          status: { [Op.ne]: 'FAILED' },
          createdAt: { [Op.gte]: new Date(Date.now() - cooldownHours * 60 * 60 * 1000) }
        }
      });
      if (recent) {
        return res.status(429).json({
          success: false,
          message: `A demo account was already created for this email in the last ${cooldownHours} hours. Please check your inbox.`
        });
      }
    }

    const mPassword = generateRandomPassword();
    const iPassword = generateRandomPassword();

    const savedAccount = await Mt5Account.create({
      accountid: `PENDING-${Date.now()}`,
      userId: null,
      accountType: 'DEMO',
      contactName: name,
      contactEmail: email,
      contactPhone: phone,
      contactCountry: country,
      groupName,
      leverage,
      balance: 0,
      mPassword,
      iPassword,
      createdBy: null,
      status: 'PENDING',
      server: MT5_SERVER_NAME
    });

    let result;
    try {
      result = await provisionOnMt5({
        groupName,
        name,
        country,
        balance: 0,
        leverage,
        mPassword,
        iPassword
      });
    } catch (err) {
      await savedAccount.update({ status: 'FAILED' });
      throw err;
    }

    if (!result.ok) {
      await savedAccount.update({ status: 'FAILED' });
      return res.status(502).json({ success: false, message: 'Could not create demo account. Please try again later.' });
    }

    await savedAccount.update({ accountid: result.accountid, status: 'LIVE' });

    // Credit the configured initial balance through the MT5 deposit API (not recorded as a Deposit)
    let creditedBalance = 0;
    if (initialBalance > 0) {
      try {
        await mt5BalanceOperation(result.accountid, initialBalance, 'Demo initial balance');
        creditedBalance = initialBalance;
        await savedAccount.update({ balance: creditedBalance });
      } catch (err) {
        console.warn(
          `[MT5 Demo] Account ${result.accountid} created but initial balance credit failed:`,
          err.response?.data || err.message
        );
      }
    }

    sendMt5CredentialsEmail(
      email,
      name,
      result.accountid,
      mPassword,
      iPassword,
      groupName,
      leverage,
      MT5_SERVER_NAME,
      true
    ).catch(err => {
      console.error(`[MT5 Demo] Failed to send demo credentials email to ${email}:`, err.message);
    });

    return res.status(201).json({
      success: true,
      message: 'Demo account created successfully. Credentials have been sent to your email.',
      data: {
        login: result.accountid,
        server: MT5_SERVER_NAME,
        groupName,
        leverage,
        balance: creditedBalance,
        mPassword,
        iPassword
      }
    });
  } catch (err) {
    if (err.response) {
      console.error('Error creating MT5 demo account. Gateway responded with:', err.response.data);
    } else {
      console.error('Error creating MT5 demo account:', err.message);
    }
    return res.status(502).json({ success: false, message: 'Could not create demo account. Please try again later.' });
  }
};

/**
 * Public: whether demo account registration is enabled (used by the login page).
 */
const getDemoStatus = async (req, res) => {
  try {
    const settings = await getDemoSettingsRecord();
    return res.status(200).json({ success: true, data: { enabled: Boolean(settings.enabled) } });
  } catch (err) {
    console.error('Error fetching demo status:', err.message);
    return res.status(500).json({ success: false, message: 'Internal Server Error' });
  }
};

/**
 * Admin: add (positive) or deduct (negative) balance on a DEMO account.
 * Uses the MT5 deposit API; no Deposit record is created.
 */
const adjustDemoBalance = async (req, res) => {
  try {
    const amount = Number(req.body.amount);
    const comment = String(req.body.comment || '').trim() || 'Demo balance adjustment';

    if (!Number.isFinite(amount) || amount === 0) {
      return res.status(400).json({ success: false, message: 'Amount must be a non-zero number.' });
    }

    const account = await Mt5Account.findOne({ where: { accountid: String(req.params.accountid) } });
    if (!account) {
      return res.status(404).json({ success: false, message: 'MT5 account not found.' });
    }
    if (account.accountType !== 'DEMO') {
      return res.status(400).json({ success: false, message: 'Balance adjustments here are only allowed for demo accounts.' });
    }
    if (account.status !== 'LIVE') {
      return res.status(400).json({ success: false, message: 'Demo account is not active on MT5.' });
    }

    const currentBalance = parseFloat(account.balance) || 0;
    if (amount < 0 && Math.abs(amount) > currentBalance) {
      return res.status(400).json({ success: false, message: `Cannot deduct more than the current balance (${currentBalance.toFixed(2)}).` });
    }

    const { dealId } = await mt5BalanceOperation(account.accountid, amount, comment);

    const newBalance = Math.round((currentBalance + amount) * 100) / 100;
    await account.update({ balance: newBalance });

    console.log(`[MT5 Demo] Balance ${amount > 0 ? 'added' : 'deducted'} on ${account.accountid}: ${amount} by admin ${req.user.id}`);

    return res.status(200).json({
      success: true,
      message: amount > 0 ? 'Demo balance added.' : 'Demo balance deducted.',
      data: { balance: newBalance, dealId }
    });
  } catch (err) {
    if (err.response) {
      console.error('Error adjusting demo balance. Gateway responded with:', err.response.data);
      return res.status(502).json({ success: false, message: 'MT5 Gateway Error', details: err.response.data });
    }
    console.error('Error adjusting demo balance:', err.message);
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
    } else {
      const type = String(req.query.type || '').toUpperCase();
      if (type === 'LIVE' || type === 'DEMO') {
        whereClause.accountType = type;
      }
    }

    const accounts = await Mt5Account.findAll({
      where: whereClause,
      include: [
        { model: User, as: 'user', attributes: ['id', 'name', 'email', 'country'] }
      ],
      order: [['createdAt', 'DESC']]
    });

    const crmGroups = await CrmGroup.findAll();
    const accountsWithMinDeposit = accounts.map(acc => {
      const group = crmGroups.find(g => g.name === acc.groupName);
      return {
        ...acc.toJSON(),
        minDeposit: group ? group.minDeposit : 0
      };
    });

    return res.status(200).json({
      success: true,
      data: accountsWithMinDeposit
    });
  } catch (err) {
    console.error('Error fetching MT5 accounts:', err.message);
    return res.status(500).json({ success: false, message: 'Internal Server Error' });
  }
};

/**
 * Admin: get a single MT5 account by its login (accountid).
 */
const getMT5AccountByLogin = async (req, res) => {
  try {
    const account = await Mt5Account.findOne({
      where: { accountid: String(req.params.accountid) },
      include: [
        { model: User, as: 'user', attributes: ['id', 'name', 'email', 'country'] }
      ]
    });

    if (!account) {
      return res.status(404).json({ success: false, message: 'MT5 account not found.' });
    }

    return res.status(200).json({ success: true, data: account });
  } catch (err) {
    console.error('Error fetching MT5 account:', err.message);
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
  createDemoMT5Account,
  getDemoStatus,
  adjustDemoBalance,
  getMT5Accounts,
  getMT5AccountByLogin,
  updateMT5Password
};
