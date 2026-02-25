# CLAUDE.md

## Project Overview

`obsidian-dev-utils` is a TypeScript utility library for Obsidian plugin development. It publishes as a dual-format (ESM + CJS) npm package.

## Commands

- `npm test` — run tests (Vitest)
- `npm run test:coverage` — run tests with v8 coverage
- `npm run test:watch` — watch mode
- `npm run lint` — run ESLint
- `npm run lint:fix` — auto-fix lint issues
- `npm run format` — format with dprint
- `npm run format:check` — check formatting
- `npm run build` — full build pipeline
- `npm run spellcheck` — spell check with cspell

## Architecture

### Directory Structure

- `src/` — source code, organized by domain (e.g., `obsidian/`, `codemirror/`, `ScriptUtils/`, `Transformers/`)
- `__tests__/` — test files, mirrors `src/` structure
- `__mocks__/obsidian/` — mock implementations for the `obsidian` package (one file per export)
- `__mocks__/obsidian-typings/` — mock implementations for `obsidian-typings`
- `scripts/` — build scripts (executed via `jiti`)
- `dist/` — compiled output (ESM `.mjs` + CJS `.cjs` + type declarations)

### TypeScript

- Extends `@tsconfig/strictest` — very strict settings
- Target: ES2024, Module: NodeNext
- `verbatimModuleSyntax: true` — use explicit `import type` for type-only imports
- `allowImportingTsExtensions: true` — always use `.ts` extension in imports

### Build

- esbuild for bundling (ESM + CJS dual output)
- `src/**/index.ts` files are auto-generated — do NOT edit them manually
- `package.json` exports are auto-generated via `build:generate-exports`

## Code Conventions

### File Structure

Every source file follows this pattern:

```typescript
/**
 * @packageDocumentation
 *
 * Brief description of module purpose.
 */

import type { SomeType } from './SomeModule.ts';

import { something } from './OtherModule.ts';

export function myFunction(param: Type): ReturnType {
  // ...
}
```

### Naming

- Files: PascalCase (e.g., `Array.ts`, `Async.ts`, `ValueProvider.ts`)
- Functions: camelCase
- Classes: PascalCase
- Constants: UPPER_SNAKE_CASE

### Documentation

- Every exported function/class requires JSDoc with `@param` and `@returns` tags
- Every file requires a `@packageDocumentation` JSDoc comment at the top
- Test files and mock files are exempt from documentation requirements

### Imports

- Sorted alphabetically (enforced by `eslint-plugin-perfectionist`)
- Type imports separated from value imports (`import type` on its own line)
- Always include `.ts` extension in relative imports

### Code Quality

- Do NOT use the `!` non-null assertion operator — use `assertNotNullable()` from `__tests__/TestHelpers.ts` in tests instead
- No default exports (except config files like `eslint.config.mts`)
- v8 coverage ignore: use block form only (`/* v8 ignore start -- explanation. */` ... `/* v8 ignore stop */`). The single-line `/* v8 ignore next */` does NOT work in this project. The `start` comment MUST include a mandatory explanation ending with a dot, e.g., `/* v8 ignore start -- this is a type guard. */`.

## Testing

### Goals

- The project aims for 100% test coverage. Every new or changed code path must be covered by tests.
- Currently unit tests only; full E2E Obsidian Electron tests are planned for the next phase.
- Every test must include at least one explicit assertion (e.g. `expect(...)`) that directly matches the test name/intent. Avoid tests that only rely on “not throwing” without an `expect`.

### Framework

- Vitest with explicit imports (globals: false) — always import `describe`, `it`, `expect`, etc. from `'vitest'`
- Test environment: `node` by default; use `// @vitest-environment jsdom` directive for browser tests
- Coverage provider: v8

### File Conventions

- Test files: `__tests__/[ModuleName].test.ts` (mirrors `src/` path)
- Browser tests: `__tests__/[ModuleName].browser.test.ts` with `// @vitest-environment jsdom`
- Test helper: `__tests__/TestHelpers.ts` — exports `assertNotNullable<T>()` for type-safe null assertions

### Patterns

```typescript
import {
  describe,
  expect,
  it,
  vi
} from 'vitest';

import { myFunction } from '../src/MyModule.ts';

describe('MyModule', () => {
  it('should do something', () => {
    expect(myFunction(input)).toBe(expected);
  });
});
```

### Mocking

- `obsidian` module is aliased to `__mocks__/obsidian/index.ts` via Vitest config
- Mock structure: one file per Obsidian export in `__mocks__/obsidian/` (e.g., `App.ts`, `Vault.ts`, `Plugin.ts`)
- Use `vi.fn()` for mock functions, `vi.useFakeTimers()`/`vi.useRealTimers()` for timer mocking
- Use `vi.stubGlobal()` / `vi.unstubAllGlobals()` for global stubs

## Commits

- Conventional Commits enforced via commitlint + husky
- Use `npm run commit` (Commitizen) for guided commit messages
- Before each commit, run these commands and ensure they complete without errors:
  - `npm run spellcheck`
  - `npm run build:compile:typescript`
  - `npm run lint:fix`
  - `npm run format`
