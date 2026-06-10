/**
 * Middleware to restrict access to user panel routes.
 * Only users with role type 'user' can access /api/panel/* endpoints.
 */
function requireUserPanel(req, res, next) {
  if (!req.user || !req.user.role) {
    return res.status(403).json({
      success: false,
      message: 'Access denied. No role assigned.'
    });
  }

  if (req.user.role.type !== 'user') {
    return res.status(403).json({
      success: false,
      message: 'Access denied. This route is restricted to user panel only.'
    });
  }

  next();
}

module.exports = requireUserPanel;
