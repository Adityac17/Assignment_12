/**
 * Ticket controller.
 * Tickets collection:
 *   { id, eventId, eventTitle, userId, attendeeName, attendeeEmail, quantity,
 *     totalPaid, bookingRef, status, bookedAt }
 *
 * Booking and cancellation use Firestore transactions (db.runTransaction) to
 * atomically check + mutate availableTickets, preventing overselling under
 * concurrent load.
 */

const { getDb } = require('../config/firebaseConfig');
const {
  ok,
  fail,
  makeId,
  makeBookingRef,
  isValidEmail,
  isPositiveInt,
} = require('../utils/helpers');

const EVENTS = 'events';
const TICKETS = 'tickets';

/** POST /api/tickets/book — Attendee only, rate limited */
async function bookTicket(req, res) {
  const { eventId, quantity, attendeeName, attendeeEmail } = req.body || {};

  if (!eventId) {
    return fail(res, 400, 'eventId is required.');
  }
  if (!isPositiveInt(quantity)) {
    return fail(res, 400, 'quantity must be an integer >= 1.');
  }
  if (!attendeeName || !attendeeEmail) {
    return fail(res, 400, 'attendeeName and attendeeEmail are required.');
  }
  if (!isValidEmail(attendeeEmail)) {
    return fail(res, 400, 'A valid attendeeEmail is required.');
  }

  const db = getDb();
  const eventRef = db.collection(EVENTS).doc(eventId);
  const ticketId = makeId('t');
  const ticketRef = db.collection(TICKETS).doc(ticketId);

  let createdTicket;
  try {
    createdTicket = await db.runTransaction(async (tx) => {
      const eventSnap = await tx.get(eventRef);
      if (!eventSnap.exists) {
        const e = new Error('Event not found.');
        e.statusCode = 404;
        throw e;
      }
      const event = eventSnap.data();

      if (event.availableTickets < quantity) {
        const e = new Error('Insufficient tickets');
        e.statusCode = 400;
        throw e;
      }

      const ticket = {
        id: ticketId,
        eventId,
        eventTitle: event.title,
        userId: req.user.id,
        attendeeName: String(attendeeName).trim(),
        attendeeEmail: String(attendeeEmail).toLowerCase().trim(),
        quantity,
        totalPaid: quantity * event.ticketPrice,
        bookingRef: makeBookingRef(),
        status: 'confirmed',
        bookedAt: new Date().toISOString(),
      };

      tx.update(eventRef, {
        availableTickets: event.availableTickets - quantity,
      });
      tx.set(ticketRef, ticket);

      return ticket;
    });
  } catch (err) {
    if (err.statusCode) {
      return fail(res, err.statusCode, err.message);
    }
    throw err; // unexpected -> centralized handler (500)
  }

  return ok(res, 201, 'Ticket booked.', createdTicket);
}

/** GET /api/tickets/my-tickets — Attendee only; own tickets */
async function myTickets(req, res) {
  const db = getDb();
  const snap = await db
    .collection(TICKETS)
    .where('userId', '==', req.user.id)
    .get();

  const tickets = snap.docs
    .map((d) => d.data())
    .sort((a, b) => (b.bookedAt || '').localeCompare(a.bookedAt || ''));

  return ok(res, 200, 'Tickets fetched.', tickets);
}

/** POST /api/tickets/:id/cancel — Attendee only, must own; restores capacity */
async function cancelTicket(req, res) {
  const db = getDb();
  const ticketRef = db.collection(TICKETS).doc(req.params.id);

  let result;
  try {
    result = await db.runTransaction(async (tx) => {
      const ticketSnap = await tx.get(ticketRef);
      if (!ticketSnap.exists) {
        const e = new Error('Ticket not found.');
        e.statusCode = 404;
        throw e;
      }
      const ticket = ticketSnap.data();

      if (ticket.userId !== req.user.id) {
        const e = new Error('You can only cancel your own tickets.');
        e.statusCode = 403;
        throw e;
      }
      if (ticket.status === 'cancelled') {
        const e = new Error('Ticket is already cancelled.');
        e.statusCode = 400;
        throw e;
      }

      // Restore availability on the parent event (if it still exists).
      const eventRef = db.collection(EVENTS).doc(ticket.eventId);
      const eventSnap = await tx.get(eventRef);
      if (eventSnap.exists) {
        tx.update(eventRef, {
          availableTickets: eventSnap.data().availableTickets + ticket.quantity,
        });
      }

      tx.update(ticketRef, { status: 'cancelled' });
      return { ...ticket, status: 'cancelled' };
    });
  } catch (err) {
    if (err.statusCode) {
      return fail(res, err.statusCode, err.message);
    }
    throw err;
  }

  return ok(res, 200, 'Ticket cancelled.', result);
}

module.exports = { bookTicket, myTickets, cancelTicket };
