const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const AppNotification = sequelize.define('AppNotification', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  userId: {
    type: DataTypes.INTEGER,
    allowNull: true,
    comment: 'The user this notification is intended for (e.g. an admin). Null means global broadcast.'
  },
  title: {
    type: DataTypes.STRING,
    allowNull: false
  },
  message: {
    type: DataTypes.TEXT,
    allowNull: false
  },
  type: {
    type: DataTypes.STRING,
    allowNull: false,
    defaultValue: 'system',
    comment: 'e.g. registration, deposit, ticket, system'
  },
  isRead: {
    type: DataTypes.BOOLEAN,
    allowNull: false,
    defaultValue: false
  },
  readAt: {
    type: DataTypes.DATE,
    allowNull: true
  }
}, {
  tableName: 'app_notifications',
  timestamps: true
});

module.exports = AppNotification;
