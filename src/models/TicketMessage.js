const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const TicketMessage = sequelize.define('TicketMessage', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true,
  },
  ticketId: {
    type: DataTypes.UUID,
    allowNull: false,
    references: {
      model: 'tickets',
      key: 'id'
    },
    onDelete: 'CASCADE'
  },
  authorId: {
    type: DataTypes.INTEGER,
    allowNull: true,
    references: {
      model: 'users',
      key: 'id'
    }
  },
  body: {
    type: DataTypes.TEXT,
    allowNull: false,
  },
  type: {
    type: DataTypes.ENUM('user', 'agent', 'internal', 'system'),
    allowNull: false,
    defaultValue: 'user'
  },
  attachments: {
    type: DataTypes.JSONB,
    allowNull: true,
    defaultValue: [],
    comment: 'Array of {name, url, size, type}'
  }
}, {
  tableName: 'ticket_messages',
  timestamps: true,
});

module.exports = TicketMessage;
