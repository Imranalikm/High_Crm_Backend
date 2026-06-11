const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const Kyc = sequelize.define('Kyc', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true
  },
  userId: {
    type: DataTypes.INTEGER,
    allowNull: false,
    unique: true
  },
  status: {
    type: DataTypes.ENUM('draft', 'pending', 'approved', 'rejected'),
    allowNull: false,
    defaultValue: 'draft'
  },

  // Step 1 — Personal Info
  fullName: {
    type: DataTypes.STRING,
    allowNull: true
  },
  dateOfBirth: {
    type: DataTypes.DATEONLY,
    allowNull: true
  },
  country: {
    type: DataTypes.STRING,
    allowNull: true
  },
  email: {
    type: DataTypes.STRING,
    allowNull: true
  },
  phoneCode: {
    type: DataTypes.STRING,
    allowNull: true
  },
  phone: {
    type: DataTypes.STRING,
    allowNull: true
  },
  streetAddress: {
    type: DataTypes.STRING,
    allowNull: true
  },
  city: {
    type: DataTypes.STRING,
    allowNull: true
  },
  postalCode: {
    type: DataTypes.STRING,
    allowNull: true
  },

  // Step 2 — Identity Document
  idDocType: {
    type: DataTypes.ENUM('passport', 'national_id', 'driving_license'),
    allowNull: true
  },
  idFrontImage: {
    type: DataTypes.STRING,
    allowNull: true
  },
  idBackImage: {
    type: DataTypes.STRING,
    allowNull: true
  },
  idDocNumber: {
    type: DataTypes.STRING,
    allowNull: true
  },
  idExpiryDate: {
    type: DataTypes.DATEONLY,
    allowNull: true
  },
  idCountryOfIssue: {
    type: DataTypes.STRING,
    allowNull: true
  },

  // Step 3 — Face Verification
  selfieImage: {
    type: DataTypes.STRING,
    allowNull: true
  },

  // Step 4 — Address Proof
  addressDocType: {
    type: DataTypes.ENUM('utility_bill', 'bank_statement', 'rent_agreement'),
    allowNull: true
  },
  addressDocImage: {
    type: DataTypes.STRING,
    allowNull: true
  },
  addressDocIssueDate: {
    type: DataTypes.DATEONLY,
    allowNull: true
  },

  // Admin Review
  rejectionReason: {
    type: DataTypes.TEXT,
    allowNull: true
  },
  reviewedBy: {
    type: DataTypes.INTEGER,
    allowNull: true
  },
  reviewedAt: {
    type: DataTypes.DATE,
    allowNull: true
  },

  // Audit
  createdBy: {
    type: DataTypes.INTEGER,
    allowNull: true
  },
  updatedBy: {
    type: DataTypes.INTEGER,
    allowNull: true
  }
}, {
  tableName: 'kyc',
  timestamps: true
});

module.exports = Kyc;
