/**
 * Admin balance operations other than deposits/withdrawals.
 * Posts to the MT5 gateway balanceOP endpoint with the chosen transactionType
 * and keeps an audit record of every attempt (completed or failed).
 */
const { Op } = require('sequelize');
const { BalanceOperation, Mt5Account, User } = require('../models');
const { mt5BalanceOperation, TXN } = require('../utils/mt5Balance');
const { emitFinanceUpdate } = require('../utils/financeEvents');

// Deposit (0) and Withdrawal (1) are handled by their own modules
const OPERATION_TYPES = {
  [TXN.CREDIT]: 'Credit',
  [TXN.CHARGE]: 'Charge',
  [TXN.CORRECTION]: 'Correction',
  [TXN.BONUS]: 'Bonus',
  [TXN.COMMISSION]: 'Commission',
  [TXN.TAX]: 'Tax',
  [TXN.DIVIDEND]: 'Dividend',
  [TXN.DIVIDEND_FRANKED]: 'Dividend Franked',
};

const shape = (op) => {
  const o = op.toJSON ? op.toJSON() : op;
  return { ...o, amount: Number(o.amount), typeLabel: OPERATION_TYPES[o.type] || `Type ${o.type}` };
};

const gatewayMessage = (err) => {
  const data = err.response?.data;
  if (typeof data === 'string') return data.slice(0, 300);
  if (data) return (data.message || data.error || JSON.stringify(data)).slice(0, 300);
  return err.message;
};

/** GET /balance-operations/types */
const getTypes = (req, res) => {
  res.json({ success: true, data: Object.entries(OPERATION_TYPES).map(([id, label]) => ({ id: Number(id), label })) });
};

/** POST /balance-operations  { accountId, type, amount (signed), comment?, note? } */
const createBalanceOperation = async (req, res) => {
  const type = Number(req.body.type);
  const amount = Math.round(Number(req.body.amount) * 100) / 100;
  const accountId = String(req.body.accountId || '').trim();
  const note = String(req.body.note || '').trim() || null;

  if (!OPERATION_TYPES[type]) {
    return res.status(400).json({ success: false, message: 'Invalid operation type. Use the Deposits/Withdrawals pages for those.' });
  }
  if (!accountId) return res.status(400).json({ success: false, message: 'MT5 account is required.' });
  if (!Number.isFinite(amount) || amount === 0) {
    return res.status(400).json({ success: false, message: 'Amount must be a non-zero number.' });
  }

  const comment = String(req.body.comment || '').trim().slice(0, 31) || OPERATION_TYPES[type];

  try {
    const account = await Mt5Account.findOne({ where: { accountid: accountId } });
    if (!account || accountId.startsWith('PENDING-')) {
      return res.status(404).json({ success: false, message: 'MT5 account not found.' });
    }
    if (account.status && String(account.status).toUpperCase() !== 'LIVE') {
      return res.status(400).json({ success: false, message: 'MT5 account is not active.' });
    }

    const base = {
      accountId, userId: account.userId || null, type, amount, comment, note, createdBy: req.user.id,
    };

    let dealId = null;
    try {
      ({ dealId } = await mt5BalanceOperation(accountId, amount, comment, type));
    } catch (err) {
      const message = gatewayMessage(err);
      console.error(`[BalanceOp] ${OPERATION_TYPES[type]} ${amount} on ${accountId} failed:`, message);
      const failed = await BalanceOperation.create({ ...base, status: 'failed', errorMessage: message });
      return res.status(502).json({ success: false, message: `MT5 rejected the operation: ${message}`, data: shape(failed) });
    }

    // Credit moves the credit line, everything else the balance. The live feed
    // persists the real balance anyway; this keeps the DB copy close meanwhile.
    if (type !== TXN.CREDIT) {
      await account.update({ balance: Math.round(((parseFloat(account.balance) || 0) + amount) * 100) / 100 });
    }

    const op = await BalanceOperation.create({ ...base, dealId, status: 'completed' });
    console.log(`[BalanceOp] ${OPERATION_TYPES[type]} ${amount} on ${accountId} by admin ${req.user.id} (deal ${dealId})`);
    emitFinanceUpdate('balance_operation', { ...op.toJSON(), createdFor: op.userId });

    return res.status(201).json({ success: true, message: `${OPERATION_TYPES[type]} applied.`, data: shape(op) });
  } catch (err) {
    console.error('createBalanceOperation error:', err);
    return res.status(500).json({ success: false, message: 'Internal Server Error' });
  }
};

/** GET /balance-operations?type=&status=&from=&to=&accountId=&userId= */
const getBalanceOperations = async (req, res) => {
  try {
    const { type, status, from, to, accountId, userId } = req.query;
    const where = {};
    if (type && type !== 'ALL') where.type = Number(type);
    if (status && status !== 'ALL') where.status = String(status).toLowerCase();
    if (accountId) where.accountId = String(accountId);
    if (userId) where.userId = Number(userId);
    if (from || to) {
      const range = {};
      if (from) { const d = new Date(from); if (!isNaN(d)) { d.setHours(0, 0, 0, 0); range[Op.gte] = d; } }
      if (to) { const d = new Date(to); if (!isNaN(d)) { d.setHours(23, 59, 59, 999); range[Op.lte] = d; } }
      if (Object.getOwnPropertySymbols(range).length) where.createdAt = range;
    }

    const rows = await BalanceOperation.findAll({
      where,
      include: [
        { model: User, as: 'client', attributes: ['id', 'name', 'email'] },
        { model: User, as: 'creator', attributes: ['id', 'name', 'email'] },
      ],
      order: [['createdAt', 'DESC']],
      limit: 5000,
    });

    res.json({ success: true, data: rows.map(shape) });
  } catch (err) {
    console.error('getBalanceOperations error:', err);
    res.status(500).json({ success: false, message: 'Internal Server Error' });
  }
};

/**
 * GET /balance-operations/my
 * The signed-in client's own completed operations. Internal note, failed
 * attempts and the admin who posted it are not exposed.
 */
const getMyBalanceOperations = async (req, res) => {
  try {
    const rows = await BalanceOperation.findAll({
      where: { userId: req.user.id, status: 'completed' },
      attributes: ['id', 'accountId', 'type', 'amount', 'comment', 'dealId', 'status', 'createdAt'],
      order: [['createdAt', 'DESC']],
      limit: 1000,
    });
    res.json({ success: true, data: rows.map(shape) });
  } catch (err) {
    console.error('getMyBalanceOperations error:', err);
    res.status(500).json({ success: false, message: 'Internal Server Error' });
  }
};

module.exports = { getTypes, createBalanceOperation, getBalanceOperations, getMyBalanceOperations, OPERATION_TYPES };
