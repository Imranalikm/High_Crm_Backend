const express = require('express');
const router = express.Router();
const bankAccountController = require('../controllers/bankAccount.controller');
const authenticateToken = require('../middlewares/auth.middleware');

// User endpoints
router.get('/', authenticateToken, bankAccountController.getMyBankAccounts);
router.post('/', authenticateToken, bankAccountController.createBankAccount);
router.put('/:id', authenticateToken, bankAccountController.updateBankAccount);
router.delete('/:id', authenticateToken, bankAccountController.deleteBankAccount);
router.patch('/:id/default', authenticateToken, bankAccountController.setDefaultBankAccount);

// Admin endpoint — view a user's bank accounts
router.get('/user/:userId', authenticateToken, bankAccountController.getBankAccountsByUserId);

module.exports = router;
