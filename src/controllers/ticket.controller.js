const { Ticket, TicketMessage, User } = require('../models');
const { getIo } = require('../config/socket');

// Generate random ticket ID e.g., TICK-1234
function generateTicketId() {
  const num = Math.floor(1000 + Math.random() * 9000);
  return `TICK-${num}`;
}

const createTicket = async (req, res) => {
  try {
    console.log('[createTicket] req.body:', req.body);
    console.log('[createTicket] req.files:', req.files);
    const { subject, category, priority, description } = req.body;
    
    if (!subject || !category || !description) {
      return res.status(400).json({ success: false, message: 'Missing required fields: subject, category, or description' });
    }

    const attachments = (req.files || []).map(file => ({
      name: file.originalname,
      url: `/uploads/tickets/${file.filename}`,
      size: file.size,
      mimetype: file.mimetype
    }));

    const ticket = await Ticket.create({
      ticketId: generateTicketId(),
      userId: req.user.id,
      subject,
      category,
      priority: priority || 'MED',
      status: 'OPEN',
      description,
      attachments: attachments.length > 0 ? attachments : []
    });

    try {
      getIo().emit('new_ticket', ticket);
    } catch (e) {
      console.error('[Socket.io] Error emitting new_ticket:', e.message);
    }

    return res.status(201).json({ success: true, message: 'Ticket created', data: ticket });
  } catch (err) {
    console.error('Error creating ticket:', err);
    return res.status(500).json({ success: false, message: 'Internal Server Error' });
  }
};

const getTickets = async (req, res) => {
  try {
    const isAdmin = req.user?.role?.type === 'admin';
    const whereClause = isAdmin ? {} : { userId: req.user.id };

    const tickets = await Ticket.findAll({
      where: whereClause,
      include: [
        { model: User, as: 'user', attributes: ['id', 'name', 'email', 'phone'] },
        { model: User, as: 'agent', attributes: ['id', 'name', 'email'] }
      ],
      order: [['createdAt', 'DESC']]
    });

    return res.status(200).json({ success: true, data: tickets });
  } catch (err) {
    console.error('Error fetching tickets:', err);
    return res.status(500).json({ success: false, message: 'Internal Server Error' });
  }
};

const getTicketById = async (req, res) => {
  try {
    const isAdmin = req.user?.role?.type === 'admin';
    const ticketIdParam = req.params.id; // either UUID or ticketId string

    const ticket = await Ticket.findOne({
      where: {
        id: ticketIdParam
      },
      include: [
        { model: User, as: 'user', attributes: ['id', 'name', 'email', 'phone'] },
        { model: User, as: 'agent', attributes: ['id', 'name', 'email'] },
        { 
          model: TicketMessage, 
          as: 'messages',
          include: [{ model: User, as: 'author', attributes: ['id', 'name', 'email', 'roleId'] }],
        }
      ],
      order: [
        [{ model: TicketMessage, as: 'messages' }, 'createdAt', 'ASC']
      ]
    });

    if (!ticket) {
      return res.status(404).json({ success: false, message: 'Ticket not found' });
    }

    // Security check
    if (!isAdmin && ticket.userId !== req.user.id) {
      return res.status(403).json({ success: false, message: 'Forbidden access to ticket' });
    }

    return res.status(200).json({ success: true, data: ticket });
  } catch (err) {
    console.error('Error fetching ticket by id:', err);
    return res.status(500).json({ success: false, message: 'Internal Server Error' });
  }
};

const addMessage = async (req, res) => {
  try {
    const { body, type } = req.body;
    const ticketIdParam = req.params.id;

    // Build attachments array from uploaded files
    const attachments = (req.files || []).map(file => ({
      name: file.originalname,
      url: `/uploads/tickets/${file.filename}`,
      size: file.size,
      mimetype: file.mimetype
    }));

    if (!body && attachments.length === 0) {
      return res.status(400).json({ success: false, message: 'Message body or attachment is required' });
    }

    const ticket = await Ticket.findOne({ where: { id: ticketIdParam } });
    if (!ticket) {
      return res.status(404).json({ success: false, message: 'Ticket not found' });
    }

    // Determine type securely
    const isAdmin = req.user?.role?.type === 'admin';
    let msgType = type || 'user';
    if (isAdmin) {
      msgType = type === 'internal' ? 'internal' : 'agent';
    } else {
      msgType = 'user'; // Users can only send user messages
    }

    const message = await TicketMessage.create({
      ticketId: ticket.id,
      authorId: req.user.id,
      body: body || '',
      type: msgType,
      attachments: attachments.length > 0 ? attachments : []
    });

    // Refresh updated timestamp on ticket
    await ticket.changed('updatedAt', true);
    await ticket.save();

    const fullMessage = await TicketMessage.findByPk(message.id, {
      include: [{ model: User, as: 'author', attributes: ['id', 'name', 'email', 'roleId'] }]
    });

    try {
      getIo().to(`ticket_${ticket.id}`).emit('new_message', fullMessage);
    } catch (e) {
      console.error('[Socket.io] Error emitting new_message:', e.message);
    }

    return res.status(201).json({ success: true, message: 'Message added', data: fullMessage });
  } catch (err) {
    console.error('Error adding message:', err);
    return res.status(500).json({ success: false, message: 'Internal Server Error' });
  }
};

const updateTicket = async (req, res) => {
  try {
    const { status, agentId } = req.body;
    const ticketIdParam = req.params.id;

    const isAdmin = req.user?.role?.type === 'admin';
    if (!isAdmin) {
      return res.status(403).json({ success: false, message: 'Forbidden' });
    }

    const ticket = await Ticket.findOne({ where: { id: ticketIdParam } });
    if (!ticket) {
      return res.status(404).json({ success: false, message: 'Ticket not found' });
    }

    if (status) ticket.status = status;
    if (agentId !== undefined) ticket.agentId = agentId;

    await ticket.save();

    try {
      getIo().to(`ticket_${ticket.id}`).emit('ticket_updated', ticket);
      // Also emit to general room for admin dashboard updates
      getIo().emit('ticket_updated', ticket);
    } catch (e) {
      console.error('[Socket.io] Error emitting ticket_updated:', e.message);
    }

    return res.status(200).json({ success: true, message: 'Ticket updated', data: ticket });
  } catch (err) {
    console.error('Error updating ticket:', err);
    return res.status(500).json({ success: false, message: 'Internal Server Error' });
  }
};

module.exports = {
  createTicket,
  getTickets,
  getTicketById,
  addMessage,
  updateTicket
};
