/**
 * Strict rate limiter for the ticket-booking route.
 *
 * Limits each client (by IP) to 10 requests per minute. Emits RateLimit-*
 * standard headers, no legacy X-RateLimit-* headers, and a JSON 429 body that
 * matches the app's { success, message } envelope.
 */

const rateLimit = require('express-rate-limit');

const bookingLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 10, // 10 requests per window per IP
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res) => {
    res.status(429).json({
      success: false,
      message: 'Too many booking requests. Please try again in a minute.',
    });
  },
});

module.exports = { bookingLimiter };
