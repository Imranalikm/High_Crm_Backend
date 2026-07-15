const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const BankAccount = sequelize.define('BankAccount', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  userId: {
    type: DataTypes.INTEGER,
    allowNull: false
  },
  type: {
    type: DataTypes.ENUM('bank', 'card', 'crypto', 'upi'),
    allowNull: false,
    defaultValue: 'bank'
  },
  name: {
    type: DataTypes.STRING,
    allowNull: false,
    comment: 'Display name, e.g. HDFC Bank, Visa Debit, USDT Wallet'
  },
  isDefault: {
    type: DataTypes.BOOLEAN,
    allowNull: false,
    defaultValue: false
  },
  details: {
    type: DataTypes.JSON,
    allowNull: true,
    comment: 'Type-specific fields: accountNumber, IFSC, cardNumber, walletAddress, etc.'
  },
  editStatus: {
    type: DataTypes.STRING,
    allowNull: false,
    defaultValue: 'none'
  }
}, {
  tableName: 'bank_accounts',
  timestamps: true,
});

module.exports = BankAccount;
