const sequelize = require('../config/database');
const User = require('./User');
const Role = require('./Role');
const Module = require('./Module');
const RolePermission = require('./RolePermission');
const Kyc = require('./Kyc');
const Mt5Group = require('./Mt5Group');
const CrmGroup = require('./CrmGroup');
const Mt5Account = require('./Mt5Account');
const Ticket = require('./Ticket');
const TicketMessage = require('./TicketMessage');
const Deposit = require('./Deposit');
const Withdrawal = require('./Withdrawal');

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

Withdrawal.belongsTo(User, { as: 'creator', foreignKey: 'createdBy' });
Withdrawal.belongsTo(User, { as: 'recipient', foreignKey: 'createdFor' });
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

// User <-> Mt5Account association
User.hasMany(Mt5Account, { foreignKey: 'userId', as: 'mt5Accounts' });
Mt5Account.belongsTo(User, { foreignKey: 'userId', as: 'user' });

// User <-> Ticket association
User.hasMany(Ticket, { foreignKey: 'userId', as: 'tickets' });
Ticket.belongsTo(User, { foreignKey: 'userId', as: 'user' });

// Ticket <-> Assigned Agent
Ticket.belongsTo(User, { foreignKey: 'agentId', as: 'agent' });
User.hasMany(Ticket, { foreignKey: 'agentId', as: 'assignedTickets' });

// Ticket <-> TicketMessage
Ticket.hasMany(TicketMessage, { foreignKey: 'ticketId', as: 'messages', onDelete: 'CASCADE' });
TicketMessage.belongsTo(Ticket, { foreignKey: 'ticketId', as: 'ticket' });

// User <-> TicketMessage
TicketMessage.belongsTo(User, { foreignKey: 'authorId', as: 'author' });
User.hasMany(TicketMessage, { foreignKey: 'authorId', as: 'ticketMessages' });

// Deposit associations
User.hasMany(Deposit, { foreignKey: 'createdBy', as: 'createdDeposits' });
Deposit.belongsTo(User, { foreignKey: 'createdBy', as: 'creator' });

User.hasMany(Deposit, { foreignKey: 'createdFor', as: 'receivedDeposits' });
Deposit.belongsTo(User, { foreignKey: 'createdFor', as: 'recipient' });

// Mt5Account <-> Deposit
// The provided snippet queries Mt5Account by string `accountid` instead of PK.
// But we can link them conceptually.
Deposit.belongsTo(Mt5Account, { foreignKey: 'accountId', targetKey: 'accountid', as: 'mt5Account' });
Mt5Account.hasMany(Deposit, { sourceKey: 'accountid', foreignKey: 'accountId', as: 'deposits' });

module.exports = {
  sequelize,
  User,
  Role,
  Module,
  RolePermission,
  Kyc,
  Mt5Group,
  CrmGroup,
  Mt5Account,
  Ticket,
  TicketMessage,
  Deposit,
  Withdrawal
};
