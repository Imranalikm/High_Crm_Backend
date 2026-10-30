const path = require('path');
const { RolePermission, Module, Ticket, TicketMessage } = require('../models');
const authenticateToken = require('./auth.middleware');

/**
 * Check whether an admin role holds a specific module permission (super_admin bypasses).
 */
async function hasPermission(user, moduleKey, action) {
  if (user.role && user.role.key === 'super_admin') return true;
  if (!user.roleId) return false;

  const permission = await RolePermission.findOne({
    where: { roleId: user.roleId, action },
    include: [{ model: Module, as: 'module', where: { key: moduleKey } }]
  });
  return Boolean(permission);
}

/**
 * A user may see a ticket attachment if it belongs to one of their own tickets
 * (on the ticket itself or a non-internal message).
 */
async function userCanSeeTicketFile(userId, url) {
  const tickets = await Ticket.findAll({
    where: { userId },
    attributes: ['id', 'attachments'],
    include: [{ model: TicketMessage, as: 'messages', attributes: ['type', 'attachments'] }]
  });

  const hasUrl = (attachments) => Array.isArray(attachments) && attachments.some(a => a && a.url === url);

  return tickets.some(ticket =>
    hasUrl(ticket.attachments) ||
    (ticket.messages || []).some(msg => msg.type !== 'internal' && hasUrl(msg.attachments))
  );
}

/**
 * Authorize access to a file under /uploads/<folder>/<filename>.
 */
async function authorizeUpload(req, res, next) {
  try {
    const segments = req.path.split('/').filter(Boolean);
    if (segments.length !== 2 || segments.some(s => s === '..' || s.includes('\\'))) {
      return res.status(404).json({ success: false, message: 'File not found.' });
    }

    const [folder, filename] = segments;
    const user = req.user;
    const isAdmin = user.role && user.role.type === 'admin';
    let allowed = false;

    switch (folder) {
      case 'kyc':
        allowed = isAdmin
          ? await hasPermission(user, 'users', 'view')
          : filename.startsWith(`${user.id}_`);
        break;
      case 'deposits':
        allowed = isAdmin || filename.startsWith(`deposit_${user.id}_`);
        break;
      case 'tickets':
        allowed = isAdmin ||
          filename.startsWith(`ticket_${user.id}_`) ||
          await userCanSeeTicketFile(user.id, `/uploads/tickets/${path.basename(filename)}`);
        break;
      default:
        return res.status(404).json({ success: false, message: 'File not found.' });
    }

    if (!allowed) {
      return res.status(403).json({ success: false, message: 'You do not have access to this file.' });
    }

    res.set('Cache-Control', 'private, no-store');
    next();
  } catch (error) {
    console.error('[Upload Access] Error:', error);
    return res.status(500).json({ success: false, message: 'Internal server error validating file access.' });
  }
}

/**
 * Require login for uploaded files. <img> and <a> tags cannot send an
 * Authorization header, so the access token may also be passed as ?token=.
 */
function requireUploadAccess(req, res, next) {
  if (!req.headers['authorization'] && typeof req.query.token === 'string') {
    req.headers['authorization'] = `Bearer ${req.query.token}`;
  }
  // Keep the token out of request logs (morgan reads originalUrl)
  req.originalUrl = req.originalUrl.split('?')[0];
  authenticateToken(req, res, () => authorizeUpload(req, res, next));
}

module.exports = requireUploadAccess;
