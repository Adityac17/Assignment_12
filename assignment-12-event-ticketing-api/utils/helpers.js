/**
 * Small shared helpers: consistent responses, async wrapper, id/ref generators
 * and simple validators.
 */

const crypto = require('crypto');

/** Standard success response. */
function ok(res, status, message, data) {
  const body = { success: true, message };
  if (data !== undefined) body.data = data;
  return res.status(status).json(body);
}

/** Standard error response. */
function fail(res, status, message) {
  return res.status(status).json({ success: false, message });
}

/**
 * Wraps an async route handler so thrown errors / rejected promises are
 * forwarded to the centralized error handler via next(err).
 */
function asyncHandler(fn) {
  return function (req, res, next) {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}

/** Short, collision-resistant id with a type prefix, e.g. "e_9f8a1b2c". */
function makeId(prefix) {
  return `${prefix}_${crypto.randomBytes(5).toString('hex')}`;
}

/** Human-friendly booking reference, e.g. "BR-9F8A1B2C". */
function makeBookingRef() {
  return `BR-${crypto.randomBytes(4).toString('hex').toUpperCase()}`;
}

/** Basic email format check. */
function isValidEmail(email) {
  return typeof email === 'string' && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

/** True when value is a finite number >= 0. */
function isNonNegativeNumber(v) {
  return typeof v === 'number' && Number.isFinite(v) && v >= 0;
}

/** True when value is an integer >= 1. */
function isPositiveInt(v) {
  return Number.isInteger(v) && v >= 1;
}

module.exports = {
  ok,
  fail,
  asyncHandler,
  makeId,
  makeBookingRef,
  isValidEmail,
  isNonNegativeNumber,
  isPositiveInt,
};
