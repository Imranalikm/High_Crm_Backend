const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const Mt5Group = sequelize.define('Mt5Group', {
  id: {
    type: DataTypes.INTEGER,
    autoIncrement: true,
    primaryKey: true,
  },
  groupName: {
    type: DataTypes.STRING,
    allowNull: false,
    unique: true,
  }
}, {
  tableName: 'mt5_groups',
  timestamps: true
});

module.exports = Mt5Group;
