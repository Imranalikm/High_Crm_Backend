const express = require('express');
const router = express.Router();
const authenticateToken = require('../middlewares/auth.middleware');
const { createTicket, getTickets, getTicketById, addMessage, updateTicket } = require('../controllers/ticket.controller');
const { ticketUpload } = require('../config/upload');

router.post('/', authenticateToken, ticketUpload.array('attachments', 5), createTicket);
router.get('/', authenticateToken, getTickets);
router.get('/:id', authenticateToken, getTicketById);
router.post('/:id/messages', authenticateToken, ticketUpload.array('attachments', 5), addMessage);
router.patch('/:id', authenticateToken, updateTicket);

module.exports = router;
