const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const RolePermission = sequelize.define('RolePermission', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true
  },
  roleId: {
    type: DataTypes.UUID,
    allowNull: false
  },
  moduleId: {
    type: DataTypes.UUID,
    allowNull: false
  },
  action: {
    type: DataTypes.ENUM('view', 'create', 'edit', 'approve', 'delete', 'export', 'assign'),
    allowNull: false,
    validate: {
      isIn: [['view', 'create', 'edit', 'approve', 'delete', 'export', 'assign']]
    }
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
  tableName: 'role_permissions',
  timestamps: true,
  indexes: [
    {
      unique: true,
      fields: ['roleId', 'moduleId', 'action']
    }
  ]
});

module.exports = RolePermission;
