const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const NotificationSetting = sequelize.define('NotificationSetting', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    defaultValue: 1
  },
  emailEnabled: {
    type: DataTypes.BOOLEAN,
    defaultValue: true
  },
  smsEnabled: {
    type: DataTypes.BOOLEAN,
    defaultValue: true
  },
  inAppEnabled: {
    type: DataTypes.BOOLEAN,
    defaultValue: true
  },
  webhookEnabled: {
    type: DataTypes.BOOLEAN,
    defaultValue: true
  },
  pushEnabled: {
    type: DataTypes.BOOLEAN,
    defaultValue: false
  },
  emailProvider: {
    type: DataTypes.STRING,
    defaultValue: 'SENDGRID'
  },
  smsProvider: {
    type: DataTypes.STRING,
    defaultValue: 'TWILIO'
  },
  smtpHost: {
    type: DataTypes.STRING,
    defaultValue: 'smtp.sendgrid.net'
  },
  smtpPort: {
    type: DataTypes.STRING,
    defaultValue: '587'
  },
  fromEmail: {
    type: DataTypes.STRING,
    defaultValue: 'noreply@smatams.com'
  },
  fromName: {
    type: DataTypes.STRING,
    defaultValue: 'Smatams'
  },
  sendgridKey: {
    type: DataTypes.STRING,
    defaultValue: 'SG.●●●●●●●●●●●●●'
  },
  twilioSid: {
    type: DataTypes.STRING,
    defaultValue: 'AC●●●●●●●●'
  },
  twilioFrom: {
    type: DataTypes.STRING,
    defaultValue: '+1555000000'
  },
  events: {
    type: DataTypes.JSON,
    defaultValue: {
      deposit_received: { email: true, sms: false, inApp: true },
      withdrawal_approved: { email: true, sms: true, inApp: true },
      withdrawal_rejected: { email: true, sms: false, inApp: true },
      kyc_approved: { email: true, sms: false, inApp: true },
      kyc_rejected: { email: true, sms: false, inApp: true },
      margin_call: { email: true, sms: true, inApp: true },
      stop_out: { email: true, sms: true, inApp: true },
      password_reset: { email: true, sms: false, inApp: false },
      login_alert: { email: true, sms: false, inApp: true },
      prop_challenge_fail: { email: true, sms: false, inApp: true },
    }
  }
}, {
  tableName: 'notification_settings',
  timestamps: true
});

module.exports = NotificationSetting;
