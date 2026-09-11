/**
 * Role-based access control middleware factory.
 *
 * Usage: roleGuard('Organizer') or roleGuard('Attendee', 'Organizer').
 * Must run AFTER the `auth` middleware (needs req.user). Responds 403 when the
 * authenticated user's role is not in the allowed set.
 */

module.exports = function roleGuard(...allowedRoles) {
  return function (req, res, next) {
    if (!req.user || !req.user.role) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required.',
      });
    }

    if (!allowedRoles.includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        message: `Access denied: requires role ${allowedRoles.join(' or ')}.`,
      });
    }

    return next();
  };
};
