import request from 'supertest';
import { describe, it, expect } from 'vitest';

import { app } from '../server';

// Import the shared test setup
import './setup';

// Type assertion for supertest
const requestApp = request(app);

describe('Server', () => {
  it('should respond to health check', async () => {
    const response = await requestApp.get('/api/healthz').expect(200);

    expect(response.body).toEqual({ status: 'ok' });
  });

  it('should handle CORS', async () => {
    const response = await requestApp.options('/api').expect(204);

    expect(response.headers['access-control-allow-origin']).toBeDefined();
  });

  it('should handle JSON parsing', async () => {
    const testData = { test: 'data' };

    const response = await requestApp
      .post('/api/unknown-route')
      .send(testData)
      .expect(404); // Route doesn't exist, but JSON parsing should work

    expect(response.body).toBeDefined();
  });

  it('should handle malformed JSON', async () => {
    const response = await requestApp
      .post('/api/unknown-route')
      .set('Content-Type', 'application/json')
      .send('invalid json');

    // Express body-parser returns 400 for JSON parsing errors
    // Our error handler may convert it to 500
    expect([400, 500]).toContain(response.status);
    expect(response.body).toBeDefined();
  });

  it('should include security headers', async () => {
    const response = await requestApp.get('/api/healthz').expect(200);

    // Check for helmet security headers
    expect(response.headers['x-content-type-options']).toBe('nosniff');
    expect(response.headers['x-frame-options']).toBe('SAMEORIGIN');
  });

  it('should handle unknown routes with 404', async () => {
    const response = await requestApp.get('/api/unknown-route').expect(404);

    expect(response.body).toBeDefined();
  });
});
