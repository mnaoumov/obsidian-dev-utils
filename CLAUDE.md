# CLAUDE.md

## Project Overview

`obsidian-dev-utils` is a TypeScript utility library for Obsidian plugin development. It publishes as a dual-format (ESM + CJS) npm package.

## Commands

All npm scripts follow the `"foo:bar": "jiti scripts/foo-bar.ts"` pattern. Each script imports its command function directly from the relevant tool module (e.g., `linters/eslint.ts`, `formatters/dprint.ts`).

- `npm test` — run tests (Vitest)
- `npm run test:coverage` — run tests with v8 coverage
- `npm run test:watch` — watch mode
- `npm run lint` — run ESLint
- `npm run lint:fix` — auto-fix lint issues
- `npm run lint:md` — lint markdown with markdownlint
- `npm run lint:md:fix` — auto-fix markdown lint issues
- `npm run format` — format with dprint
- `npm run format:check` — check formatting
- `npm run build` — full build pipeline
- `npm run build:clean` — clean build output
- `npm run build:compile:typescript` — type-check with tsc
- `npm run build:static` — copy static assets
- `npm run spellcheck` — spell check with cspell
- `npm run commit` — guided commit via Commitizen
- `npm run version` — update version

## Architecture

### Directory Structure

- `src/` — source code, organized by domain (e.g., `obsidian/`, `codemirror/`, `script-utils/`, `transformers/`)
- `__tests__/` — test files, mirrors `src/` structure
- `__mocks__/obsidian/` — mock implementations for the `obsidian` package (one file per export)
- `__mocks__/obsidian-typings/` — mock implementations for `obsidian-typings`
- `src/script-utils/bundlers/esbuild.ts` — public API for esbuild bundler (build, dev)
- `src/script-utils/bundlers/esbuild-impl/` — internal esbuild implementation details
- `src/script-utils/linters/eslint.ts` — ESLint linting
- `src/script-utils/linters/markdownlint.ts` — Markdown linting
- `src/script-utils/linters/cspell.ts` — spellchecking
- `src/script-utils/formatters/dprint.ts` — dprint formatting
- `src/script-utils/test-runners/vitest.ts` — Vitest test runner
- `scripts/` — npm script entry points (executed via `jiti`), each imports directly from the relevant tool module
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

import type { SomeType } from './some-module.ts';

import { something } from './other-module.ts';

export function myFunction(param: Type): ReturnType {
  // ...
}
```

### Naming

- Files: kebab-case (e.g., `array.ts`, `async.ts`, `value-provider.ts`)
- Directories: kebab-case (e.g., `script-utils/bundlers/esbuild-impl`, `test-runners`)
- **Exception:** `__mocks__/` files use PascalCase to mirror Obsidian API export names (e.g., `App.ts`, `Vault.ts`, `TFile.ts`)
- Functions: camelCase
- Classes: PascalCase
- Constants: UPPER_SNAKE_CASE
- Parameter-bag types: use `...Params` when the type is the **sole argument** of a function (`fn(params: FnParams)`); use `...Options` when the type is **supplementary configuration** alongside other positional args (`fn(arg1, arg2, options: FnOptions)`)

### Documentation

- Every exported function/class requires JSDoc with `@param` and `@returns` tags
- Every file requires a `@packageDocumentation` JSDoc comment at the top
- Test files and mock files are exempt from documentation requirements

### Imports

- Sorted alphabetically (enforced by `eslint-plugin-perfectionist`)
- Type imports separated from value imports (`import type` on its own line)
- Always include `.ts` extension in relative imports
- Prefer static imports over dynamic `import()` — only use dynamic imports when there is a concrete reason (lazy loading, conditional loading, circular dependency breaking)

### Code Quality

- Do NOT use the `!` non-null assertion operator — use `assertNotNullable()` from `__tests__/test-helpers.ts` in tests instead
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

- Test files: `__tests__/[module-name].test.ts` (mirrors `src/` path, kebab-case)
- Browser tests: `__tests__/[module-name].browser.test.ts` with `// @vitest-environment jsdom`
- Test helper: `__tests__/test-helpers.ts` — exports `assertNotNullable<T>()` for type-safe null assertions

### Patterns

```typescript
import {
  describe,
  expect,
  it,
  vi
} from 'vitest';

import { myFunction } from '../src/my-module.ts';

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

- Commit after each logical step. Do not batch unrelated changes into a single commit.
- Conventional Commits enforced via commitlint + husky
- Use `npm run commit` (Commitizen) for guided commit messages
- Before each commit, run these commands and ensure they complete without errors:
  - `npm run spellcheck`
  - `npm run build:compile:typescript`
  - `npm run lint:fix`
  - `npm run format`
