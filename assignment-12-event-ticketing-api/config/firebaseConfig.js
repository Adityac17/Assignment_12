/**
 * Firebase Admin initialization with graceful degradation.
 *
 * We initialize firebase-admin from EITHER:
 *   1. GOOGLE_APPLICATION_CREDENTIALS  -> absolute path to a service-account JSON, or
 *   2. ./serviceAccountKey.json        -> a gitignored key file in the project root.
 *
 * If NO valid credential is found, we DO NOT crash. Instead we log a clear,
 * friendly warning and export `db = null`. Route handlers detect this via
 * `isFirestoreReady()` / `getDb()` and return a clean 503 error, so the server
 * still boots and non-DB behaviour (Swagger, auth guards, rate limiting, 404s)
 * keeps working — which is exactly what we need in an environment without a
 * live Firebase project.
 */

const fs = require('fs');
const path = require('path');
const admin = require('firebase-admin');

let db = null;
let firestoreReady = false;
let initError = null;

function resolveCredential() {
  // 1. Explicit env var path
  const envPath = process.env.GOOGLE_APPLICATION_CREDENTIALS;
  if (envPath && envPath.trim() && fs.existsSync(envPath.trim())) {
    return envPath.trim();
  }

  // 2. Conventional local file
  const localPath = path.join(__dirname, '..', 'serviceAccountKey.json');
  if (fs.existsSync(localPath)) {
    return localPath;
  }

  return null;
}

function initFirebase() {
  if (admin.apps.length > 0) {
    // Already initialized (e.g. hot reload) — reuse.
    db = admin.firestore();
    firestoreReady = true;
    return;
  }

  const credPath = resolveCredential();

  if (!credPath) {
    initError =
      'No Firebase credentials found. Set GOOGLE_APPLICATION_CREDENTIALS ' +
      'to your service-account JSON path, or place serviceAccountKey.json in ' +
      'the project root.';
    console.warn(
      '\n⚠️  [firebase] ' +
        initError +
        '\n⚠️  [firebase] The server will start, but any route that ' +
        'touches Firestore will return HTTP 503 until credentials are provided.\n'
    );
    return;
  }

  try {
    const serviceAccount = JSON.parse(fs.readFileSync(credPath, 'utf8'));
    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
    });
    db = admin.firestore();
    firestoreReady = true;
    console.log(`✅ [firebase] Firestore initialized from ${credPath}`);
  } catch (err) {
    initError = `Failed to initialize Firebase Admin: ${err.message}`;
    console.warn(
      `\n⚠️  [firebase] ${initError}` +
        '\n⚠️  [firebase] The server will start, but Firestore routes ' +
        'will return HTTP 503.\n'
    );
  }
}

initFirebase();

/** @returns {boolean} whether Firestore is available for queries. */
function isFirestoreReady() {
  return firestoreReady;
}

/**
 * Returns the Firestore instance, or throws a tagged error the global handler
 * translates into a clean 503 response.
 */
function getDb() {
  if (!firestoreReady || !db) {
    const err = new Error(
      'Database unavailable: Firebase Admin is not configured. ' +
        (initError || '')
    );
    err.statusCode = 503;
    err.isFirebaseUnavailable = true;
    throw err;
  }
  return db;
}

module.exports = {
  admin,
  getDb,
  isFirestoreReady,
  // Exposed mainly for diagnostics / health checks.
  getInitError: () => initError,
};
