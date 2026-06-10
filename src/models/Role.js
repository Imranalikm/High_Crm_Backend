const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const Role = sequelize.define('Role', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true
  },
  name: {
    type: DataTypes.STRING,
    allowNull: false,
    unique: true,
    validate: {
      notEmpty: true
    }
  },
  key: {
    type: DataTypes.STRING,
    allowNull: false,
    unique: true,
    validate: {
      notEmpty: true
    }
  },
  description: {
    type: DataTypes.STRING,
    allowNull: true
  },
  scope: {
    type: DataTypes.STRING,
    allowNull: false,
    defaultValue: 'ALL_MODULES'
  },
  type: {
    type: DataTypes.ENUM('admin', 'user'),
    allowNull: false,
    defaultValue: 'admin'
  },
  status: {
    type: DataTypes.ENUM('ACTIVE', 'DRAFT', 'INACTIVE'),
    allowNull: false,
    defaultValue: 'ACTIVE'
  },
  createdBy: {
    type: DataTypes.INTEGER,
    allowNull: true
    // Reference is defined in models index.js to prevent circular import issues
  },
  updatedBy: {
    type: DataTypes.INTEGER,
    allowNull: true
  }
}, {
  tableName: 'roles',
  timestamps: true
});

module.exports = Role;
