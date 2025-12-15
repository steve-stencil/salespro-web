import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    setupFiles: ['./src/__tests__/setup.ts'],
    exclude: [
      'node_modules/',
      'dist/',
      'src/__tests__/integration/**', // Exclude integration tests from unit test run
    ],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'lcov', 'html'],
      exclude: [
        'node_modules/',
        'dist/',
        'coverage/',
        '**/*.d.ts',
        'src/index.ts',
        // Route handlers are tested via integration tests
        'src/routes/**/*.routes.ts',
        // Index files are just re-exports
        '**/index.ts',
        // Middleware is tested via integration tests
        'src/lib/session/middleware.ts',
        'src/middleware/**',
        // Migrations
        'src/migrations/**',
      ],
    },
  },
});
