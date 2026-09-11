/**
 * Swagger / OpenAPI 3.0 configuration.
 *
 * swagger-jsdoc scans the route files for @swagger JSDoc annotations and builds
 * a full OpenAPI spec. It is served interactively at /api-docs and as raw JSON
 * at /api-docs.json (wired up in server.js).
 */

const swaggerJsdoc = require('swagger-jsdoc');
const path = require('path');

const options = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'Event Management & Ticketing API',
      version: '1.0.0',
      description:
        'A backend for managing events and booking tickets. Organizers create ' +
        'and manage events; Attendees browse events and book/cancel tickets. ' +
        'Auth is JWT-based with role-based authorization. Ticket booking is ' +
        'atomic (Firestore transactions) and rate limited.',
      contact: { name: 'Aditya S Chouksey' },
      license: { name: 'MIT' },
    },
    servers: [
      { url: 'http://localhost:3000', description: 'Local development server' },
    ],
    tags: [
      { name: 'Auth', description: 'Registration, login and profile' },
      { name: 'Events', description: 'Event management (Organizer) and browsing (public)' },
      { name: 'Tickets', description: 'Ticket booking, listing and cancellation (Attendee)' },
    ],
    components: {
      securitySchemes: {
        bearerAuth: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT',
          description: 'Paste the JWT returned by /api/auth/login as: Bearer <token>',
        },
      },
      schemas: {
        ApiError: {
          type: 'object',
          properties: {
            success: { type: 'boolean', example: false },
            message: { type: 'string', example: 'Resource not found' },
          },
        },
        ApiSuccess: {
          type: 'object',
          properties: {
            success: { type: 'boolean', example: true },
            message: { type: 'string', example: 'OK' },
            data: { type: 'object' },
          },
        },
        User: {
          type: 'object',
          properties: {
            id: { type: 'string', example: 'u_ab12cd' },
            username: { type: 'string', example: 'jane_doe' },
            email: { type: 'string', example: 'jane@example.com' },
            role: { type: 'string', enum: ['Organizer', 'Attendee'], example: 'Organizer' },
            createdAt: { type: 'string', format: 'date-time' },
          },
        },
        Event: {
          type: 'object',
          properties: {
            id: { type: 'string', example: 'e_xy98zz' },
            title: { type: 'string', example: 'React Summit 2026' },
            description: { type: 'string', example: 'A day of React talks.' },
            category: { type: 'string', example: 'Technology' },
            eventDate: { type: 'string', format: 'date-time', example: '2026-12-01T10:00:00.000Z' },
            venue: { type: 'string', example: 'Bengaluru Convention Center' },
            organizerId: { type: 'string', example: 'u_ab12cd' },
            ticketPrice: { type: 'number', example: 499 },
            totalCapacity: { type: 'integer', example: 500 },
            availableTickets: { type: 'integer', example: 500 },
            createdAt: { type: 'string', format: 'date-time' },
          },
        },
        Ticket: {
          type: 'object',
          properties: {
            id: { type: 'string', example: 't_qwe456' },
            eventId: { type: 'string', example: 'e_xy98zz' },
            eventTitle: { type: 'string', example: 'React Summit 2026' },
            userId: { type: 'string', example: 'u_zz00aa' },
            attendeeName: { type: 'string', example: 'John Attendee' },
            attendeeEmail: { type: 'string', example: 'john@example.com' },
            quantity: { type: 'integer', example: 2 },
            totalPaid: { type: 'number', example: 998 },
            bookingRef: { type: 'string', example: 'BR-8F3A2C1D' },
            status: { type: 'string', enum: ['confirmed', 'cancelled'], example: 'confirmed' },
            bookedAt: { type: 'string', format: 'date-time' },
          },
        },
      },
    },
    security: [],
  },
  // Scan route files (and controllers, in case annotations live there).
  apis: [
    path.join(__dirname, '..', 'routes', '*.js'),
    path.join(__dirname, '..', 'controllers', '*.js'),
  ],
};

const swaggerSpec = swaggerJsdoc(options);

module.exports = swaggerSpec;
