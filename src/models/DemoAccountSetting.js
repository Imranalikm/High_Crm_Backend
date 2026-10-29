const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

// Single-row (id=1) configuration for public demo account creation
const DemoAccountSetting = sequelize.define('DemoAccountSetting', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    defaultValue: 1
  },
  enabled: {
    type: DataTypes.BOOLEAN,
    defaultValue: true
  },
  mt5GroupName: {
    type: DataTypes.STRING,
    allowNull: false,
    defaultValue: process.env.DEMO_MT5_GROUP || 'STL\\3492\\demo.grp1'
  },
  initialBalance: {
    type: DataTypes.DECIMAL(15, 2),
    defaultValue: 0
  },
  leverage: {
    type: DataTypes.STRING,
    defaultValue: '1:100'
  },
  cooldownHours: {
    type: DataTypes.INTEGER,
    defaultValue: 24 // one demo account per email per N hours; 0 = unlimited
  },
  updatedBy: {
    type: DataTypes.INTEGER,
    allowNull: true
  }
}, {
  tableName: 'demo_account_settings',
  timestamps: true
});

module.exports = DemoAccountSetting;
