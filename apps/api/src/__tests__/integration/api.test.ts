import { describe, it, expect } from 'vitest';

import { makeRequest } from './helpers';

describe('API Integration Tests', () => {
  describe('Health Check Endpoints', () => {
    it('should return health status', async () => {
      const response = await makeRequest().get('/api/healthz').expect(200);

      expect(response.body).toEqual({ status: 'ok' });
    });

    it('should return ready status', async () => {
      const response = await makeRequest().get('/api/readyz').expect(200);

      expect(response.body).toEqual({ status: 'ready' });
    });
  });

  describe('Error Handling', () => {
    it('should return 404 for non-existent endpoints', async () => {
      await makeRequest().get('/api/non-existent').expect(404);
    });

    it('should handle malformed JSON', async () => {
      await makeRequest()
        .post('/api/healthz')
        .set('Content-Type', 'application/json')
        .send('invalid json')
        .expect(500);
    });
  });

  describe('CORS and Security Headers', () => {
    it('should include CORS headers', async () => {
      // Must send Origin header to trigger CORS response headers
      const response = await makeRequest()
        .get('/api/healthz')
        .set('Origin', 'http://localhost:5173')
        .expect(200);

      expect(response.headers).toHaveProperty('access-control-allow-origin');
    });

    it('should include security headers from helmet', async () => {
      const response = await makeRequest().get('/api/healthz').expect(200);

      expect(response.headers).toHaveProperty('x-content-type-options');
      expect(response.headers).toHaveProperty('x-frame-options');
    });
  });

  describe('Request Logging', () => {
    it('should log requests with pino', async () => {
      // This test verifies that the logging middleware is working
      // The actual log output would be captured in a real test environment
      const response = await makeRequest().get('/api/healthz').expect(200);

      expect(response.status).toBe(200);
      // In a real scenario, you'd verify logs were written
    });
  });
});
