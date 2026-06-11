const express = require('express');
const router = express.Router();
const { getDashboard, getProfile, updateProfile, getWallet } = require('../controllers/user.panel.controller');
const { getMyKyc, submitKyc } = require('../controllers/kyc.controller');
const kycUpload = require('../config/upload');

const authenticateToken = require('../middlewares/auth.middleware');
const requireUserPanel = require('../middlewares/panel.middleware');

// All user panel routes require authentication + user-type role
router.use(authenticateToken);
router.use(requireUserPanel);

// User Panel Routes
router.get('/dashboard', getDashboard);
router.get('/profile', getProfile);
router.put('/profile', updateProfile);
router.get('/wallet', getWallet);

// KYC Routes
router.get('/kyc', getMyKyc);
router.post('/kyc', kycUpload.fields([
  { name: 'idFrontImage', maxCount: 1 },
  { name: 'idBackImage', maxCount: 1 },
  { name: 'selfieImage', maxCount: 1 },
  { name: 'addressDocImage', maxCount: 1 }
]), submitKyc);

module.exports = router;
