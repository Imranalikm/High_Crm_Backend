const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const Ticket = sequelize.define('Ticket', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true,
  },
  ticketId: {
    type: DataTypes.STRING,
    allowNull: false,
    unique: true,
  },
  userId: {
    type: DataTypes.INTEGER,
    allowNull: false,
    references: {
      model: 'users',
      key: 'id'
    }
  },
  agentId: {
    type: DataTypes.INTEGER,
    allowNull: true,
    references: {
      model: 'users',
      key: 'id'
    }
  },
  subject: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  category: {
    type: DataTypes.STRING,
    allowNull: false,
    defaultValue: 'General',
  },
  priority: {
    type: DataTypes.ENUM('LOW', 'MED', 'HIGH', 'CRITICAL'),
    allowNull: false,
    defaultValue: 'MED',
  },
  status: {
    type: DataTypes.ENUM('OPEN', 'PENDING', 'ESCALATED', 'RESOLVED', 'CLOSED'),
    allowNull: false,
    defaultValue: 'OPEN',
  },
  description: {
    type: DataTypes.TEXT,
    allowNull: false,
  },
  attachments: {
    type: DataTypes.JSONB,
    allowNull: true,
    defaultValue: [],
    comment: 'Array of {name, url, size, type}'
  },
}, {
  tableName: 'tickets',
  timestamps: true,
});

module.exports = Ticket;
