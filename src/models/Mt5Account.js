const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const Mt5Account = sequelize.define('Mt5Account', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  userId: {
    type: DataTypes.INTEGER,
    allowNull: false
  },
  accountid: {
    type: DataTypes.STRING,
    allowNull: false,
    unique: true // Corresponds to MT5 'login' ID
  },
  groupName: {
    type: DataTypes.STRING,
    allowNull: false
  },
  leverage: {
    type: DataTypes.STRING,
    allowNull: false
  },
  balance: {
    type: DataTypes.DECIMAL(15, 2),
    defaultValue: 0
  },
  mPassword: {
    type: DataTypes.STRING,
    allowNull: false
  },
  iPassword: {
    type: DataTypes.STRING,
    allowNull: false
  },
  server: {
    type: DataTypes.STRING,
    defaultValue: 'MT5-LIVE-EU1'
  },
  status: {
    type: DataTypes.STRING,
    defaultValue: 'LIVE'
  },
  createdBy: {
    type: DataTypes.INTEGER,
    allowNull: true
  }
}, {
  tableName: 'mt5_accounts',
  timestamps: true,
});

module.exports = Mt5Account;
