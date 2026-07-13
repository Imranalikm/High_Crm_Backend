const express = require('express');
const router = express.Router();
const {
  getNotificationConfig,
  updateNotificationConfig,
  getTemplates,
  getTemplateById,
  createTemplate,
  updateTemplate,
  deleteTemplate,
  getUnreadNotifications,
  markAsRead,
  markAllAsRead
} = require('../controllers/notification.controller');

const authenticateToken = require('../middlewares/auth.middleware');
const requirePermission = require('../middlewares/rbac.middleware');

// All settings routes require admin authentication
router.use(authenticateToken);

// Configurations endpoints
router.get('/config', requirePermission('platform_settings', 'view'), getNotificationConfig);
router.put('/config', requirePermission('platform_settings', 'edit'), updateNotificationConfig);

// Templates endpoints
router.get('/templates', requirePermission('platform_settings', 'view'), getTemplates);
router.get('/templates/:id', requirePermission('platform_settings', 'view'), getTemplateById);
router.post('/templates', requirePermission('platform_settings', 'edit'), createTemplate);
router.put('/templates/:id', requirePermission('platform_settings', 'edit'), updateTemplate);
router.delete('/templates/:id', requirePermission('platform_settings', 'edit'), deleteTemplate);

// App Notification endpoints
router.get('/unread', getUnreadNotifications);
router.put('/mark-all-read', markAllAsRead);
router.put('/:id/read', markAsRead);

module.exports = router;
