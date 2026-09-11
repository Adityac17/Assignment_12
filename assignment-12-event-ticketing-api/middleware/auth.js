/**
 * JWT authentication middleware.
 *
 * Verifies a `Bearer <token>` Authorization header. On success attaches
 * `req.user = { id, role }` (the token payload) and calls next(). On failure
 * responds with 401 in the standard JSON envelope.
 */

const jwt = require('jsonwebtoken');

module.exports = function auth(req, res, next) {
  const header = req.headers.authorization || '';
  const [scheme, token] = header.split(' ');

  if (scheme !== 'Bearer' || !token) {
    return res.status(401).json({
      success: false,
      message: 'Authentication required: provide a Bearer token.',
    });
  }

  try {
    const secret = process.env.JWT_SECRET || 'dev-insecure-secret';
    const payload = jwt.verify(token, secret);
    req.user = { id: payload.id, role: payload.role };
    return next();
  } catch (err) {
    return res.status(401).json({
      success: false,
      message: 'Invalid or expired token.',
    });
  }
};
