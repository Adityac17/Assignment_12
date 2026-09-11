const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const roleGuard = require('../middleware/roleGuard');
const { bookingLimiter } = require('../middleware/rateLimiter');
const { asyncHandler } = require('../utils/helpers');
const {
  bookTicket,
  myTickets,
  cancelTicket,
} = require('../controllers/ticketController');

/**
 * @swagger
 * /api/tickets/book:
 *   post:
 *     tags: [Tickets]
 *     summary: Book tickets for an event (Attendee only; rate limited 10/min)
 *     description: >
 *       Atomically re-checks availability, decrements availableTickets and
 *       creates a confirmed ticket inside a Firestore transaction to prevent
 *       overselling. Rate limited to 10 requests/minute per IP (429 on excess).
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [eventId, quantity, attendeeName, attendeeEmail]
 *             properties:
 *               eventId: { type: string, example: e_9f8a1b2c }
 *               quantity: { type: integer, minimum: 1, example: 2 }
 *               attendeeName: { type: string, example: John Attendee }
 *               attendeeEmail: { type: string, example: john@example.com }
 *     responses:
 *       201:
 *         description: Ticket booked
 *         content:
 *           application/json:
 *             schema:
 *               allOf:
 *                 - $ref: '#/components/schemas/ApiSuccess'
 *                 - type: object
 *                   properties:
 *                     data: { $ref: '#/components/schemas/Ticket' }
 *       400: { description: Validation error or "Insufficient tickets", content: { application/json: { schema: { $ref: '#/components/schemas/ApiError' } } } }
 *       401: { description: Missing/invalid token, content: { application/json: { schema: { $ref: '#/components/schemas/ApiError' } } } }
 *       403: { description: Not an Attendee, content: { application/json: { schema: { $ref: '#/components/schemas/ApiError' } } } }
 *       404: { description: Event not found, content: { application/json: { schema: { $ref: '#/components/schemas/ApiError' } } } }
 *       429: { description: Rate limit exceeded (10/min), content: { application/json: { schema: { $ref: '#/components/schemas/ApiError' } } } }
 */
router.post(
  '/book',
  bookingLimiter,
  auth,
  roleGuard('Attendee'),
  asyncHandler(bookTicket)
);

/**
 * @swagger
 * /api/tickets/my-tickets:
 *   get:
 *     tags: [Tickets]
 *     summary: List the authenticated attendee's own tickets (Attendee only)
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Tickets fetched
 *         content:
 *           application/json:
 *             schema:
 *               allOf:
 *                 - $ref: '#/components/schemas/ApiSuccess'
 *                 - type: object
 *                   properties:
 *                     data:
 *                       type: array
 *                       items: { $ref: '#/components/schemas/Ticket' }
 *       401: { description: Missing/invalid token, content: { application/json: { schema: { $ref: '#/components/schemas/ApiError' } } } }
 *       403: { description: Not an Attendee, content: { application/json: { schema: { $ref: '#/components/schemas/ApiError' } } } }
 */
router.get('/my-tickets', auth, roleGuard('Attendee'), asyncHandler(myTickets));

/**
 * @swagger
 * /api/tickets/{id}/cancel:
 *   post:
 *     tags: [Tickets]
 *     summary: Cancel a ticket (Attendee only, must own); restores availability
 *     description: >
 *       Atomically sets status to cancelled and restores availableTickets on the
 *       parent event inside a Firestore transaction. Rejects if already cancelled.
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *         example: t_1a2b3c4d
 *     responses:
 *       200:
 *         description: Ticket cancelled
 *         content:
 *           application/json:
 *             schema:
 *               allOf:
 *                 - $ref: '#/components/schemas/ApiSuccess'
 *                 - type: object
 *                   properties:
 *                     data: { $ref: '#/components/schemas/Ticket' }
 *       400: { description: Already cancelled, content: { application/json: { schema: { $ref: '#/components/schemas/ApiError' } } } }
 *       401: { description: Missing/invalid token, content: { application/json: { schema: { $ref: '#/components/schemas/ApiError' } } } }
 *       403: { description: Not owner / not Attendee, content: { application/json: { schema: { $ref: '#/components/schemas/ApiError' } } } }
 *       404: { description: Ticket not found, content: { application/json: { schema: { $ref: '#/components/schemas/ApiError' } } } }
 */
router.post('/:id/cancel', auth, roleGuard('Attendee'), asyncHandler(cancelTicket));

module.exports = router;
