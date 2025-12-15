import { LoginEvent } from '../../entities';

import type { User, LoginEventType, SessionSource } from '../../entities';
import type { EntityManager } from '@mikro-orm/core';

/**
 * Log a login-related event for audit purposes
 */
export async function logLoginEvent(
  em: EntityManager,
  user: User,
  eventType: LoginEventType,
  params: {
    ipAddress: string;
    userAgent: string;
    source: SessionSource;
    metadata?: Record<string, unknown>;
  },
): Promise<void> {
  const event = new LoginEvent();
  event.user = user;
  event.email = user.email;
  event.eventType = eventType;
  event.ipAddress = params.ipAddress;
  event.userAgent = params.userAgent;
  event.source = params.source;
  if (params.metadata) {
    event.metadata = params.metadata;
  }

  em.persist(event);
  await em.flush();
}
