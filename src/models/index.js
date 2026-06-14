const sequelize = require('../config/database');
const User = require('./User');
const Role = require('./Role');
const Module = require('./Module');
const RolePermission = require('./RolePermission');
const Kyc = require('./Kyc');
const Mt5Group = require('./Mt5Group');
const CrmGroup = require('./CrmGroup');

// User <-> Role association
User.belongsTo(Role, { foreignKey: 'roleId', as: 'role' });
Role.hasMany(User, { foreignKey: 'roleId', as: 'users' });

// RolePermission relationships
RolePermission.belongsTo(Role, { foreignKey: 'roleId', as: 'role' });
Role.hasMany(RolePermission, { foreignKey: 'roleId', as: 'permissions', onDelete: 'CASCADE' });

RolePermission.belongsTo(Module, { foreignKey: 'moduleId', as: 'module' });
Module.hasMany(RolePermission, { foreignKey: 'moduleId', as: 'permissions', onDelete: 'CASCADE' });

// Auditing associations (createdBy and updatedBy)
// All tables track which User created/updated the records
User.belongsTo(User, { as: 'creator', foreignKey: 'createdBy' });
User.belongsTo(User, { as: 'updater', foreignKey: 'updatedBy' });

Role.belongsTo(User, { as: 'creator', foreignKey: 'createdBy' });
Role.belongsTo(User, { as: 'updater', foreignKey: 'updatedBy' });

Module.belongsTo(User, { as: 'creator', foreignKey: 'createdBy' });
Module.belongsTo(User, { as: 'updater', foreignKey: 'updatedBy' });

RolePermission.belongsTo(User, { as: 'creator', foreignKey: 'createdBy' });
RolePermission.belongsTo(User, { as: 'updater', foreignKey: 'updatedBy' });

// User <-> Kyc association (one-to-one)
User.hasOne(Kyc, { foreignKey: 'userId', as: 'kyc' });
Kyc.belongsTo(User, { foreignKey: 'userId', as: 'user' });

Kyc.belongsTo(User, { as: 'creator', foreignKey: 'createdBy' });
Kyc.belongsTo(User, { as: 'updater', foreignKey: 'updatedBy' });
Kyc.belongsTo(User, { as: 'reviewer', foreignKey: 'reviewedBy' });

// User <-> CrmGroup association (Audit)
CrmGroup.belongsTo(User, { as: 'creator', foreignKey: 'createdBy' });
CrmGroup.belongsTo(User, { as: 'updater', foreignKey: 'updatedBy' });

module.exports = {
  sequelize,
  User,
  Role,
  Module,
  RolePermission,
  Kyc,
  Mt5Group,
  CrmGroup
};
