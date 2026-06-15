const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const Deposit = sequelize.define('Deposit', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  accountId: {
    type: DataTypes.STRING,
    allowNull: false
  },
  amount: {
    type: DataTypes.DECIMAL(15, 2),
    allowNull: false
  },
  type: {
    type: DataTypes.STRING,
    allowNull: true
  },
  transactionId: {
    type: DataTypes.STRING,
    allowNull: true
  },
  note: {
    type: DataTypes.TEXT,
    allowNull: true
  },
  comment: {
    type: DataTypes.TEXT,
    allowNull: true
  },
  depositProof: {
    type: DataTypes.STRING,
    allowNull: true
  },
  status: {
    type: DataTypes.ENUM('pending', 'approved', 'rejected', 'failed', 'flagged'),
    defaultValue: 'pending'
  },
  role: {
    type: DataTypes.STRING,
    defaultValue: 'user'
  },
  createdBy: {
    type: DataTypes.INTEGER,
    allowNull: true
  },
  createdFor: {
    type: DataTypes.INTEGER,
    allowNull: true
  }
}, {
  tableName: 'deposits',
  timestamps: true,
});

module.exports = Deposit;
