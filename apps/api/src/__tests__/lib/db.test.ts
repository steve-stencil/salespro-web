import { MikroORM } from '@mikro-orm/core';
import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';

import type { initORM, getORM, closeORM, getORMConfig } from '../../lib/db';

// Import the shared test setup
import '../setup';

// Module interface for dynamic import
type DbModule = {
  initORM: typeof initORM;
  getORM: typeof getORM;
  closeORM: typeof closeORM;
  getORMConfig: typeof getORMConfig;
};

// We need to import the module after setup so mocks are in place
// Reset module state between tests
let dbModule: DbModule;

describe('MikroORM Database Connection', () => {
  const mockORM = {
    close: vi.fn(),
    em: {},
  };

  beforeEach(async () => {
    vi.clearAllMocks();
    // Reset the module to clear cached orm instance
    vi.resetModules();
    // Re-import the module fresh
    dbModule = (await import('../../lib/db')) as DbModule;
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('initORM', () => {
    it('should initialize ORM when not already initialized', async () => {
      const initSpy = vi
        .spyOn(MikroORM, 'init')
        .mockResolvedValue(mockORM as unknown as MikroORM);

      const orm = await dbModule.initORM();

      expect(initSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          clientUrl: process.env['DATABASE_URL'],
          debug: false,
        }),
      );
      expect(orm).toBe(mockORM);
    });

    it('should return existing ORM instance if already initialized', async () => {
      const initSpy = vi
        .spyOn(MikroORM, 'init')
        .mockResolvedValue(mockORM as unknown as MikroORM);

      const orm1 = await dbModule.initORM();
      const orm2 = await dbModule.initORM();

      expect(initSpy).toHaveBeenCalledTimes(1);
      expect(orm1).toBe(orm2);
    });

    it('should handle initialization errors', async () => {
      const initError = new Error('Connection failed');
      const initSpy = vi.spyOn(MikroORM, 'init').mockRejectedValue(initError);

      await expect(dbModule.initORM()).rejects.toThrow('Connection failed');
      expect(initSpy).toHaveBeenCalled();
    });
  });

  describe('getORM', () => {
    it('should throw error when ORM is not initialized', () => {
      expect(() => dbModule.getORM()).toThrow(
        'ORM not initialized. Call initORM() first.',
      );
    });

    it('should return ORM instance after initialization', async () => {
      vi.spyOn(MikroORM, 'init').mockResolvedValue(
        mockORM as unknown as MikroORM,
      );

      await dbModule.initORM();
      const orm = dbModule.getORM();

      expect(orm).toBe(mockORM);
    });
  });

  describe('closeORM', () => {
    it('should close ORM connection when initialized', async () => {
      vi.spyOn(MikroORM, 'init').mockResolvedValue(
        mockORM as unknown as MikroORM,
      );

      await dbModule.initORM();
      await dbModule.closeORM();

      expect(mockORM.close).toHaveBeenCalled();
    });

    it('should not throw when closing non-initialized ORM', async () => {
      await expect(dbModule.closeORM()).resolves.not.toThrow();
    });

    it('should allow re-initialization after close', async () => {
      const initSpy = vi
        .spyOn(MikroORM, 'init')
        .mockResolvedValue(mockORM as unknown as MikroORM);

      await dbModule.initORM();
      await dbModule.closeORM();
      await dbModule.initORM();

      expect(initSpy).toHaveBeenCalledTimes(2);
    });
  });

  describe('getORMConfig', () => {
    it('should return configuration with DATABASE_URL', () => {
      const config = dbModule.getORMConfig();

      expect(config).toMatchObject({
        clientUrl: process.env['DATABASE_URL'],
        debug: false,
      });
      // Entities array contains the registered entity classes
      expect(config.entities).toBeDefined();
      expect(Array.isArray(config.entities)).toBe(true);
    });
  });
});
