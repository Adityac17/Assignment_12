/**
 * Event controller.
 * Events collection:
 *   { id, title, description, category, eventDate, venue, organizerId,
 *     ticketPrice, totalCapacity, availableTickets, createdAt }
 */

const { getDb } = require('../config/firebaseConfig');
const {
  ok,
  fail,
  makeId,
  isNonNegativeNumber,
  isPositiveInt,
} = require('../utils/helpers');

const EVENTS = 'events';
const TICKETS = 'tickets';

/** GET /api/events — public; upcoming events, optional ?category= & ?city=/venue */
async function listEvents(req, res) {
  const db = getDb();
  const nowIso = new Date().toISOString();

  // eventDate stored as ISO string; string comparison works for ISO 8601.
  let query = db.collection(EVENTS).where('eventDate', '>=', nowIso);

  const { category } = req.query;
  if (category) {
    query = query.where('category', '==', String(category));
  }

  const snap = await query.get();
  let events = snap.docs.map((d) => d.data());

  // Venue / city filter (?city= or ?venue=) applied in-memory for substring match.
  const cityTerm = req.query.city || req.query.venue;
  if (cityTerm) {
    const term = String(cityTerm).toLowerCase();
    events = events.filter(
      (e) => e.venue && e.venue.toLowerCase().includes(term)
    );
  }

  events.sort((a, b) => a.eventDate.localeCompare(b.eventDate));
  return ok(res, 200, 'Events fetched.', events);
}

/** GET /api/events/:id — public; details incl. availableTickets */
async function getEvent(req, res) {
  const db = getDb();
  const doc = await db.collection(EVENTS).doc(req.params.id).get();
  if (!doc.exists) {
    return fail(res, 404, 'Event not found.');
  }
  return ok(res, 200, 'Event fetched.', doc.data());
}

/** POST /api/events — Organizer only */
async function createEvent(req, res) {
  const {
    title,
    description,
    category,
    eventDate,
    venue,
    ticketPrice,
    totalCapacity,
  } = req.body || {};

  if (!title || !description || !category || !eventDate || !venue) {
    return fail(
      res,
      400,
      'title, description, category, eventDate and venue are required.'
    );
  }
  const parsedDate = new Date(eventDate);
  if (Number.isNaN(parsedDate.getTime())) {
    return fail(res, 400, 'eventDate must be a valid date.');
  }
  if (!isNonNegativeNumber(ticketPrice)) {
    return fail(res, 400, 'ticketPrice must be a number >= 0.');
  }
  if (!isPositiveInt(totalCapacity)) {
    return fail(res, 400, 'totalCapacity must be an integer >= 1.');
  }

  const db = getDb();
  const id = makeId('e');
  const event = {
    id,
    title: String(title).trim(),
    description: String(description).trim(),
    category: String(category).trim(),
    eventDate: parsedDate.toISOString(),
    venue: String(venue).trim(),
    organizerId: req.user.id,
    ticketPrice,
    totalCapacity,
    availableTickets: totalCapacity,
    createdAt: new Date().toISOString(),
  };

  await db.collection(EVENTS).doc(id).set(event);
  return ok(res, 201, 'Event created.', event);
}

/** PUT /api/events/:id — Organizer only AND must own the event */
async function updateEvent(req, res) {
  const db = getDb();
  const ref = db.collection(EVENTS).doc(req.params.id);
  const doc = await ref.get();
  if (!doc.exists) {
    return fail(res, 404, 'Event not found.');
  }
  const event = doc.data();
  if (event.organizerId !== req.user.id) {
    return fail(res, 403, 'You can only modify events you organize.');
  }

  const updates = {};
  const b = req.body || {};

  if (b.title !== undefined) updates.title = String(b.title).trim();
  if (b.description !== undefined) updates.description = String(b.description).trim();
  if (b.category !== undefined) updates.category = String(b.category).trim();
  if (b.venue !== undefined) updates.venue = String(b.venue).trim();
  if (b.eventDate !== undefined) {
    const d = new Date(b.eventDate);
    if (Number.isNaN(d.getTime())) {
      return fail(res, 400, 'eventDate must be a valid date.');
    }
    updates.eventDate = d.toISOString();
  }
  if (b.ticketPrice !== undefined) {
    if (!isNonNegativeNumber(b.ticketPrice)) {
      return fail(res, 400, 'ticketPrice must be a number >= 0.');
    }
    updates.ticketPrice = b.ticketPrice;
  }
  if (b.totalCapacity !== undefined) {
    if (!isPositiveInt(b.totalCapacity)) {
      return fail(res, 400, 'totalCapacity must be an integer >= 1.');
    }
    // Adjust availableTickets by the same delta, but never below 0.
    const sold = event.totalCapacity - event.availableTickets;
    if (b.totalCapacity < sold) {
      return fail(
        res,
        400,
        `totalCapacity cannot be less than tickets already sold (${sold}).`
      );
    }
    updates.totalCapacity = b.totalCapacity;
    updates.availableTickets = b.totalCapacity - sold;
  }

  if (Object.keys(updates).length === 0) {
    return fail(res, 400, 'No valid fields provided to update.');
  }

  await ref.update(updates);
  const updated = await ref.get();
  return ok(res, 200, 'Event updated.', updated.data());
}

/** DELETE /api/events/:id — Organizer only, must own (cancels the event) */
async function deleteEvent(req, res) {
  const db = getDb();
  const ref = db.collection(EVENTS).doc(req.params.id);
  const doc = await ref.get();
  if (!doc.exists) {
    return fail(res, 404, 'Event not found.');
  }
  if (doc.data().organizerId !== req.user.id) {
    return fail(res, 403, 'You can only cancel events you organize.');
  }

  await ref.delete();
  return ok(res, 200, 'Event cancelled.', { id: req.params.id });
}

/** GET /api/events/:id/attendees — Organizer only, must own */
async function listAttendees(req, res) {
  const db = getDb();
  const eventDoc = await db.collection(EVENTS).doc(req.params.id).get();
  if (!eventDoc.exists) {
    return fail(res, 404, 'Event not found.');
  }
  if (eventDoc.data().organizerId !== req.user.id) {
    return fail(res, 403, 'You can only view attendees for events you organize.');
  }

  const snap = await db
    .collection(TICKETS)
    .where('eventId', '==', req.params.id)
    .get();

  const attendees = snap.docs
    .map((d) => d.data())
    .filter((t) => t.status === 'confirmed')
    .map((t) => ({
      ticketId: t.id,
      userId: t.userId,
      attendeeName: t.attendeeName,
      attendeeEmail: t.attendeeEmail,
      quantity: t.quantity,
      bookingRef: t.bookingRef,
      bookedAt: t.bookedAt,
    }));

  return ok(res, 200, 'Attendees fetched.', attendees);
}

module.exports = {
  listEvents,
  getEvent,
  createEvent,
  updateEvent,
  deleteEvent,
  listAttendees,
};
