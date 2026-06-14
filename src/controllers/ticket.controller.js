const { Ticket, User } = require('../models');

// Generate random ticket ID e.g., TICK-1234
function generateTicketId() {
  const num = Math.floor(1000 + Math.random() * 9000);
  return `TICK-${num}`;
}

const createTicket = async (req, res) => {
  try {
    const { subject, category, priority, description } = req.body;
    
    if (!subject || !category || !description) {
      return res.status(400).json({ success: false, message: 'Missing required fields: subject, category, or description' });
    }

    const ticket = await Ticket.create({
      ticketId: generateTicketId(),
      userId: req.user.id,
      subject,
      category,
      priority: priority || 'MED',
      status: 'OPEN',
      description,
    });

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
        { model: User, as: 'user', attributes: ['id', 'name', 'email'] }
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
        { model: User, as: 'user', attributes: ['id', 'name', 'email'] }
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

module.exports = {
  createTicket,
  getTickets,
  getTicketById
};
