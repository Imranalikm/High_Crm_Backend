const express = require('express');
const router = express.Router();
const authenticateToken = require('../middlewares/auth.middleware');
const { createTicket, getTickets, getTicketById } = require('../controllers/ticket.controller');

router.post('/', authenticateToken, createTicket);
router.get('/', authenticateToken, getTickets);
router.get('/:id', authenticateToken, getTicketById);

module.exports = router;
