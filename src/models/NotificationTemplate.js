const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const NotificationTemplate = sequelize.define('NotificationTemplate', {
  id: {
    type: DataTypes.INTEGER,
    autoIncrement: true,
    primaryKey: true
  },
  name: {
    type: DataTypes.STRING,
    allowNull: false
  },
  event: {
    type: DataTypes.STRING,
    allowNull: false,
    unique: true
  },
  subject: {
    type: DataTypes.STRING,
    allowNull: false
  },
  body: {
    type: DataTypes.TEXT,
    allowNull: false
  },
  status: {
    type: DataTypes.ENUM('ACTIVE', 'DRAFT'),
    defaultValue: 'ACTIVE'
  },
  type: {
    type: DataTypes.ENUM('email', 'sms', 'in_app'),
    defaultValue: 'email'
  }
}, {
  tableName: 'notification_templates',
  timestamps: true
});

module.exports = NotificationTemplate;
