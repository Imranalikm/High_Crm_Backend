const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const CrmGroup = sequelize.define('CrmGroup', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  name: {
    type: DataTypes.STRING,
    allowNull: false,
    unique: true
  },
  mt5GroupName: {
    type: DataTypes.STRING,
    allowNull: false
  },
  groupStatus: {
    type: DataTypes.STRING,
    defaultValue: 'Active'
  },
  groupType: {
    type: DataTypes.STRING,
    defaultValue: 'Live'
  },
  currencyUnit: {
    type: DataTypes.STRING,
    defaultValue: 'Dollar'
  },
  minFirstDeposit: {
    type: DataTypes.DECIMAL(10, 2),
    defaultValue: 0
  },
  minDeposit: {
    type: DataTypes.DECIMAL(10, 2),
    defaultValue: 0
  },
  minWithdrawal: {
    type: DataTypes.DECIMAL(10, 2),
    defaultValue: 0
  },
  perProfileMaxAccount: {
    type: DataTypes.INTEGER,
    defaultValue: 5
  },
  firstDeposit: {
    type: DataTypes.DECIMAL(10, 2),
    defaultValue: 0
  },
  maxWithdrawalPerDay: {
    type: DataTypes.DECIMAL(15, 2),
    defaultValue: 5000
  },
  spreadStartFrom: {
    type: DataTypes.STRING,
    defaultValue: '1.0'
  },
  accountOpenPolicy: {
    type: DataTypes.STRING,
    defaultValue: 'Auto Approve'
  },
  depositPolicy: {
    type: DataTypes.STRING,
    defaultValue: 'Auto Approve'
  },
  withdrawalPolicy: {
    type: DataTypes.STRING,
    defaultValue: 'Auto Approve'
  },
  tradingType: {
    type: DataTypes.STRING,
    defaultValue: 'Standard Trading'
  },
  maxLeverage: {
    type: DataTypes.STRING,
    defaultValue: '1'
  },
  isDeleted: {
    type: DataTypes.BOOLEAN,
    defaultValue: false
  },
  createdBy: {
    type: DataTypes.INTEGER,
    allowNull: true
  },
  updatedBy: {
    type: DataTypes.INTEGER,
    allowNull: true
  }
}, {
  tableName: 'crm_groups',
  timestamps: true,
});

module.exports = CrmGroup;
