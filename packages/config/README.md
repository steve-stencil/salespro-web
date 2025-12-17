# @config

## Purpose

This package contains shared configuration files for the monorepo, including ESLint, Prettier, and TypeScript base configurations. It provides consistent tooling configuration across all workspace packages.

## Structure

```
packages/config/
├── eslint/
│   └── base.cjs          # Base ESLint configuration
├── prettier/
│   └── base.json         # Base Prettier configuration
├── tsconfig.base.json    # Base TypeScript configuration
└── package.json
```

## Configuration Files

### ESLint (`eslint/base.cjs`)

Base ESLint configuration extended by all packages:

```javascript
// In apps/api/eslint.config.mjs
import baseConfig from '@config/eslint/base.cjs';

export default [
  ...baseConfig,
  // App-specific overrides
];
```

**Features:**

- TypeScript support with strict type checking
- ESLint recommended rules
- No `any` type allowed
- Import ordering rules
- React rules (for web app)

### Prettier (`prettier/base.json`)

Shared Prettier configuration:

```json
// In .prettierrc.json at package root
{
  "extends": "@config/prettier/base.json"
}
```

**Settings:**

- Single quotes
- Trailing commas
- 2-space indentation
- 100 character line width

### TypeScript (`tsconfig.base.json`)

Base TypeScript configuration extended by all packages:

```json
// In apps/api/tsconfig.json
{
  "extends": "../../packages/config/tsconfig.base.json",
  "compilerOptions": {
    "outDir": "./dist",
    "rootDir": "./src"
  },
  "include": ["src/**/*"]
}
```

**Key Settings:**

- Strict mode enabled
- ES2022 target
- Module resolution: bundler
- No implicit any
- Strict null checks
- Verbatim module syntax

## Usage

### Extending ESLint Config

```javascript
// eslint.config.mjs
import baseConfig from '../../packages/config/eslint/base.cjs';

export default [
  ...baseConfig,
  {
    // Package-specific rules
    rules: {
      // Override or add rules
    },
  },
];
```

### Extending TypeScript Config

```json
{
  "extends": "../../packages/config/tsconfig.base.json",
  "compilerOptions": {
    // Package-specific options
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules", "dist"]
}
```

### Using Prettier Config

Create a `.prettierrc.json` that extends the base:

```json
{
  "extends": "@config/prettier/base.json"
}
```

Or reference directly in the root `.prettierrc.json`.

## Modifying Configurations

### Adding a New ESLint Rule

1. Add the rule to `eslint/base.cjs`
2. Run `pnpm lint` across the monorepo to check impact
3. Fix any new violations or add targeted ignores
4. Document the rule's purpose

### Updating TypeScript Settings

1. Modify `tsconfig.base.json`
2. Run `pnpm typecheck` across the monorepo
3. Address any type errors introduced
4. Document breaking changes

### Updating Prettier Settings

1. Modify `prettier/base.json`
2. Run `pnpm format` to apply changes
3. Commit formatting changes separately

## Best Practices

### Do

- Keep base configurations minimal and strict
- Allow package-specific overrides when necessary
- Document any non-obvious configuration choices
- Test configuration changes across all packages

### Don't

- Add package-specific rules to base configs
- Disable strict TypeScript options
- Allow `any` types without explicit justification
- Change formatting rules frequently

## Related

- [ESLint Documentation](https://eslint.org/docs)
- [Prettier Documentation](https://prettier.io/docs)
- [TypeScript Documentation](https://www.typescriptlang.org/docs)
- [Root eslint.config.mjs](../../eslint.config.mjs)
- [Root .prettierrc.json](../../.prettierrc.json)
- [Root tsconfig.base.json](../../tsconfig.base.json)
