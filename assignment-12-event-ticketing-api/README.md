# Event Management & Ticketing API

> A production-style REST API for managing events and booking tickets — built with Node.js, Express and Firebase Firestore, secured with JWT authentication and role-based access control, with atomic, rate-limited ticket booking that prevents overselling.

[![Node.js](https://img.shields.io/badge/Node.js-18%2B-339933?logo=node.js&logoColor=white)](https://nodejs.org/)
[![Express](https://img.shields.io/badge/Express-4.19-000000?logo=express&logoColor=white)](https://expressjs.com/)
[![Firebase](https://img.shields.io/badge/Firebase%20Firestore-Admin%2012-FFCA28?logo=firebase&logoColor=black)](https://firebase.google.com/docs/firestore)
[![JWT](https://img.shields.io/badge/Auth-JWT-000000?logo=jsonwebtokens&logoColor=white)](https://jwt.io/)
[![Swagger](https://img.shields.io/badge/Docs-Swagger%20UI-85EA2D?logo=swagger&logoColor=black)](https://swagger.io/)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](#license)

---

## Table of Contents

- [Overview](#overview)
- [Features](#features)
- [Tech Stack](#tech-stack)
- [Project Structure](#project-structure)
- [Prerequisites](#prerequisites)
- [Installation & Setup](#installation--setup)
- [Environment Variables](#environment-variables)
- [Firebase Setup](#firebase-setup)
- [Running the Application](#running-the-application)
- [API Reference](#api-reference)
- [Roles & Permissions](#roles--permissions)
- [Firestore Schema](#firestore-schema)
- [Rate Limiting](#rate-limiting)
- [Concurrency & Overselling Prevention](#concurrency--overselling-prevention)
- [API Documentation (Swagger)](#api-documentation-swagger)
- [Example Walkthrough](#example-walkthrough)
- [Design Choices & Notes](#design-choices--notes)
- [Author](#author)
- [License](#license)

---

## Overview

This service is a backend for an event-ticketing platform. **Organizers** create and manage
events; **Attendees** browse events and book or cancel tickets. Authentication is JWT-based,
and every protected route is guarded by role-based authorization.

The booking flow is the heart of the system: tickets are booked inside a **Firestore
transaction** so that seat inventory is decremented atomically, guaranteeing an event can
never be oversold even under concurrent requests. Booking is additionally **rate limited** to
absorb bursts and abuse. Every response follows a single, predictable envelope —
`{ success, message, data? }` — and interactive documentation is served through Swagger UI.

The application also **degrades gracefully**: if no Firebase credentials are present, the server
still boots (Swagger, auth guards, rate limiting and routing all work) and any route that needs
the database returns a clean `503` instead of crashing.

## Features

- **JWT authentication** — register, log in for a signed token, and fetch your profile.
- **Role-based access control (RBAC)** — `Organizer` and `Attendee` roles with per-route guards.
- **Event management** — full Organizer CRUD, plus public listing and detail endpoints.
- **Event discovery** — public event list with `category`, `city`, and `venue` filters; upcoming events only, sorted by date.
- **Atomic ticket booking** — inventory decremented inside a `runTransaction`, so events cannot be oversold.
- **Ticket cancellation** — cancelling a ticket atomically restores inventory to the event.
- **Rate-limited booking** — 10 requests per minute per IP on the booking endpoint (`429` on exceed).
- **Organizer attendee lists** — Organizers can view confirmed attendees for their own events.
- **Consistent response envelope** — every route returns `{ success, message, data? }`.
- **Centralized error handling** — one error handler, a JSON 404 handler, and no internal leakage on `500`s.
- **Graceful DB degradation** — boots without Firebase and returns `503` on DB routes until configured.
- **Interactive API docs** — Swagger UI at `/api-docs` and the raw OpenAPI spec at `/api-docs.json`.

## Tech Stack

| Layer               | Technology                          | Purpose                                             |
| ------------------- | ----------------------------------- | --------------------------------------------------- |
| Runtime             | **Node.js**                         | JavaScript runtime                                  |
| Web framework       | **Express 4**                       | Routing, middleware, HTTP handling                  |
| Database            | **Firebase Firestore** (Admin SDK)  | Document store for users, events, tickets           |
| Authentication      | **jsonwebtoken (JWT)**              | Stateless access tokens                             |
| Password hashing    | **bcryptjs**                        | Secure password storage                             |
| Rate limiting       | **express-rate-limit**              | Throttling the booking endpoint                     |
| API documentation   | **swagger-jsdoc** + **swagger-ui-express** | OpenAPI 3.0 spec generated from route annotations |
| Configuration       | **dotenv**                          | Environment-variable loading                        |
| CORS                | **cors**                            | Cross-origin resource sharing                       |
| Dev tooling         | **nodemon**, **supertest**          | Auto-reload and HTTP testing                        |

## Project Structure

```
assignment-12-event-ticketing-api/
├── config/
│   ├── firebaseConfig.js      # Firebase Admin init with graceful degradation (getDb, isFirestoreReady)
│   └── swagger.js             # OpenAPI 3.0 definition + schemas (scans routes/ & controllers/)
├── controllers/
│   ├── authController.js      # register, login, profile
│   ├── eventController.js     # list/get/create/update/delete events, list attendees
│   └── ticketController.js    # book (transactional), my-tickets, cancel (transactional)
├── middleware/
│   ├── auth.js                # JWT verification -> req.user = { id, role }
│   ├── roleGuard.js           # RBAC factory: roleGuard('Organizer'), etc.
│   ├── rateLimiter.js         # bookingLimiter: 10 req/min per IP
│   └── errorHandler.js        # centralized error handler + JSON 404 handler
├── routes/
│   ├── authRoutes.js          # /api/auth/*
│   ├── eventRoutes.js         # /api/events/*
│   └── ticketRoutes.js        # /api/tickets/*
├── utils/
│   └── helpers.js             # ok/fail responses, asyncHandler, id/ref generators, validators
├── test/
│   └── smoke.test.js          # smoke test
├── .env.example               # sample environment configuration
├── server.js                  # app entry point (middleware, routes, Swagger, health)
└── package.json
```

## Prerequisites

- **Node.js 18+** and npm
- A **Firebase project** with Firestore enabled and a **service-account key** (see [Firebase Setup](#firebase-setup))
  - Optional for a first boot: the server runs without credentials, returning `503` on database routes.

## Installation & Setup

```bash
# 1. Clone the repository
git clone https://github.com/Adityac17/Assignment_12.git
cd Assignment_12/assignment-12-event-ticketing-api

# 2. Install dependencies
npm install

# 3. Create your environment file
cp .env.example .env
# then edit .env and fill in the values (see below)
```

## Environment Variables

Copy `.env.example` to `.env` and configure:

| Variable                          | Required | Default                    | Description                                                                                          |
| --------------------------------- | -------- | -------------------------- | ---------------------------------------------------------------------------------------------------- |
| `PORT`                            | No       | `3000`                     | Port the Express server listens on.                                                                  |
| `JWT_SECRET`                      | Yes      | `dev-insecure-secret`      | Secret used to sign and verify JWT access tokens. Use a long random string in production.            |
| `JWT_EXPIRES_IN`                  | No       | `1d`                       | How long issued JWTs stay valid (e.g. `1h`, `2d`).                                                   |
| `GOOGLE_APPLICATION_CREDENTIALS`  | No\*     | `./serviceAccountKey.json` | Absolute path to a Google service-account JSON key file. If unset, the app falls back to `serviceAccountKey.json` in the project root. |

> \* Not required for the server to boot, but required for any database-backed route to work. Without valid credentials, DB routes return `503`.

## Firebase Setup

The app initializes the Firebase Admin SDK from **one of two sources**, in order:

1. **`GOOGLE_APPLICATION_CREDENTIALS`** — an absolute path to your service-account JSON key.
2. **`./serviceAccountKey.json`** — a key file placed in the project root (gitignored).

Steps:

1. In the [Firebase Console](https://console.firebase.google.com/), create (or open) a project and enable **Firestore Database**.
2. Go to **Project settings → Service accounts → Generate new private key**. This downloads a JSON key file.
3. Wire the credential in **either** way:
   - Place the file as `serviceAccountKey.json` in the project root, **or**
   - Set an absolute path in `.env`:
     ```env
     GOOGLE_APPLICATION_CREDENTIALS=/absolute/path/to/serviceAccountKey.json
     ```
4. Start the server. On success you'll see `✅ [firebase] Firestore initialized from ...`.

> **Security:** never commit `serviceAccountKey.json` or `.env`. If no credential is found, the
> server still starts and logs a clear warning; DB routes then return `503` until it is configured.

## Running the Application

```bash
# Development (auto-reload via nodemon)
npm run dev

# Production
npm start

# Smoke test
npm test
```

Once running:

- API base URL: `http://localhost:3000`
- Health check: `GET http://localhost:3000/`
- Swagger UI: `http://localhost:3000/api-docs`

## API Reference

Base URL: `http://localhost:3000`. All responses use the envelope `{ success, message, data? }`.
Protected routes require an `Authorization: Bearer <token>` header.

### Authentication — `/api/auth`

| Method | Endpoint             | Auth / Role   | Description                                                        |
| ------ | -------------------- | ------------- | ----------------------------------------------------------------- |
| `POST` | `/api/auth/register` | Public        | Register a new user with role `Organizer` or `Attendee`.          |
| `POST` | `/api/auth/login`    | Public        | Log in and receive a signed JWT plus basic user info.             |
| `GET`  | `/api/auth/profile`  | Authenticated | Fetch the current authenticated user's profile.                   |

### Events — `/api/events`

| Method   | Endpoint                     | Auth / Role         | Description                                                                                       |
| -------- | ---------------------------- | ------------------- | ------------------------------------------------------------------------------------------------ |
| `GET`    | `/api/events`                | Public              | List upcoming events (sorted by date). Optional filters: `category` (exact), `city` / `venue` (case-insensitive substring on venue). |
| `GET`    | `/api/events/:id`            | Public              | Get a single event by id.                                                                         |
| `POST`   | `/api/events`                | Organizer           | Create a new event.                                                                               |
| `PUT`    | `/api/events/:id`            | Organizer (owner)   | Update an event you organize. Capacity cannot drop below tickets already sold.                    |
| `DELETE` | `/api/events/:id`            | Organizer (owner)   | Cancel (delete) an event you organize.                                                            |
| `GET`    | `/api/events/:id/attendees`  | Organizer (owner)   | List confirmed attendees for an event you organize.                                               |

### Tickets — `/api/tickets`

| Method | Endpoint                    | Auth / Role                 | Description                                                                              |
| ------ | --------------------------- | --------------------------- | --------------------------------------------------------------------------------------- |
| `POST` | `/api/tickets/book`         | Attendee (rate limited)     | Book tickets for an event. Atomic; **10 requests/min per IP**. Returns `429` on exceed. |
| `GET`  | `/api/tickets/my-tickets`   | Attendee                    | List the authenticated attendee's tickets (newest first).                               |
| `POST` | `/api/tickets/:id/cancel`   | Attendee (owner)            | Cancel your own ticket; inventory is restored to the event atomically.                   |

### System

| Method | Endpoint          | Auth / Role | Description                                              |
| ------ | ----------------- | ----------- | ------------------------------------------------------- |
| `GET`  | `/`               | Public      | Health/root — reports Firestore status and doc links.   |
| `GET`  | `/api-docs`       | Public      | Interactive Swagger UI.                                 |
| `GET`  | `/api-docs.json`  | Public      | Raw OpenAPI 3.0 JSON spec.                              |

## Roles & Permissions

There are two roles, chosen at registration. `auth` verifies the JWT and attaches
`req.user = { id, role }`; `roleGuard(...)` then enforces the allowed role per route.

| Capability                                    | Organizer | Attendee |
| --------------------------------------------- | :-------: | :------: |
| Register / log in / view own profile          |     ✅    |    ✅    |
| Browse events (list & detail)                 |     ✅    |    ✅    |
| Create events                                 |     ✅    |    ❌    |
| Update / delete **own** events                |     ✅    |    ❌    |
| View attendees of **own** events              |     ✅    |    ❌    |
| Book tickets                                   |     ❌    |    ✅    |
| View **own** tickets                           |     ❌    |    ✅    |
| Cancel **own** tickets                         |     ❌    |    ✅    |

> Ownership is enforced beyond the role check: Organizers can only modify events whose
> `organizerId` matches them, and Attendees can only cancel tickets whose `userId` matches them
> (returning `403` otherwise).

## Firestore Schema

The database uses three top-level collections. Ids are generated with short type-prefixed
tokens (e.g. `u_`, `e_`, `t_`).

### `users`

| Field          | Type   | Notes                                            |
| -------------- | ------ | ------------------------------------------------ |
| `id`           | string | Document id, e.g. `u_ab12cd34ef`.                |
| `username`     | string | Display name.                                    |
| `email`        | string | Lowercased, unique.                              |
| `passwordHash` | string | bcrypt hash (never returned in responses).       |
| `role`         | string | `Organizer` or `Attendee`.                       |
| `createdAt`    | string | ISO 8601 timestamp.                              |

### `events`

| Field              | Type    | Notes                                              |
| ------------------ | ------- | -------------------------------------------------- |
| `id`               | string  | Document id, e.g. `e_xy98zz11aa`.                  |
| `title`            | string  | Event title.                                       |
| `description`      | string  | Event description.                                 |
| `category`         | string  | Used by the `category` filter.                     |
| `eventDate`        | string  | ISO 8601; only future events appear in listings.  |
| `venue`            | string  | Used by the `city` / `venue` filter.               |
| `organizerId`      | string  | `id` of the owning Organizer.                      |
| `ticketPrice`      | number  | Price per ticket (`>= 0`).                         |
| `totalCapacity`    | integer | Total seats (`>= 1`).                              |
| `availableTickets` | integer | Remaining seats; decremented atomically on booking.|
| `createdAt`        | string  | ISO 8601 timestamp.                               |

### `tickets`

| Field           | Type    | Notes                                            |
| --------------- | ------- | ------------------------------------------------ |
| `id`            | string  | Document id, e.g. `t_qwe45678gh`.                |
| `eventId`       | string  | `id` of the booked event.                        |
| `eventTitle`    | string  | Denormalized event title at booking time.        |
| `userId`        | string  | `id` of the booking Attendee.                    |
| `attendeeName`  | string  | Name supplied at booking.                        |
| `attendeeEmail` | string  | Email supplied at booking (lowercased).          |
| `quantity`      | integer | Number of seats booked (`>= 1`).                 |
| `totalPaid`     | number  | `quantity × ticketPrice`.                        |
| `bookingRef`    | string  | Human-friendly reference, e.g. `BR-9F8A1B2C`.    |
| `status`        | string  | `confirmed` or `cancelled`.                      |
| `bookedAt`      | string  | ISO 8601 timestamp.                             |

## Rate Limiting

The booking endpoint `POST /api/tickets/book` is protected by `express-rate-limit`:

- **Limit:** 10 requests per minute, per client IP.
- **Window:** 60 seconds (fixed).
- **On exceed:** HTTP **`429`** with `{ "success": false, "message": "Too many booking requests. Please try again in a minute." }`.
- Standard `RateLimit-*` headers are emitted; legacy `X-RateLimit-*` headers are disabled.

## Concurrency & Overselling Prevention

Booking and cancellation both run inside Firestore's `db.runTransaction(...)`, which guarantees
**atomic read-modify-write** semantics:

- **Booking:** the transaction reads the event, checks `availableTickets >= quantity`, then
  decrements `availableTickets` and creates the ticket — all as one unit. If two Attendees try to
  grab the last seats simultaneously, Firestore serializes the transactions; the losing one re-runs
  against fresh data and fails with `400 Insufficient tickets` rather than overselling.
- **Cancellation:** the transaction verifies ownership and current status, then restores
  `availableTickets` (event `availableTickets + ticket.quantity`) and marks the ticket
  `cancelled` atomically — so inventory is always consistent and a ticket cannot be
  double-cancelled.

This makes inventory the single source of truth and eliminates race conditions inherent to a
naive "read, then write" approach.

## API Documentation (Swagger)

The OpenAPI 3.0 spec is generated at runtime by `swagger-jsdoc`, which scans the `@swagger`
JSDoc annotations in `routes/` (and `controllers/`).

- **Interactive UI:** [`/api-docs`](http://localhost:3000/api-docs)
- **Raw JSON spec:** [`/api-docs.json`](http://localhost:3000/api-docs.json)

To call protected endpoints from Swagger UI, click **Authorize** and paste your token as
`Bearer <token>`.

## Example Walkthrough

A full flow from registration to booking. Responses are trimmed to essentials.

### 1. Register an Organizer

```bash
curl -X POST http://localhost:3000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{"username":"jane_doe","email":"jane@example.com","password":"secret123","role":"Organizer"}'
```

```json
{
  "success": true,
  "message": "Registration successful.",
  "data": {
    "id": "u_ab12cd34ef",
    "username": "jane_doe",
    "email": "jane@example.com",
    "role": "Organizer",
    "createdAt": "2026-09-12T09:00:00.000Z"
  }
}
```

### 2. Log in (get a JWT)

```bash
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"jane@example.com","password":"secret123"}'
```

```json
{
  "success": true,
  "message": "Login successful.",
  "data": {
    "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "user": { "id": "u_ab12cd34ef", "username": "jane_doe", "email": "jane@example.com", "role": "Organizer" }
  }
}
```

### 3. Create an Event (Organizer)

```bash
curl -X POST http://localhost:3000/api/events \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <ORGANIZER_TOKEN>" \
  -d '{
    "title":"React Summit 2026",
    "description":"A day of React talks.",
    "category":"Technology",
    "eventDate":"2026-12-01T10:00:00.000Z",
    "venue":"Bengaluru Convention Center",
    "ticketPrice":499,
    "totalCapacity":500
  }'
```

```json
{
  "success": true,
  "message": "Event created.",
  "data": {
    "id": "e_xy98zz11aa",
    "title": "React Summit 2026",
    "category": "Technology",
    "venue": "Bengaluru Convention Center",
    "organizerId": "u_ab12cd34ef",
    "ticketPrice": 499,
    "totalCapacity": 500,
    "availableTickets": 500,
    "createdAt": "2026-09-12T09:05:00.000Z"
  }
}
```

### 4. Book a Ticket (Attendee)

> Register/log in a second user with `"role":"Attendee"` and use that token here.

```bash
curl -X POST http://localhost:3000/api/tickets/book \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <ATTENDEE_TOKEN>" \
  -d '{
    "eventId":"e_xy98zz11aa",
    "quantity":2,
    "attendeeName":"John Attendee",
    "attendeeEmail":"john@example.com"
  }'
```

```json
{
  "success": true,
  "message": "Ticket booked.",
  "data": {
    "id": "t_qwe45678gh",
    "eventId": "e_xy98zz11aa",
    "eventTitle": "React Summit 2026",
    "userId": "u_zz00aa11bb",
    "attendeeName": "John Attendee",
    "attendeeEmail": "john@example.com",
    "quantity": 2,
    "totalPaid": 998,
    "bookingRef": "BR-8F3A2C1D",
    "status": "confirmed",
    "bookedAt": "2026-09-12T09:10:00.000Z"
  }
}
```

The event's `availableTickets` is now `498`. Cancelling this ticket via
`POST /api/tickets/t_qwe45678gh/cancel` restores it to `500`.

## Design Choices & Notes

- **Consistent response envelope.** Every endpoint returns `{ success, message, data? }` via shared `ok()` / `fail()` helpers, so clients can parse responses uniformly.
- **Layered architecture.** Routes (with Swagger annotations) → middleware (auth, RBAC, rate limiting) → controllers (business logic) → config/utils, keeping concerns isolated and testable.
- **Stateless JWT auth.** Tokens carry only `{ id, role }`; passwords are stored as bcrypt hashes and never returned.
- **Transactional integrity.** Seat inventory is only ever mutated inside Firestore transactions, making overselling impossible and cancellations consistent.
- **Graceful degradation.** Missing Firebase credentials produce a clear warning and `503`s on DB routes instead of a crash — the rest of the app (Swagger, guards, rate limiting, 404s) keeps working.
- **Safe error handling.** A centralized handler returns generic messages for unexpected `500`s (no internal leakage) while surfacing the expected `503` for an unconfigured database.
- **Denormalized reads.** Tickets store `eventTitle` at booking time for cheap listing without extra reads.
- **Input validation.** Emails, quantities, prices and capacities are validated before any write; capacity updates are rejected if they fall below tickets already sold.

## Author

**Aditya S Chouksey**

## License

Released under the **MIT License**.
