/**
 * Centralized error handling & 404 handler.
 *
 * Every response in the app uses the shape { success, message, data? }.
 */

// Fallback 404 for unmatched routes.
function notFoundHandler(req, res) {
  res.status(404).json({
    success: false,
    message: `Route not found: ${req.method} ${req.originalUrl}`,
  });
}

// Global error handler. Must have 4 args for Express to treat it as such.
// eslint-disable-next-line no-unused-vars
function errorHandler(err, req, res, next) {
  // Firestore-unavailable errors carry statusCode 503 (set in firebaseConfig).
  const status = err.statusCode || err.status || 500;

  // Avoid leaking internals on unexpected 500s.
  const message =
    status >= 500 && !err.isFirebaseUnavailable
      ? 'Internal server error.'
      : err.message || 'Something went wrong.';

  if (status >= 500 && !err.isFirebaseUnavailable) {
    // Log full error server-side for debugging (skip the expected 503).
    console.error('[error]', err);
  }

  res.status(status).json({ success: false, message });
}

module.exports = { notFoundHandler, errorHandler };
