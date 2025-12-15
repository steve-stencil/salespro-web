import globals from 'globals';
import reactHooks from 'eslint-plugin-react-hooks';
import reactRefresh from 'eslint-plugin-react-refresh';
import base from '../../eslint.config.mjs';

export default [
  // Inherit shared monorepo rules (type-aware, strict, import-x, etc.)
  ...base,
  // App-specific ignores
  { ignores: ['dist', 'playwright-report'] },
  // Browser globals and React-specific rules
  {
    files: ['**/*.{ts,tsx}'],
    languageOptions: {
      ecmaVersion: 2020,
      globals: globals.browser,
    },
  },
  // E2E test files - Playwright specific configuration
  {
    files: ['e2e/**/*.{ts,tsx}'],
    languageOptions: {
      ecmaVersion: 2020,
      globals: {
        ...globals.browser,
        ...globals.node,
      },
      parserOptions: {
        project: './tsconfig.app.json',
      },
    },
  },
  reactHooks.configs['recommended-latest'],
  reactRefresh.configs.vite,
];
