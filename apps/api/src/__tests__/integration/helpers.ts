import request from 'supertest';

import { getORM } from '../../lib/db';

import { getTestServer } from './server-setup';

// Re-export all auth test helpers for convenience
export * from './auth-test-helpers';

export const getTestApp = () => {
  const { server } = getTestServer();
  return server;
};

export const makeRequest = () => {
  const { baseUrl } = getTestServer();
  return request(baseUrl);
};

export const waitForDatabase = async (maxAttempts = 10): Promise<void> => {
  for (let i = 0; i < maxAttempts; i++) {
    try {
      const orm = getORM();
      // Test connection by running a simple query
      await orm.em.getConnection().execute('SELECT 1');
      return;
    } catch {
      await new Promise(resolve => setTimeout(resolve, 100));
    }
  }

  throw new Error('Database connection timeout');
};
