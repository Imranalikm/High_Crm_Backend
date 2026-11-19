const express = require('express');
const router = express.Router();
const authenticateToken = require('../middlewares/auth.middleware');
const requirePermission = require('../middlewares/rbac.middleware');
const {
  getTypes, createBalanceOperation, getBalanceOperations, getMyBalanceOperations,
} = require('../controllers/balanceOperation.controller');

router.use(authenticateToken);

// Client: own completed operations
router.get('/my', getMyBalanceOperations);

router.get('/types', requirePermission('finance', 'view'), getTypes);
router.get('/', requirePermission('finance', 'view'), getBalanceOperations);
router.post('/', requirePermission('finance', 'create'), createBalanceOperation);

module.exports = router;
