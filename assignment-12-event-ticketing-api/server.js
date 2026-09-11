/**
 * Event Management & Ticketing API — application entry point.
 */

require('dotenv').config();

const express = require('express');
const cors = require('cors');
const swaggerUi = require('swagger-ui-express');

const swaggerSpec = require('./config/swagger');
const { isFirestoreReady, getInitError } = require('./config/firebaseConfig');

const authRoutes = require('./routes/authRoutes');
const eventRoutes = require('./routes/eventRoutes');
const ticketRoutes = require('./routes/ticketRoutes');
const { notFoundHandler, errorHandler } = require('./middleware/errorHandler');

const app = express();

// --- Global middleware ---
app.use(cors());
app.use(express.json());

// --- Health / root ---
app.get('/', (req, res) => {
  res.json({
    success: true,
    message: 'Event Management & Ticketing API is running.',
    data: {
      docs: '/api-docs',
      openapi: '/api-docs.json',
      firestore: isFirestoreReady() ? 'connected' : 'unavailable',
      firestoreNote: isFirestoreReady() ? undefined : getInitError(),
    },
  });
});

// --- Swagger UI + raw spec ---
app.get('/api-docs.json', (req, res) => {
  res.setHeader('Content-Type', 'application/json');
  res.send(swaggerSpec);
});
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec));

// --- API routes ---
app.use('/api/auth', authRoutes);
app.use('/api/events', eventRoutes);
app.use('/api/tickets', ticketRoutes);

// --- 404 + centralized error handler (must be last) ---
app.use(notFoundHandler);
app.use(errorHandler);

// Export the app for testing; only listen when run directly.
const PORT = process.env.PORT || 3000;
if (require.main === module) {
  app.listen(PORT, () => {
    console.log(`🚀 Server listening on http://localhost:${PORT}`);
    console.log(`📘 Swagger UI:   http://localhost:${PORT}/api-docs`);
    if (!isFirestoreReady()) {
      console.log(
        'ℹ️  Running WITHOUT Firestore — DB routes will return 503 ' +
          'until credentials are configured (see README > Firebase Setup).'
      );
    }
  });
}

module.exports = app;
