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
    allowNull: true // null for public demo accounts (no CRM user)
  },
  accountType: {
    type: DataTypes.STRING,
    defaultValue: 'LIVE' // 'LIVE' | 'DEMO'
  },
  // Contact details for demo accounts created without a CRM user
  contactName: {
    type: DataTypes.STRING,
    allowNull: true
  },
  contactEmail: {
    type: DataTypes.STRING,
    allowNull: true
  },
  contactPhone: {
    type: DataTypes.STRING,
    allowNull: true
  },
  contactCountry: {
    type: DataTypes.STRING,
    allowNull: true
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
