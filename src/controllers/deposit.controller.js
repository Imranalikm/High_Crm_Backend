const axios = require('axios');
const { Deposit, Mt5Account, User, sequelize } = require('../models');
const { getToken } = require('../utils/tokenFetch');
const { Op } = require('sequelize');

/* ────────────────────────────────────────────────────────────
   CREATE
   ─────────────────────────────────────────────────────────── */
const createDeposit = async (req, res) => {
  const transaction = await sequelize.transaction();
  try {
    const isAdmin = req.user?.role?.type === 'admin';
    const {
      accountId, amount, transactionId, note,
      comment, type, userId   
    } = req.body;

    if (!accountId || !amount) {
      await transaction.rollback();
      return res.status(400).json({ message: 'accountId and amount are required.' });
    }

    const createdFor = isAdmin ? userId : req.user.id;
    if (!createdFor) {
      await transaction.rollback();
      return res.status(400).json({ message: 'userId is required when admin deposits for someone else.' });
    }

    const mt5Account = await Mt5Account.findOne({ where: { accountid: accountId.toString() }, transaction });
    if (!mt5Account) {
      await transaction.rollback();
      return res.status(404).json({ message: 'MT5 account not found.' });
    }

    /* ── ADMIN: credit immediately ─────────────────────────── */
    if (isAdmin) {
      const token = await getToken();
      await axios.post(
        `${process.env.EXTERNAL_API_BASE_URL}/Home/balanceOP`,
        { loginid: Number(accountId), amount: Number(amount), txnType: 0, description: note || '', comment: comment || '' },
        { headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` } }
      );
      mt5Account.balance = (parseFloat(mt5Account.balance) || 0) + Number(amount);
      await mt5Account.save({ transaction });
    }

    /* Save deposit record */
    const deposit = await Deposit.create(
      {
        accountId: accountId.toString(),
        amount,
        type:          isAdmin ? null : type,
        transactionId: !isAdmin && type === 'bank' ? transactionId : null,
        note:          !isAdmin ? note || ''  : undefined,
        comment:        isAdmin ? comment || '' : undefined,
        depositProof:  !isAdmin ? req.file?.path || '' : undefined,
        createdBy:     req.user.id,
        createdFor,
        role:          isAdmin ? 'admin' : 'user',
        status:        isAdmin ? 'approved' : 'pending',
      },
      { transaction }
    );

    await transaction.commit();

    res.status(201).json({
      message: isAdmin
        ? 'Deposit credited and approved.'
        : 'Deposit recorded and awaiting admin approval.',
      deposit,
    });
  } catch (err) {
    await transaction.rollback();
    console.error('createDeposit error:', err);
    res.status(500).json({ message: 'Internal Server Error' });
  }
};

/* ────────────────────────────────────────────────────────────
   APPROVE
   ─────────────────────────────────────────────────────────── */
const approveDeposit = async (req, res) => {
  if (req.user?.role?.type !== 'admin')
    return res.status(403).json({ message: 'Only admins can approve deposits.' });

  const { id } = req.params;
  const transaction = await sequelize.transaction();
  try {
    const deposit = await Deposit.findOne({ where: { id }, transaction });
    if (!deposit) {
      await transaction.rollback();
      return res.status(404).json({ message: 'Deposit not found.' });
    }
    if (deposit.status !== 'pending') {
      await transaction.rollback();
      return res.status(400).json({ message: `Deposit already ${deposit.status}.` });
    }

    const mt5Account = await Mt5Account.findOne({ where: { accountid: deposit.accountId }, transaction });
    if (!mt5Account) {
      await transaction.rollback();
      return res.status(404).json({ message: 'MT5 account not found.' });
    }

    /* External credit */
    const token = await getToken();
    await axios.post(
      `${process.env.EXTERNAL_API_BASE_URL}/Home/balanceOP`,
      { loginid: Number(deposit.accountId), amount: Number(deposit.amount), txnType: 0, description: deposit.note || '', comment: deposit.comment || '' },
      { headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` } }
    );

    mt5Account.balance = (parseFloat(mt5Account.balance) || 0) + Number(deposit.amount);
    await mt5Account.save({ transaction });
    
    deposit.status = 'approved';
    await deposit.save({ transaction });

    await transaction.commit();

    res.json({ message: 'Deposit approved and balance updated.', deposit });
  } catch (err) {
    await transaction.rollback();
    console.error('approveDeposit error:', err);
    res.status(500).json({ message: 'Internal Server Error' });
  }
};

/* ────────────────────────────────────────────────────────────
   REJECT
   ─────────────────────────────────────────────────────────── */
const rejectDeposit = async (req, res) => {
  if (req.user?.role?.type !== 'admin')
    return res.status(403).json({ message: 'Only admins can reject deposits.' });

  const { id } = req.params;
  const { reason } = req.body || {};
  const transaction = await sequelize.transaction();
  try {
    const deposit = await Deposit.findOne({ where: { id }, transaction });
    if (!deposit) {
      await transaction.rollback();
      return res.status(404).json({ message: 'Deposit not found.' });
    }
    if (deposit.status !== 'pending') {
      await transaction.rollback();
      return res.status(400).json({ message: `Deposit already ${deposit.status}.` });
    }

    deposit.status = 'rejected';
    if (reason) deposit.comment = reason;
    await deposit.save({ transaction });

    await transaction.commit();

    res.json({ message: 'Deposit rejected.', deposit });
  } catch (err) {
    await transaction.rollback();
    console.error('rejectDeposit error:', err);
    res.status(500).json({ message: 'Internal Server Error' });
  }
};


const getDepositsForAdmin = async (req, res) => {
  try {
    const { status, from, to, method } = req.query;

    /* ── build where clause ─────────────────────── */
    const where = {};
    if (status && status !== 'ALL') where.status = status.toLowerCase();
    if (method && method !== 'ALL') where.type  = method.toLowerCase();

    /* optional date / time span */
    if (from || to) {
      const fromDate = from ? new Date(from) : null;
      const toDate   = to   ? new Date(to)   : null;

      if ((from && isNaN(fromDate)) || (to && isNaN(toDate)))
        return res.status(400).json({ message: 'Dates must be ISO strings (YYYY-MM-DD or full ISO-8601).' });

      // normalise time bounds (00:00:00 ➜ 23:59:59.999)
      if (fromDate) fromDate.setHours(0, 0, 0, 0);
      if (toDate)   toDate.setHours(23, 59, 59, 999);

      if (from && to)      where.createdAt = { [Op.between]: [fromDate, toDate] };
      else if (from)       where.createdAt = { [Op.gte]: fromDate };
      else if (to)         where.createdAt = { [Op.lte]: toDate };
    }

    /* ── query ───────────────────────────────────── */
    const deposits = await Deposit.findAll({
      where,
      order: [['createdAt', 'DESC']],
      include: [
        { model: User, as: 'creator',   attributes: ['id', 'name', 'email'] },
        { model: User, as: 'recipient', attributes: ['id', 'name', 'email'] },
        { model: Mt5Account, as: 'mt5Account', attributes: ['groupName'] }
      ],
    });

    res.json({ success: true, data: deposits });
  } catch (err) {
    console.error('getDepositsForAdmin error:', err);
    res.status(500).json({ message: 'Internal Server Error' });
  }
};


/* ────────────────────────────────────────────────────────────
   LIST FOR A USER (self-service history)
   ─────────────────────────────────────────────────────────── */
const getDepositsByUserId = async (req, res) => {
  try {
    // If not admin, restrict to own id
    const userId = req.user.id;
    const { from, to } = req.query;

    const where = { createdFor: userId };

    /* optional date range */
    if (from || to) {
      const fromDate = from ? new Date(from) : null;
      const toDate   = to   ? new Date(to)   : null;

      if ((from && isNaN(fromDate)) || (to && isNaN(toDate)))
        return res.status(400).json({ message: 'Dates must be ISO strings (YYYY-MM-DD).' });

      if (fromDate) fromDate.setHours(0, 0, 0, 0);
      if (toDate)   toDate.setHours(23, 59, 59, 999);

      if (from && to)      where.createdAt = { [Op.between]: [fromDate, toDate] };
      else if (from)       where.createdAt = { [Op.gte]: fromDate };
      else if (to)         where.createdAt = { [Op.lte]: toDate };
    }

    const deposits = await Deposit.findAll({
      where,
      order: [['createdAt', 'DESC']],
      include: [
        { model: User, as: 'creator',   attributes: ['id', 'name', 'email'] },
        { model: User, as: 'recipient', attributes: ['id', 'name', 'email'] },
        { model: Mt5Account, as: 'mt5Account', attributes: ['groupName'] }
      ],
    });

    res.json({ success: true, data: deposits });
  } catch (err) {
    console.error('getDepositsByUserId error:', err);
    res.status(500).json({ message: 'Internal Server Error' });
  }
};

module.exports = {
  createDeposit,
  approveDeposit,
  rejectDeposit,
  getDepositsForAdmin,
  getDepositsByUserId
};
