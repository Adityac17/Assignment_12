const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const roleGuard = require('../middleware/roleGuard');
const { asyncHandler } = require('../utils/helpers');
const {
  listEvents,
  getEvent,
  createEvent,
  updateEvent,
  deleteEvent,
  listAttendees,
} = require('../controllers/eventController');

/**
 * @swagger
 * /api/events:
 *   get:
 *     tags: [Events]
 *     summary: List upcoming events (public)
 *     description: Returns events whose eventDate is now or later. Optional filters.
 *     parameters:
 *       - in: query
 *         name: category
 *         schema: { type: string }
 *         description: Filter by exact category
 *         example: Technology
 *       - in: query
 *         name: city
 *         schema: { type: string }
 *         description: Case-insensitive substring match on venue (alias of venue)
 *         example: Bengaluru
 *       - in: query
 *         name: venue
 *         schema: { type: string }
 *         description: Case-insensitive substring match on venue
 *     responses:
 *       200:
 *         description: Events fetched
 *         content:
 *           application/json:
 *             schema:
 *               allOf:
 *                 - $ref: '#/components/schemas/ApiSuccess'
 *                 - type: object
 *                   properties:
 *                     data:
 *                       type: array
 *                       items: { $ref: '#/components/schemas/Event' }
 *       503:
 *         description: Database unavailable
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ApiError' }
 */
router.get('/', asyncHandler(listEvents));

/**
 * @swagger
 * /api/events/{id}:
 *   get:
 *     tags: [Events]
 *     summary: Get event details including available ticket count (public)
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *         example: e_9f8a1b2c
 *     responses:
 *       200:
 *         description: Event fetched
 *         content:
 *           application/json:
 *             schema:
 *               allOf:
 *                 - $ref: '#/components/schemas/ApiSuccess'
 *                 - type: object
 *                   properties:
 *                     data: { $ref: '#/components/schemas/Event' }
 *       404:
 *         description: Event not found
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ApiError' }
 */
router.get('/:id', asyncHandler(getEvent));

/**
 * @swagger
 * /api/events:
 *   post:
 *     tags: [Events]
 *     summary: Create an event (Organizer only)
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [title, description, category, eventDate, venue, ticketPrice, totalCapacity]
 *             properties:
 *               title: { type: string, example: React Summit 2026 }
 *               description: { type: string, example: A full day of React talks. }
 *               category: { type: string, example: Technology }
 *               eventDate: { type: string, format: date-time, example: 2026-12-01T10:00:00.000Z }
 *               venue: { type: string, example: Bengaluru Convention Center }
 *               ticketPrice: { type: number, example: 499 }
 *               totalCapacity: { type: integer, example: 500 }
 *     responses:
 *       201:
 *         description: Event created (availableTickets initialised to totalCapacity)
 *         content:
 *           application/json:
 *             schema:
 *               allOf:
 *                 - $ref: '#/components/schemas/ApiSuccess'
 *                 - type: object
 *                   properties:
 *                     data: { $ref: '#/components/schemas/Event' }
 *       400: { description: Validation error, content: { application/json: { schema: { $ref: '#/components/schemas/ApiError' } } } }
 *       401: { description: Missing/invalid token, content: { application/json: { schema: { $ref: '#/components/schemas/ApiError' } } } }
 *       403: { description: Not an Organizer, content: { application/json: { schema: { $ref: '#/components/schemas/ApiError' } } } }
 */
router.post('/', auth, roleGuard('Organizer'), asyncHandler(createEvent));

/**
 * @swagger
 * /api/events/{id}:
 *   put:
 *     tags: [Events]
 *     summary: Update an event (Organizer only, must own the event)
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               title: { type: string }
 *               description: { type: string }
 *               category: { type: string }
 *               eventDate: { type: string, format: date-time }
 *               venue: { type: string }
 *               ticketPrice: { type: number }
 *               totalCapacity: { type: integer }
 *     responses:
 *       200: { description: Event updated, content: { application/json: { schema: { allOf: [ { $ref: '#/components/schemas/ApiSuccess' }, { type: object, properties: { data: { $ref: '#/components/schemas/Event' } } } ] } } } }
 *       400: { description: Validation error, content: { application/json: { schema: { $ref: '#/components/schemas/ApiError' } } } }
 *       401: { description: Missing/invalid token, content: { application/json: { schema: { $ref: '#/components/schemas/ApiError' } } } }
 *       403: { description: Not owner / not Organizer, content: { application/json: { schema: { $ref: '#/components/schemas/ApiError' } } } }
 *       404: { description: Event not found, content: { application/json: { schema: { $ref: '#/components/schemas/ApiError' } } } }
 */
router.put('/:id', auth, roleGuard('Organizer'), asyncHandler(updateEvent));

/**
 * @swagger
 * /api/events/{id}:
 *   delete:
 *     tags: [Events]
 *     summary: Cancel/delete an event (Organizer only, must own)
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200: { description: Event cancelled, content: { application/json: { schema: { $ref: '#/components/schemas/ApiSuccess' } } } }
 *       401: { description: Missing/invalid token, content: { application/json: { schema: { $ref: '#/components/schemas/ApiError' } } } }
 *       403: { description: Not owner / not Organizer, content: { application/json: { schema: { $ref: '#/components/schemas/ApiError' } } } }
 *       404: { description: Event not found, content: { application/json: { schema: { $ref: '#/components/schemas/ApiError' } } } }
 */
router.delete('/:id', auth, roleGuard('Organizer'), asyncHandler(deleteEvent));

/**
 * @swagger
 * /api/events/{id}/attendees:
 *   get:
 *     tags: [Events]
 *     summary: List attendees for an event (Organizer only, must own)
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: Attendees fetched (from confirmed tickets)
 *         content:
 *           application/json:
 *             schema:
 *               allOf:
 *                 - $ref: '#/components/schemas/ApiSuccess'
 *                 - type: object
 *                   properties:
 *                     data:
 *                       type: array
 *                       items:
 *                         type: object
 *                         properties:
 *                           ticketId: { type: string }
 *                           userId: { type: string }
 *                           attendeeName: { type: string }
 *                           attendeeEmail: { type: string }
 *                           quantity: { type: integer }
 *                           bookingRef: { type: string }
 *                           bookedAt: { type: string, format: date-time }
 *       401: { description: Missing/invalid token, content: { application/json: { schema: { $ref: '#/components/schemas/ApiError' } } } }
 *       403: { description: Not owner / not Organizer, content: { application/json: { schema: { $ref: '#/components/schemas/ApiError' } } } }
 *       404: { description: Event not found, content: { application/json: { schema: { $ref: '#/components/schemas/ApiError' } } } }
 */
router.get('/:id/attendees', auth, roleGuard('Organizer'), asyncHandler(listAttendees));

module.exports = router;
