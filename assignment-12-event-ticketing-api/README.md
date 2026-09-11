# Event Management & Ticketing API

A backend REST API for managing events and booking tickets, built with
**Node.js + Express** and **Firebase Firestore** (via `firebase-admin`).

- **Organizers** create, update, cancel events and view attendees.
- **Attendees** browse events, book tickets, view their tickets, and cancel them.
- **JWT** auth with **role-based** authorization (`Organizer` / `Attendee`).
- **Atomic** ticket booking/cancellation using Firestore transactions
  (`db.runTransaction`) to prevent overselling under concurrent load.
- **Rate limiting** (10 req/min) on the ticket-booking route.
- **Swagger UI** documentation for every endpoint.

---

## Tech Stack

Express, firebase-admin (Firestore), jsonwebtoken, bcryptjs, express-rate-limit,
swagger-ui-express, swagger-jsdoc, dotenv, cors. Dev: nodemon, supertest.

## Project Structure

```
assignment-12-event-ticketing-api/
├── config/
│   ├── firebaseConfig.js   # firebase-admin init with graceful degradation
│   └── swagger.js          # OpenAPI 3.0 spec (swagger-jsdoc)
├── controllers/
│   ├── authController.js
│   ├── eventController.js
│   └── ticketController.js
├── middleware/
│   ├── auth.js             # verifies Bearer JWT -> req.user = { id, role }
│   ├── roleGuard.js        # role-based access control (403 on mismatch)
│   ├── rateLimiter.js      # 10/min limiter for /api/tickets/book
│   └── errorHandler.js     # centralized error + 404 handlers
├── routes/
│   ├── authRoutes.js
│   ├── eventRoutes.js
│   └── ticketRoutes.js
├── utils/
│   └── helpers.js          # response envelope, async wrapper, id/ref, validators
├── test/
│   └── smoke.test.js       # non-DB smoke tests (supertest)
├── server.js               # app entry point
├── .env.example
├── .gitignore
└── package.json
```

---

## Getting Started

### 1. Install dependencies

```bash
cd assignment-12-event-ticketing-api
npm install
```

### 2. Configure environment

```bash
cp .env.example .env
```

| Variable                         | Description                                              | Default            |
| -------------------------------- | ------------------------------------------------------- | ------------------ |
| `PORT`                           | Port the server listens on                              | `3000`             |
| `JWT_SECRET`                     | Secret used to sign/verify JWTs                         | (required)         |
| `JWT_EXPIRES_IN`                 | Token lifetime (e.g. `1h`, `2d`)                        | `1d`               |
| `GOOGLE_APPLICATION_CREDENTIALS` | Absolute path to your service-account JSON (see below)  | _(optional)_       |

### 3. Run

```bash
npm run dev      # nodemon (auto-reload)
# or
npm start        # node server.js
```

- Swagger UI: <http://localhost:3000/api-docs>
- Raw OpenAPI JSON: <http://localhost:3000/api-docs.json>
- Health/root: <http://localhost:3000/>

---

## Firebase Setup

This project talks to Firestore through the real `firebase-admin` SDK — there
are **no mocks**. Because a live Firebase project may not be available, the app
**degrades gracefully**: if no credentials are found it prints a clear warning,
still boots, and any route that touches Firestore returns a clean **HTTP 503**
(instead of crashing). Non-DB behaviour (Swagger, auth guards, rate limiting,
404s) keeps working.

To run against a real Firestore database:

1. In the [Firebase Console](https://console.firebase.google.com/), create a
   project and enable **Cloud Firestore**.
2. Go to **Project Settings → Service accounts → Generate new private key**.
   This downloads a JSON key file.
3. Provide the key to the app in **either** of these ways:
   - **Option A (recommended):** set the absolute path in `.env`:
     ```
     GOOGLE_APPLICATION_CREDENTIALS=/absolute/path/to/serviceAccountKey.json
     ```
   - **Option B:** place the file at the project root as
     `serviceAccountKey.json` (the app auto-detects it).
4. Restart the server. You should see
   `✅ [firebase] Firestore initialized ...` in the logs.

> ⚠️ **Never commit credentials.** Both `.env` and `serviceAccountKey.json` are
> gitignored. Each developer supplies their own key file.

Firestore collections (`events`, `tickets`, `users`) are created automatically
on first write — no schema migration step is required.

---

## Data Model (Firestore Collections)

**events**: `id, title, description, category, eventDate, venue, organizerId,
ticketPrice, totalCapacity, availableTickets, createdAt`

**tickets**: `id, eventId, eventTitle, userId, attendeeName, attendeeEmail,
quantity, totalPaid, bookingRef, status (confirmed|cancelled), bookedAt`

**users**: `id, username, email, passwordHash, role (Organizer|Attendee),
createdAt`

---

## API Endpoints

All responses use a consistent envelope: `{ success: boolean, message: string, data?: any }`.

### Auth

| Method | Path                 | Access    | Description                                  |
| ------ | -------------------- | --------- | -------------------------------------------- |
| POST   | `/api/auth/register` | Public    | Register as `Organizer` or `Attendee`        |
| POST   | `/api/auth/login`    | Public    | Log in, returns JWT `{ id, role }`           |
| GET    | `/api/auth/profile`  | Protected | Current user profile (without `passwordHash`)|

### Events

| Method | Path                        | Access                | Description                                        |
| ------ | --------------------------- | --------------------- | -------------------------------------------------- |
| GET    | `/api/events`               | Public                | Upcoming events; `?category=` & `?city=`/`?venue=` |
| GET    | `/api/events/:id`           | Public                | Event details incl. `availableTickets`             |
| POST   | `/api/events`               | Organizer             | Create event (`availableTickets = totalCapacity`)  |
| PUT    | `/api/events/:id`           | Organizer (owner)     | Update event                                       |
| DELETE | `/api/events/:id`           | Organizer (owner)     | Cancel/delete event                                |
| GET    | `/api/events/:id/attendees` | Organizer (owner)     | List attendees (from confirmed tickets)            |

### Tickets

| Method | Path                       | Access             | Description                                          |
| ------ | -------------------------- | ------------------ | --------------------------------------------------- |
| POST   | `/api/tickets/book`        | Attendee (10/min)  | Book tickets atomically (429 when rate limited)     |
| GET    | `/api/tickets/my-tickets`  | Attendee           | List the caller's own tickets                       |
| POST   | `/api/tickets/:id/cancel`  | Attendee (owner)   | Cancel a ticket, atomically restore availability    |

### HTTP status codes

`200` OK · `201` Created · `400` Validation / insufficient tickets · `401`
Unauthenticated · `403` Wrong role or not owner · `404` Not found · `429` Rate
limited · `500` Server error · `503` Firestore unavailable.

---

## Authentication Flow

1. `POST /api/auth/register` with `role`.
2. `POST /api/auth/login` → returns `data.token`.
3. Send `Authorization: Bearer <token>` on protected routes. In Swagger UI use
   the **Authorize** button (bearerAuth scheme).

---

## Testing

```bash
npm test
```

The smoke test uses **supertest** and requires **no live Firebase**. It verifies:

- Swagger UI at `/api-docs` and raw spec at `/api-docs.json`
- 404 responses use the standard JSON shape
- protected route returns `401` without a token
- role guard returns `403` for a valid token with the wrong role
- the booking rate limiter returns `429` after 10 rapid requests (the limiter
  runs before the handler, so it is exercised without a database)

---

## Design Choices

Because the task said to make reasonable choices and document them:

- **Graceful Firebase degradation.** `config/firebaseConfig.js` never crashes on
  a missing key. It exports `getDb()` which throws a tagged `503` error that the
  centralized handler turns into a clean JSON response. This lets the server
  boot and all non-DB behaviour be tested without credentials.
- **Rate limiter placed before auth** on `/api/tickets/book`, so abusive
  traffic is rejected with `429` before any auth/DB work — and so the limit can
  be verified without a token or database.
- **IDs generated in-app** (`crypto.randomBytes`) with type prefixes
  (`u_`, `e_`, `t_`) and a human-friendly `BR-XXXXXXXX` booking reference,
  rather than relying on Firestore auto-ids, so responses are self-describing.
- **`eventDate` stored as ISO-8601 strings.** ISO strings sort/compare
  lexicographically, which makes the "upcoming events" `where('eventDate','>=',now)`
  query straightforward without extra Timestamp handling.
- **Venue/city filter is a case-insensitive substring** applied in memory. A
  single `venue` field holds the location; `?city=` is treated as an alias so
  either query param works.
- **Atomic transactions** for booking and cancellation. Booking re-reads
  `availableTickets` inside the transaction and rejects with `400 "Insufficient
  tickets"` if capacity is gone, preventing overselling under concurrency.
  Cancellation restores capacity and rejects double-cancellation.
- **`totalCapacity` updates preserve sold tickets.** When an organizer changes
  capacity, `availableTickets` is adjusted by the same delta and the update is
  rejected if the new capacity is below tickets already sold.
- **Password hashing** with bcryptjs (salt rounds = 10); `passwordHash` is never
  returned by any endpoint.
- **JWT payload is minimal** (`{ id, role }`) — enough for authz without leaking
  profile data; profile is fetched fresh from Firestore when needed.
- **`utils/helpers.js`** centralizes the `{ success, message, data }` envelope,
  an `asyncHandler` wrapper (so controller throws reach the error handler), id
  generation and validators — keeping controllers focused on logic.

---

## Notes

- Swagger UI is interactive at `/api-docs`; each developer adds their own
  `serviceAccountKey.json` (or `GOOGLE_APPLICATION_CREDENTIALS`) to run against a
  real database — see **Firebase Setup**.
- No real credentials are committed to this repository.

## License

MIT
