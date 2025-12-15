import session from 'express-session';

import { getSessionOptions } from '../../config/session';
import { getORM } from '../db';

import { MikroOrmStore } from './MikroOrmStore';

import type { RequestHandler } from 'express';

let sessionMiddleware: RequestHandler | null = null;
let sessionStore: MikroOrmStore | null = null;

/**
 * Initialize and get the session middleware.
 * Must be called after ORM is initialized.
 */
export function getSessionMiddleware(): RequestHandler {
  if (sessionMiddleware) {
    return sessionMiddleware;
  }

  const orm = getORM();
  const em = orm.em;

  // Create the MikroORM session store
  sessionStore = new MikroOrmStore({
    em,
    lazyCleanup: true,
    cleanupOnInit: true,
    cleanupInterval: 15 * 60 * 1000, // 15 minutes
  });

  // Create session middleware with our store
  const options = getSessionOptions();
  sessionMiddleware = session({
    ...options,
    store: sessionStore,
  });

  return sessionMiddleware;
}

/**
 * Get the session store instance for direct access
 * (e.g., for manual cleanup or session queries)
 */
export function getSessionStore(): MikroOrmStore | null {
  return sessionStore;
}

/**
 * Cleanup session resources (call on server shutdown)
 */
export function cleanupSessionResources(): void {
  if (sessionStore) {
    sessionStore.stopCleanup();
  }
}
