const express = require('express');
const router = express.Router();
const authRoutes = require('./auth.routes');
const roleRoutes = require('./role.routes');
const userRoutes = require('./user.routes');
const userPanelRoutes = require('./user.panel.routes');
const kycRoutes = require('./kyc.routes');
const userManagementRoutes = require('./user.management.routes');
const groupRoutes = require('./group.routes');
const crmGroupRoutes = require('./crmGroup.routes');
const mt5AccountRoutes = require('./mt5Account.routes');
const ticketRoutes = require('./ticket.routes');
const depositRoutes = require('./deposit.routes');
const withdrawalRoutes = require('./withdrawal.routes');
const notificationRoutes = require('./notification.routes');
const bankAccountRoutes = require('./bankAccount.routes');

router.use('/auth', authRoutes);
router.use('/roles', roleRoutes);
router.use('/users', userRoutes);
router.use('/panel', userPanelRoutes);
router.use('/kyc', kycRoutes);
router.use('/user-management', userManagementRoutes);
router.use('/groups', groupRoutes);
router.use('/crm-groups', crmGroupRoutes);
router.use('/mt5-accounts', mt5AccountRoutes);
router.use('/tickets', ticketRoutes);
router.use('/deposits', depositRoutes);
router.use('/withdrawals', withdrawalRoutes);
router.use('/notifications', notificationRoutes);
router.use('/bank-accounts', bankAccountRoutes);

// Root API healthcheck endpoint

router.get('/health', (req, res) => {
  res.status(200).json({
    success: true,
    message: 'HighCRM Backend API is healthy and running.',
    timestamp: new Date()
  });
});

module.exports = router;
