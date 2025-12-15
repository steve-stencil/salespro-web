import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    setupFiles: ['./src/__tests__/integration/server-setup.ts'],
    include: ['src/__tests__/integration/**/*.test.ts'],
    // Run test files sequentially to share server instance
    fileParallelism: false,
    env: {
      DATABASE_URL:
        'postgresql://postgres:postgres@localhost:5433/salespro_test',
      NODE_ENV: 'test',
      PORT: '4001',
      SESSION_SECRET: 'test-session-secret-at-least-32-characters-long',
    },
    coverage: {
      provider: 'v8',
      reporter: ['text', 'lcov', 'html'],
      exclude: [
        'node_modules/',
        'dist/',
        'coverage/',
        '**/*.d.ts',
        'src/index.ts',
        'src/__tests__/',
      ],
    },
    testTimeout: 30000, // 30 seconds for integration tests
    hookTimeout: 30000,
  },
});
