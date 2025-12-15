import {
  Entity,
  PrimaryKey,
  Property,
  ManyToOne,
  Index,
} from '@mikro-orm/core';
import { v4 as uuid } from 'uuid';

import type { User } from './User.entity';

/**
 * Password history entity for preventing password reuse.
 * Stores hashed versions of previous passwords.
 */
@Entity()
@Index({ properties: ['user'] })
@Index({ properties: ['createdAt'] })
export class PasswordHistory {
  @PrimaryKey({ type: 'uuid' })
  id: string = uuid();

  @ManyToOne('User')
  user!: User;

  /** Hashed password for comparison */
  @Property({ type: 'string', hidden: true })
  passwordHash!: string;

  @Property({ type: 'Date' })
  createdAt: Date = new Date();
}
