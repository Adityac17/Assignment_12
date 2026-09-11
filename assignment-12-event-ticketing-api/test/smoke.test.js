/**
 * Lightweight smoke test — exercises non-DB behaviour with supertest.
 *
 * Verifies, WITHOUT any live Firebase credentials:
 *   1. Swagger UI is served at /api-docs and the raw spec at /api-docs.json
 *   2. Unknown routes return the standard 404 JSON shape
 *   3. Protected route returns 401 without a token
 *   4. Role guard returns 403 for a valid token with the wrong role
 *   5. The /api/tickets/book rate limiter returns 429 after 10 requests
 *      (the limiter runs before auth/handler, so no DB is needed).
 *
 * Run with: npm test
 */

process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-secret';

const assert = require('assert');
const request = require('supertest');
const jwt = require('jsonwebtoken');
const app = require('../server');

let passed = 0;
let failed = 0;

async function test(name, fn) {
  try {
    await fn();
    console.log(`  ✅ ${name}`);
    passed += 1;
  } catch (err) {
    console.error(`  ❌ ${name}\n     ${err.message}`);
    failed += 1;
  }
}

(async () => {
  console.log('\nRunning smoke tests (no live Firebase required)...\n');

  await test('Swagger UI served at /api-docs', async () => {
    const res = await request(app).get('/api-docs/').redirects(1);
    assert.strictEqual(res.status, 200);
    assert.ok(/swagger/i.test(res.text), 'expected Swagger UI HTML');
  });

  await test('Raw OpenAPI spec served at /api-docs.json', async () => {
    const res = await request(app).get('/api-docs.json');
    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.body.openapi, '3.0.0');
    assert.ok(res.body.paths && Object.keys(res.body.paths).length > 0);
  });

  await test('Unknown route returns 404 in standard shape', async () => {
    const res = await request(app).get('/no/such/route');
    assert.strictEqual(res.status, 404);
    assert.strictEqual(res.body.success, false);
    assert.ok(typeof res.body.message === 'string');
  });

  await test('Protected route returns 401 without token', async () => {
    const res = await request(app).get('/api/auth/profile');
    assert.strictEqual(res.status, 401);
    assert.strictEqual(res.body.success, false);
  });

  await test('Role guard returns 403 for wrong role', async () => {
    // Attendee token hitting an Organizer-only route.
    const token = jwt.sign(
      { id: 'u_test', role: 'Attendee' },
      process.env.JWT_SECRET
    );
    const res = await request(app)
      .post('/api/events')
      .set('Authorization', `Bearer ${token}`)
      .send({ title: 'x' });
    assert.strictEqual(res.status, 403);
    assert.strictEqual(res.body.success, false);
  });

  await test('Rate limiter returns 429 after 10 booking requests', async () => {
    // Fire 11 rapid requests from the same client. The limiter (10/min) runs
    // before auth, so the 11th must be 429 regardless of DB/token.
    let last;
    for (let i = 0; i < 11; i += 1) {
      // eslint-disable-next-line no-await-in-loop
      last = await request(app)
        .post('/api/tickets/book')
        .send({});
    }
    assert.strictEqual(last.status, 429, `expected 429, got ${last.status}`);
    assert.strictEqual(last.body.success, false);
  });

  console.log(`\n${passed} passed, ${failed} failed.\n`);
  process.exit(failed === 0 ? 0 : 1);
})();
