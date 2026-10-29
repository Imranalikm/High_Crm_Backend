const express = require('express');
const router = express.Router();
const { getDemoSettings, updateDemoSettings } = require('../controllers/demoSetting.controller');
const authenticateToken = require('../middlewares/auth.middleware');
const requirePermission = require('../middlewares/rbac.middleware');

// Demo account settings are admin-only
router.use(authenticateToken);

router.get('/', requirePermission('platform_settings', 'view'), getDemoSettings);
router.put('/', requirePermission('platform_settings', 'edit'), updateDemoSettings);

module.exports = router;
