const axios = require('axios');
const { Withdrawal, Mt5Account, User, sequelize } = require('../models');
const { getToken, connectManager } = require('../utils/tokenFetch');
const { Op } = require('sequelize');

const createWithdrawal = async (req, res) => {
  const transaction = await sequelize.transaction();
  try {
    const isAdmin = req.user?.role?.type === 'admin';
    const createdBy = req.user.id;
    const {
      accountId, amount, type, note,
      bankAccount, userId, comment
    } = req.body;

    if (!accountId || !amount || (!isAdmin && !type)) {
      await transaction.rollback();
      return res.status(400).json({ message: 'Required fields missing.' });
    }

    if (!isAdmin && !['bank', 'cash', 'crypto', 'skrill'].includes(type)) {
      await transaction.rollback();
      return res.status(400).json({ message: 'Invalid type.' });
    }

    const mt5Account = await Mt5Account.findOne({ where: { accountid: String(accountId) }, transaction });
    if (!mt5Account) {
      await transaction.rollback();
      return res.status(404).json({ message: 'MT5 account not found.' });
    }

    // createdFor user (if admin), or self (if user)
    const createdFor = isAdmin ? userId : req.user.id;
    if (!createdFor) {
      await transaction.rollback();
      return res.status(400).json({ message: 'User ID is required for admin withdrawals.' });
    }

    if (isAdmin && (parseFloat(mt5Account.balance) || 0) < Number(amount)) {
      await transaction.rollback();
      return res.status(400).json({ message: 'Insufficient MT5 balance.' });
    }

    if (isAdmin) {
      try {
        const token = await getToken();
        const mt5Url = `${process.env.EXTERNAL_API_BASE_URL}/Home/balanceOP`;
        const payload = {
          loginid: Number(accountId),
          amount: -Math.abs(Number(amount)),
          txnType: 0, 
          description: note || '',
          comment: comment || '',
        };
        
        let mt5Response;
        try {
          mt5Response = await axios.post(mt5Url, payload, {
            headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }
          });
          console.log('MT5 Server Response (Withdrawal):', mt5Response.data);
        } catch (err) {
          if (err.response && JSON.stringify(err.response.data).toLowerCase().includes('manager is not connected')) {
            await connectManager(token);
            mt5Response = await axios.post(mt5Url, payload, {
              headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }
            });
            console.log('MT5 Server Response after reconnect (Withdrawal):', mt5Response.data);
          } else {
            console.error('MT5 Server Error (Withdrawal):', err.response?.data || err.message);
            throw err;
          }
        }

        mt5Account.balance = (parseFloat(mt5Account.balance) || 0) - Number(amount);
        await mt5Account.save({ transaction });
      } catch (err) {
        await transaction.rollback();
        console.error('External API error:', err);
        return res.status(500).json({ message: 'Failed to process external withdrawal.' });
      }
    }

    const withdrawal = await Withdrawal.create(
      {
        accountId: String(accountId),
        amount,
        type: isAdmin ? null : type,
        note: note || '',
        comment: comment || '',
        bankAccount: isAdmin || type === 'cash' ? null : bankAccount,
        createdBy,
        createdFor,
        role: isAdmin ? 'admin' : 'user',
        status: isAdmin ? 'approved' : 'pending',
      },
      { transaction }
    );

    await transaction.commit();

    res.status(201).json({
      message: isAdmin
        ? 'Withdrawal processed and approved.'
        : 'Withdrawal request sent for approval.',
      withdrawal,
    });
  } catch (err) {
    if (!transaction.finished) await transaction.rollback();
    console.error('createWithdrawal error:', err);
    res.status(500).json({ message: 'Internal Server Error' });
  }
};

const approveWithdrawal = async (req, res) => {
  if (req.user?.role?.type !== 'admin')
    return res.status(403).json({ message: 'Only admins can approve withdrawals.' });

  const { id } = req.params;
  const transaction = await sequelize.transaction();
  try {
    const withdrawal = await Withdrawal.findOne({ where: { id }, transaction });
    if (!withdrawal) {
      await transaction.rollback();
      return res.status(404).json({ message: 'Withdrawal not found.' });
    }

    if (withdrawal.status !== 'pending') {
      await transaction.rollback();
      return res.status(400).json({ message: `Already ${withdrawal.status}.` });
    }

    const mt5Account = await Mt5Account.findOne({ where: { accountid: String(withdrawal.accountId) }, transaction });
    if (!mt5Account) {
      await transaction.rollback();
      return res.status(404).json({ message: 'MT5 account not found.' });
    }

    if ((parseFloat(mt5Account.balance) || 0) < Number(withdrawal.amount)) {
      await transaction.rollback();
      return res.status(400).json({ message: 'Insufficient MT5 balance.' });
    }

    const token = await getToken();
    const mt5Url = `${process.env.EXTERNAL_API_BASE_URL}/Home/balanceOP`;
    const payload = {
      loginid: Number(withdrawal.accountId),
      amount: -Math.abs(Number(withdrawal.amount)),
      txnType: 0,
      description: withdrawal.note || '',
      comment: '',
    };
    
    let mt5Response;
    try {
      mt5Response = await axios.post(mt5Url, payload, {
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }
      });
    } catch (err) {
      if (err.response && JSON.stringify(err.response.data).toLowerCase().includes('manager is not connected')) {
        await connectManager(token);
        mt5Response = await axios.post(mt5Url, payload, {
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }
        });
      } else {
        throw err;
      }
    }

    mt5Account.balance = (parseFloat(mt5Account.balance) || 0) - Number(withdrawal.amount);
    await mt5Account.save({ transaction });

    withdrawal.status = 'approved';
    await withdrawal.save({ transaction });

    await transaction.commit();

    res.json({ message: 'Withdrawal approved.', withdrawal });
  } catch (err) {
    await transaction.rollback();
    console.error('approveWithdrawal error:', err);
    res.status(500).json({ message: 'Internal Server Error' });
  }
};

const rejectWithdrawal = async (req, res) => {
  if (req.user?.role?.type !== 'admin')
    return res.status(403).json({ message: 'Only admins can reject withdrawals.' });

  const { id } = req.params;
  const { reason } = req.body ?? {};
  const transaction = await sequelize.transaction();

  try {
    const withdrawal = await Withdrawal.findOne({ where: { id }, transaction });
    if (!withdrawal) {
      await transaction.rollback();
      return res.status(404).json({ message: 'Withdrawal not found.' });
    }

    if (withdrawal.status !== 'pending') {
      await transaction.rollback();
      return res.status(400).json({ message: `Already ${withdrawal.status}.` });
    }

    withdrawal.status = 'rejected';
    if (reason) withdrawal.comment = reason;
    await withdrawal.save({ transaction });

    await transaction.commit();

    res.json({ message: 'Withdrawal rejected.', withdrawal });
  } catch (err) {
    await transaction.rollback();
    console.error('rejectWithdrawal error:', err);
    res.status(500).json({ message: 'Internal Server Error' });
  }
};

const getWithdrawalsForAdmin = async (req, res) => {
  try {
    const { status, from, to, method } = req.query;

    const where = {};
    if (status && status !== 'ALL') where.status = status.toLowerCase();
    if (method && method !== 'ALL') where.type = method.toLowerCase();

    if (from || to) {
      const fromDate = from ? new Date(from) : null;
      const toDate = to ? new Date(to) : null;

      if ((from && isNaN(fromDate)) || (to && isNaN(toDate)))
        return res.status(400).json({ message: 'Invalid dates.' });

      if (fromDate) fromDate.setHours(0, 0, 0, 0);
      if (toDate) toDate.setHours(23, 59, 59, 999);

      if (from && to) where.createdAt = { [Op.between]: [fromDate, toDate] };
      else if (from) where.createdAt = { [Op.gte]: fromDate };
      else if (to) where.createdAt = { [Op.lte]: toDate };
    }

    const withdrawals = await Withdrawal.findAll({
      where,
      include: [
        { model: User, as: 'creator', attributes: ['id', 'name', 'email'] },
        { model: User, as: 'recipient', attributes: ['id', 'name', 'email'] },
      ],
      order: [['createdAt', 'DESC']],
    });

    res.json({ withdrawals });
  } catch (err) {
    console.error('getWithdrawalsForAdmin error:', err);
    res.status(500).json({ message: 'Internal Server Error' });
  }
};

const getWithdrawalById = async (req, res) => {
  try {
    const { id } = req.params;
    const withdrawal = await Withdrawal.findOne({
      where: { id },
      include: [
        { model: User, as: 'creator', attributes: ['id', 'name', 'email'] },
        { model: User, as: 'recipient', attributes: ['id', 'name', 'email'] },
      ],
    });

    if (!withdrawal) {
      return res.status(404).json({ message: 'Withdrawal not found.' });
    }

    res.json({ withdrawal });
  } catch (err) {
    console.error('getWithdrawalById error:', err);
    res.status(500).json({ message: 'Internal Server Error' });
  }
};

const getWithdrawalsByUserId = async (req, res) => {
  try {
    const userId = req.user.id;
    const { from, to } = req.query;

    const where = { createdFor: userId };

    if (from || to) {
      const fromDate = from ? new Date(from) : null;
      const toDate = to ? new Date(to) : null;

      if ((from && isNaN(fromDate)) || (to && isNaN(toDate)))
        return res.status(400).json({ message: 'Invalid date format.' });

      if (fromDate) fromDate.setHours(0, 0, 0, 0);
      if (toDate) toDate.setHours(23, 59, 59, 999);

      if (from && to) where.createdAt = { [Op.between]: [fromDate, toDate] };
      else if (from) where.createdAt = { [Op.gte]: fromDate };
      else if (to) where.createdAt = { [Op.lte]: toDate };
    }

    const withdrawals = await Withdrawal.findAll({
      where,
      include: [
        { model: User, as: 'creator', attributes: ['id', 'name', 'email'] },
        { model: User, as: 'recipient', attributes: ['id', 'name', 'email'] },
      ],
      order: [['createdAt', 'DESC']],
    });

    res.json({ withdrawals });
  } catch (err) {
    console.error('getWithdrawalsByUserId error:', err);
    res.status(500).json({ message: 'Internal Server Error' });
  }
};

module.exports = {
  createWithdrawal,
  approveWithdrawal,
  rejectWithdrawal,
  getWithdrawalsForAdmin,
  getWithdrawalById,
  getWithdrawalsByUserId
};

