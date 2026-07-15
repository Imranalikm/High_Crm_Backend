const { BankAccount, User } = require('../models');

/**
 * Get all bank accounts for the authenticated user
 */
const getMyBankAccounts = async (req, res) => {
  try {
    const userId = req.user.id;
    const accounts = await BankAccount.findAll({
      where: { userId },
      order: [['isDefault', 'DESC'], ['createdAt', 'DESC']],
    });
    res.json({ bankAccounts: accounts });
  } catch (err) {
    console.error('getMyBankAccounts error:', err);
    res.status(500).json({ message: 'Internal Server Error' });
  }
};

/**
 * Admin: Get all bank accounts for a specific user
 */
const getBankAccountsByUserId = async (req, res) => {
  try {
    if (req.user?.role?.type !== 'admin') {
      return res.status(403).json({ message: 'Only admins can view other users\' bank accounts.' });
    }

    const { userId } = req.params;
    const accounts = await BankAccount.findAll({
      where: { userId },
      order: [['isDefault', 'DESC'], ['createdAt', 'DESC']],
    });
    res.json({ bankAccounts: accounts });
  } catch (err) {
    console.error('getBankAccountsByUserId error:', err);
    res.status(500).json({ message: 'Internal Server Error' });
  }
};

/**
 * Create a new bank account / payment method
 */
const createBankAccount = async (req, res) => {
  try {
    const userId = req.user.id;
    const { type, name, details, isDefault } = req.body;

    if (!type || !name) {
      return res.status(400).json({ message: 'Type and name are required.' });
    }

    if (!['bank', 'card', 'crypto', 'upi'].includes(type)) {
      return res.status(400).json({ message: 'Invalid type. Must be bank, card, crypto, or upi.' });
    }

    if (type === 'bank') {
      const accountName = details?.accountName?.trim()?.toLowerCase() || '';
      const userName = req.user.name?.trim()?.toLowerCase() || '';
      if (accountName !== userName) {
        return res.status(400).json({ message: 'The account holder name must match your registered profile name.' });
      }
    }

    // If marking as default, unmark all others first
    if (isDefault) {
      await BankAccount.update(
        { isDefault: false },
        { where: { userId } }
      );
    }

    // If this is the user's first account, make it default automatically
    const existingCount = await BankAccount.count({ where: { userId } });
    const shouldBeDefault = isDefault || existingCount === 0;

    const account = await BankAccount.create({
      userId,
      type,
      name,
      details: details || {},
      isDefault: shouldBeDefault,
    });

    res.status(201).json({ message: 'Payment method added.', bankAccount: account });
  } catch (err) {
    console.error('createBankAccount error:', err);
    res.status(500).json({ message: 'Internal Server Error' });
  }
};

/**
 * Update an existing bank account
 */
const updateBankAccount = async (req, res) => {
  try {
    const userId = req.user.id;
    const { id } = req.params;
    const { type, name, details } = req.body;

    const account = await BankAccount.findOne({ where: { id, userId } });
    if (!account) {
      return res.status(404).json({ message: 'Payment method not found.' });
    }

    if (type) account.type = type;
    if (name) account.name = name;
    
    if (details) {
      if ((type || account.type) === 'bank') {
        const accountName = details.accountName?.trim()?.toLowerCase() || '';
        const userName = req.user.name?.trim()?.toLowerCase() || '';
        if (accountName && accountName !== userName) {
          return res.status(400).json({ message: 'The account holder name must match your registered profile name.' });
        }
      }
      account.details = details;
    }

    await account.save();
    res.json({ message: 'Payment method updated.', bankAccount: account });
  } catch (err) {
    console.error('updateBankAccount error:', err);
    res.status(500).json({ message: 'Internal Server Error' });
  }
};

/**
 * Delete a bank account
 */
const deleteBankAccount = async (req, res) => {
  try {
    const userId = req.user.id;
    const { id } = req.params;

    const account = await BankAccount.findOne({ where: { id, userId } });
    if (!account) {
      return res.status(404).json({ message: 'Payment method not found.' });
    }

    const wasDefault = account.isDefault;
    await account.destroy();

    // If the deleted one was default, promote the next one
    if (wasDefault) {
      const next = await BankAccount.findOne({
        where: { userId },
        order: [['createdAt', 'ASC']],
      });
      if (next) {
        next.isDefault = true;
        await next.save();
      }
    }

    res.json({ message: 'Payment method removed.' });
  } catch (err) {
    console.error('deleteBankAccount error:', err);
    res.status(500).json({ message: 'Internal Server Error' });
  }
};

/**
 * Set a bank account as the default
 */
const setDefaultBankAccount = async (req, res) => {
  try {
    const userId = req.user.id;
    const { id } = req.params;

    const account = await BankAccount.findOne({ where: { id, userId } });
    if (!account) {
      return res.status(404).json({ message: 'Payment method not found.' });
    }

    // Unmark all others
    await BankAccount.update(
      { isDefault: false },
      { where: { userId } }
    );

    account.isDefault = true;
    await account.save();

    res.json({ message: 'Default payment method updated.', bankAccount: account });
  } catch (err) {
    console.error('setDefaultBankAccount error:', err);
    res.status(500).json({ message: 'Internal Server Error' });
  }
};

module.exports = {
  getMyBankAccounts,
  getBankAccountsByUserId,
  createBankAccount,
  updateBankAccount,
  deleteBankAccount,
  setDefaultBankAccount,
};
