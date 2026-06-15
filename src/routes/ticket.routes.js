const express = require('express');
const router = express.Router();
const authenticateToken = require('../middlewares/auth.middleware');
const { createTicket, getTickets, getTicketById, addMessage, updateTicket } = require('../controllers/ticket.controller');

router.post('/', authenticateToken, createTicket);
router.get('/', authenticateToken, getTickets);
router.get('/:id', authenticateToken, getTicketById);
router.post('/:id/messages', authenticateToken, addMessage);
router.patch('/:id', authenticateToken, updateTicket);

module.exports = router;
