/**
 * Auth controller: register, login, profile.
 * Users collection: { id, username, email, passwordHash, role, createdAt }
 */

const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { getDb } = require('../config/firebaseConfig');
const {
  ok,
  fail,
  makeId,
  isValidEmail,
} = require('../utils/helpers');

const VALID_ROLES = ['Organizer', 'Attendee'];
const USERS = 'users';

/** POST /api/auth/register */
async function register(req, res) {
  const { username, email, password, role } = req.body || {};

  if (!username || !email || !password || !role) {
    return fail(res, 400, 'username, email, password and role are required.');
  }
  if (!isValidEmail(email)) {
    return fail(res, 400, 'A valid email is required.');
  }
  if (typeof password !== 'string' || password.length < 6) {
    return fail(res, 400, 'Password must be at least 6 characters.');
  }
  if (!VALID_ROLES.includes(role)) {
    return fail(res, 400, `role must be one of: ${VALID_ROLES.join(', ')}.`);
  }

  const db = getDb();
  const normalizedEmail = email.toLowerCase().trim();

  // Reject duplicate email.
  const existing = await db
    .collection(USERS)
    .where('email', '==', normalizedEmail)
    .limit(1)
    .get();
  if (!existing.empty) {
    return fail(res, 400, 'An account with this email already exists.');
  }

  const id = makeId('u');
  const passwordHash = await bcrypt.hash(password, 10);
  const user = {
    id,
    username: String(username).trim(),
    email: normalizedEmail,
    passwordHash,
    role,
    createdAt: new Date().toISOString(),
  };

  await db.collection(USERS).doc(id).set(user);

  const { passwordHash: _omit, ...safeUser } = user;
  return ok(res, 201, 'Registration successful.', safeUser);
}

/** POST /api/auth/login */
async function login(req, res) {
  const { email, password } = req.body || {};
  if (!email || !password) {
    return fail(res, 400, 'email and password are required.');
  }

  const db = getDb();
  const snap = await db
    .collection(USERS)
    .where('email', '==', String(email).toLowerCase().trim())
    .limit(1)
    .get();

  if (snap.empty) {
    return fail(res, 401, 'Invalid credentials.');
  }

  const user = snap.docs[0].data();
  const match = await bcrypt.compare(password, user.passwordHash);
  if (!match) {
    return fail(res, 401, 'Invalid credentials.');
  }

  const secret = process.env.JWT_SECRET || 'dev-insecure-secret';
  const expiresIn = process.env.JWT_EXPIRES_IN || '1d';
  const token = jwt.sign({ id: user.id, role: user.role }, secret, { expiresIn });

  return ok(res, 200, 'Login successful.', {
    token,
    user: { id: user.id, username: user.username, email: user.email, role: user.role },
  });
}

/** GET /api/auth/profile (protected) */
async function profile(req, res) {
  const db = getDb();
  const doc = await db.collection(USERS).doc(req.user.id).get();
  if (!doc.exists) {
    return fail(res, 404, 'User not found.');
  }
  const { passwordHash, ...safeUser } = doc.data();
  return ok(res, 200, 'Profile fetched.', safeUser);
}

module.exports = { register, login, profile };
