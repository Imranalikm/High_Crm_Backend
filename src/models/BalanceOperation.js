const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

/**
 * Admin balance operations other than deposits/withdrawals
 * (Credit, Charge, Correction, Bonus, Commission, Tax, Dividend, DividendFranked).
 * `type` is the gateway TxnType number (2-9). `amount` is signed: negative
 * removes (e.g. credit out, bonus removal).
 */
const BalanceOperation = sequelize.define('BalanceOperation', {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  accountId: { type: DataTypes.STRING, allowNull: false },
  userId: { type: DataTypes.INTEGER, allowNull: true },          // client who owns the account
  type: { type: DataTypes.INTEGER, allowNull: false },
  amount: { type: DataTypes.DECIMAL(15, 2), allowNull: false },
  comment: { type: DataTypes.STRING(64), allowNull: true },      // sent to MT5 (deal comment)
  note: { type: DataTypes.TEXT, allowNull: true },                // internal note, CRM only
  dealId: { type: DataTypes.STRING, allowNull: true },
  status: { type: DataTypes.ENUM('completed', 'failed'), allowNull: false, defaultValue: 'completed' },
  errorMessage: { type: DataTypes.TEXT, allowNull: true },
  createdBy: { type: DataTypes.INTEGER, allowNull: true },
}, {
  tableName: 'balance_operations',
  timestamps: true,
});

module.exports = BalanceOperation;
