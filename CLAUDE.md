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
- `npm run build:templates` — copy consumer templates
- `npm run spellcheck` — spell check with cspell
- `npm run commit` — guided commit via Commitizen
- `npm run version` — update version

## Architecture

### Directory Structure

- `src/` — source code and tests, organized by domain (e.g., `obsidian/`, `codemirror/`, `script-utils/`, `transformers/`)
- `src/test-helpers/` — test helper utilities (mock implementations, vault helpers, mocks)
- `src/test-helpers/mocks/obsidian-typings/` — mock augmentations for `obsidian-typings` (hooks into obsidian-test-mocks constructors)
- `src/script-utils/bundlers/esbuild.ts` — public API for esbuild bundler (build, dev)
- `src/script-utils/bundlers/esbuild-impl/` — internal esbuild implementation details
- `src/script-utils/linters/eslint.ts` — ESLint linting
- `src/script-utils/linters/markdownlint.ts` — Markdown linting
- `src/script-utils/linters/cspell.ts` — spellchecking
- `src/script-utils/formatters/dprint.ts` — dprint formatting
- `src/script-utils/test-runners/vitest.ts` — Vitest test runner
- `scripts/` — npm script entry points (executed via `jiti`), each wraps its call in `wrapCliTask()` for error handling and exit codes
- `templates/` — consumer-facing templates copied verbatim into `dist/templates/` by `build:templates` (so they ship in the package, copyable from `node_modules/obsidian-dev-utils/dist/templates`). A trailing `.template` on a source file name is stripped during the copy (e.g. `templates/eslint.config.mts.template` → `dist/templates/eslint.config.mts`), so an active config template can live in the repo under a name the corresponding tool does not auto-discover (only `eslint.config.mts` currently needs this — ESLint treats any `eslint.config.*` as a flat config). Two kinds of file live here:
  - Root config templates (`templates/commitlint.config.ts`, `templates/eslint.config.mts.template`, `templates/vitest.config.ts`, `templates/.markdownlint-cli2.mjs`, `templates/.nano-staged.mjs`, `templates/dprint.json`) — thin re-exports a consumer drops at their project root.
  - `templates/scripts/` — the script entry points a consumer drops in their `scripts/` folder. This holds both the per-tool example scripts grouped by category (`bundlers/`, `formatters/`, `linters/`, `test-runners/`, `build/`, `version/`) and the flat `*-config.ts` logic files that the root config templates re-export (`commitlint-config.ts`, `eslint-config.ts`, `vitest-config.ts`, `markdownlint-cli2-config.ts`, `nano-staged-config.ts`).
  - `templates/` is kept self-contained: every root config template resolves to a real `templates/scripts/*-config.ts`, so the imports never dangle. `commitlint-config`/`markdownlint-cli2-config`/`nano-staged-config` are pure re-exports (identical for every plugin); `eslint-config`/`vitest-config` are generic baselines a consumer customizes.
- `src/script-utils/commitlint-config.ts` — shared commitlint configuration
- `src/script-utils/nano-staged-config.ts` — shared nano-staged pre-commit configuration
- `dist/` — compiled output (ESM `.mjs` + CJS `.cjs` + type declarations)

### TypeScript

- Extends `@tsconfig/strictest` — very strict settings
- Target: 2022, Module: node16 (The minimum Obsidian installer version that still receives app updates is 0.14.5, which uses electron 18.0.3, which uses Node 16.13.2, which corresponds to ES2022)
- `allowImportingTsExtensions: true` — always use `.ts` extension in imports

### Build

- esbuild for bundling (ESM + CJS dual output)
- `src/**/index.ts` files are auto-generated — do NOT edit them manually
- `package.json` exports are auto-generated via `build:generate-exports`

### Type Validation (manual `skipLibCheck` wrapper)

`tsconfig.json` sets `skipLibCheck: true`. This is a deliberate exception to the usual "never
weaken `@tsconfig/strictest`" stance: it lets `tsc` type-check our `.ts` files without failing on
broken upstream `.d.ts` files we do not control (e.g. a given version's `obsidian.d.ts`, which has
shipped `HistoryHandler`/`PromiseWithResolvers` type errors).

The declarations we author (`src/@types/**`, `src/obsidian/@types/dataview/**`) are still fully
validated. `buildCompileTypeScript()` (run by `build:compile:typescript`) does two passes:

1. `tsc --build --force` — the normal compile, with `skipLibCheck: true`.
2. An in-memory re-check via `checkProjectTypes()` (`src/script-utils/check-project-types.ts`) with
   `skipLibCheck: false`, reporting **only** diagnostics whose source file is under the project root
   and outside `node_modules`. It prints `Ignored N diagnostic(s) outside the validated set.` —
   when upstream is fixed and `N` reaches `0`, the workaround is no longer doing anything and
   `skipLibCheck` can go back to `false`.

`checkProjectTypes()` / `parseTsConfig()` / `toCanonical()` are exported as a reusable primitive, so
consuming plugins inherit the same resilience through the shared `buildCompileTypeScript()`.

## Code Conventions

### File Structure

Every source file follows this pattern:

```typescript
/**
 * @file
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

- Directories: kebab-case (e.g., `script-utils/bundlers/esbuild-impl`, `test-runners`)
- **Exception:** `src/test-helpers/mocks/` files use PascalCase to mirror Obsidian API export names (e.g., `App.ts`, `Vault.ts`, `TFile.ts`)
- **Exception:** `constructors/` files use camelCase matching the exported function name (e.g., `getDomEventsHandlersConstructor.ts`), mirroring the `obsidian-typings` Constructors convention

### Documentation

- Every exported function/class requires JSDoc with `@param` and `@returns` tags
- Every file requires a `@file` JSDoc comment at the top
- Test files and mock files are exempt from documentation requirements

### Imports

- Sorted alphabetically (enforced by `eslint-plugin-perfectionist`)
- Always include `.ts` extension in relative imports

### Code Quality

- Use `assertNonNullable()` from `src/type-guards.ts` in tests instead of `!`
- Custom ESLint rule `obsidian-dev-utils/no-unused-params-members` flags `*Params`/`*Options` interface members never read by the receiving function; spreading, rest-destructuring, forwarding, returning, or storing the whole object counts as using all members.

## Rules

### L1. Overriding deprecated upstream methods

- When this library overrides a method whose ancestor declaration carries a `@deprecated` JSDoc tag (e.g., Obsidian's `SettingTab.display()` is deprecated as of 1.13.0), the override semantically clears the deprecation but the `@typescript-eslint/no-deprecated` rule still fires on every call site. This is because the rule reads JSDoc tags via TypeScript's `getJsDocTags(checker)`, which walks the inheritance chain.
- Resolution: add `// eslint-disable-next-line @typescript-eslint/no-deprecated -- <reason>` at the call site, or a file-level `/* eslint-disable @typescript-eslint/no-deprecated -- <reason> */` with a matching `/* eslint-enable ... -- <reason> */` when the same call appears throughout a file (paired enable + description are required by `@eslint-community/eslint-comments`).
- Do not remove the `override` keyword or omit the override JSDoc to work around the rule. Keep the override explicit and disable the rule where the deprecated symbol is unavoidably referenced.
- (cannot be forced by ESLint — describes how to interact with an existing ESLint rule)

### L2. Timing primitives must be fake-timer controllable

- Delay/timeout primitives (e.g. `sleep`, `abortSignalTimeout`, `setTimeoutAsync`) must be built on `window.setTimeout`, never on the native `AbortSignal.timeout`. Vitest fake timers patch `setTimeout` but not `AbortSignal.timeout` (it owns an internal timer they cannot advance), so a primitive built on `AbortSignal.timeout` runs in real wall-clock time even under `vi.useFakeTimers()` — making it and everything layered on it non-deterministic and slow to test.
- This applies transitively: any helper that awaits a delay (like `sleep` awaiting `abortSignalTimeout`) inherits the (un)controllability of the underlying timer, so the requirement is on the lowest-level primitive.
- When reimplementing a native timing primitive this way, mirror the native abort reason so consumers see identical behavior: `abortSignalTimeout` aborts with a `DOMException` named `TimeoutError` (as native `AbortSignal.timeout` does), not a plain `Error`.
- (cannot be forced by ESLint — a custom `no-restricted-syntax` selector could flag `AbortSignal.timeout` usage in `src/`)

## Testing

### Goals

- The project aims for 100% test coverage. Every new or changed code path must be covered by tests.
- Currently unit tests only; full E2E Obsidian Electron tests are planned for the next phase.

### Test setup

- Consumers wire the library's per-test setup into their suites via three endpoints, mirroring
  `obsidian-test-mocks`'s naming: `obsidian-dev-utils/setup` (framework-agnostic
  `setup({ beforeEach, afterEach })`), `obsidian-dev-utils/vitest-setup`, and
  `obsidian-dev-utils/jest-setup`.
  Before each test the setup resets the shared-state bag on `globalThis.__obsidianDevUtils` (so
  accumulated state does not leak between tests) and enables async-operation tracking; after each test
  it disables tracking, so tests can `await waitForAllAsyncOperations()` against isolated state. The
  Vitest/Jest files are thin setup-file glue (v8-ignored) over the unit-tested agnostic core. The
  top-level `setup.ts` and all `*-setup.ts` files are excluded from the auto-generated barrels (see
  `scripts/build-generate-index.ts`) so a production `import 'obsidian-dev-utils'` never pulls in
  `vitest`/`@jest/globals`.

### Framework

- Vitest with explicit imports (globals: false) — always import `describe`, `it`, `expect`, etc. from `'vitest'`
- Test environment: `node` by default; use `// @vitest-environment jsdom` directive for browser tests
- Coverage provider: v8

### File Conventions

- Test files: `src/[module-name].test.ts` (next to source file, kebab-case)
- Browser tests: `src/[module-name].browser.test.ts` with `// @vitest-environment jsdom`
- Test helpers: `src/test-helpers/` — mock utilities (`mock-implementation.ts`)

### Patterns

```typescript
import {
  describe,
  expect,
  it,
  vi
} from 'vitest';

import { myFunction } from './my-module.ts';

describe('MyModule', () => {
  it('should do something', () => {
    expect(myFunction(input)).toBe(expected);
  });
});
```

### Mocking

- `obsidian` module is aliased to `obsidian-test-mocks/obsidian` via Vitest config (runtime only)
- Import convention in test files:
  - Real types: `import type { App as AppOriginal } from 'obsidian'` — use `Original` suffix
  - Mock classes: `import { App } from 'obsidian-test-mocks/obsidian'` — use original name, no alias
  - Do NOT use `Mock` prefix aliases (enforced by ESLint `no-restricted-syntax`)
- For mock-specific APIs (`create__`, `createConfigured__`, etc.), import from `'obsidian-test-mocks/obsidian'` directly
- Use `vi.fn()` for mock functions, `vi.useFakeTimers()`/`vi.useRealTimers()` for timer mocking
- Use `vi.stubGlobal()` / `vi.unstubAllGlobals()` for global stubs

### Integration test timing

- Obsidian integration tests (`*.obsidian.integration.test.ts`) share a single Obsidian instance
  via the global setup. Never gate on a fixed `setTimeout`/sleep wait — it passes in isolation but
  flakes under full-suite load, because the shared instance is slower when the unit suites run
  concurrently. Wait on a readiness signal instead.
- For metadata-cache-dependent assertions, `await ensureMetadataCacheReady(app)` after mutating the
  vault — it awaits `onCleanCache` and is unbounded, so it waits exactly as long as needed.
  `getBacklinksForFileSafe` already calls it internally, but inside a *bounded* retry that can time
  out under load, so call it explicitly first.
- When there is no readiness event to await, poll with `retryWithTimeout` (bounded) rather than a
  single frame or fixed delay — e.g. `getDomEventsHandlersConstructor` retries until the constructor
  is intercepted instead of asserting after one `requestAnimationFrame`.
- Inside `evalInObsidian` callbacks, library helpers are reachable via
  `window.__obsidianDevUtilsModule__` (e.g. `lib.obsidian['metadata-cache'].ensureMetadataCacheReady`),
  **not** via the test file's imports — the callback is serialized and runs in the Obsidian process.

## Dependencies

### Pinned versions

| Package | Version | Reason |
| --- | --- | --- |
| `@codemirror/state` | `6.5.0` | `obsidian` peer dependency |
| `@codemirror/view` | `6.38.6` | `obsidian` peer dependency |
| `@lezer/common` | `1.2.3` | `obsidian` uses this version at runtime |
| `@types/node` | `25.0.3` | Matches the Node.js version used in the project |

## Consumer Script Pattern

Consumer projects import functions from `obsidian-dev-utils` and wrap them with `wrapCliTask()`:

```typescript
// scripts/build.ts
import { wrapCliTask } from 'obsidian-dev-utils/script-utils/cli-utils';
import { build } from 'obsidian-dev-utils/script-utils/bundlers/esbuild';

await wrapCliTask(() => build());
```

For scripts needing argv:

```typescript
// scripts/version.ts
import process from 'node:process';
import { wrapCliTask } from 'obsidian-dev-utils/script-utils/cli-utils';
import { updateVersion } from 'obsidian-dev-utils/script-utils/version';

const [, , versionUpdateType] = process.argv;
await wrapCliTask(() => updateVersion(versionUpdateType));
```

Config scripts re-export shared configs:

```typescript
// scripts/commitlint-config.ts
import { obsidianDevUtilsConfig } from 'obsidian-dev-utils/script-utils/commitlint-config';
export const config = obsidianDevUtilsConfig;
```

The nano-staged config script calls `getNanoStagedConfig()` (not a bare re-export) so the pre-commit
checks honor the `NANO_STAGED=0` `.env` opt-out:

```typescript
// scripts/nano-staged-config.ts
import { getNanoStagedConfig } from 'obsidian-dev-utils/script-utils/nano-staged-config';
export const config = getNanoStagedConfig();
```

Every root config template under `templates/` (`commitlint.config.ts`, `eslint.config.mts.template`,
`vitest.config.ts`, `.markdownlint-cli2.mjs`, `.nano-staged.mjs`) is a thin re-export of a matching
`templates/scripts/*-config.ts`, which ships alongside it — so the copied templates resolve without
hand-writing the `scripts/*-config.ts` logic file. See `templates/scripts/` for the full set of consumer
examples.

## Current Task — Make minimized modal bar fully clickable (advanced-note-composer issue #121)

Tracking feature request `https://github.com/mnaoumov/obsidian-advanced-note-composer/issues/121`
("Make entire split box clickable"). The "split box" is the minimized-modal bar rendered by
`MinimizableModal` HERE — when the plugin's Split-file dialog is minimized it collapses to a small
floating bar, and only the restore icon was clickable. Root cause and fix are 100% in dev-utils; the
plugin's `open-minimizable-modal.ts` only wraps `MinimizableModal`. Continue the work from THIS repo.

### Changes made (implemented, unit-covered)

- `src/obsidian/modals/minimizable-modal.ts` — `createMinimizedBar()` attaches the `click → restore()`
  listener to the whole `barEl`, not just the restore button. The button's own click bubbles up;
  `restore()` guards against the double invocation (no-op). Restore button kept as a visual affordance.
- `src/styles/minimizable-modal.scss` — `.minimized-modal-bar` gets `cursor: pointer` + a bar-level
  `:hover` background so the whole box reads as clickable.
- `src/obsidian/modals/minimizable-modal.test.ts` — two failing-first tests added (click the bar body,
  click the title); red before the fix, green after. Full file 18/18; tsc + eslint clean.

### Remaining steps

- ~~Confirm REAL behavior (R2 G10r)~~ ✅ DONE — added a real-Obsidian integration test
  (`minimizable-modal.obsidian.integration.test.ts` → `describe('restore')`) that opens + minimizes a real
  `MinimizableModal` and dispatches genuine DOM `click` events on the minimized bar body and its title,
  asserting the modal restores and the bar is removed. Passes in the harness (real Obsidian drives the
  real `addEventListener`, unlike the unit mocks).
- Ship a dev-utils patch release; advanced-note-composer then bumps the `obsidian-dev-utils` dep. NEEDS
  user go-ahead (irreversible).
- Close issue #121 (public-facing — draft in chat, get approval before posting).

Conventions: strict TS, 100% unit coverage, R1/R2, failing-test-first (R2 G10r) + confirm REAL behavior.

## Current Task — Fix minimized modal bar transparent on hover (advanced-note-composer issue #124)

Tracking bug report `https://github.com/mnaoumov/obsidian-advanced-note-composer/issues/124`
("Transparent Button"). Diagnosed from the plugin repo; the fix belongs 100% here. **Continue this work
from a session started in THIS repo.**

Root cause — this is a **regression from the #121 work above**: #121 added a bar-level `:hover`
background to `.minimized-modal-bar` so the whole box reads as clickable. That hover value is the
translucent `--background-modifier-hover` (measured `rgba(0, 0, 0, 0.067)` in real Obsidian 1.12.7
default theme), which *replaces* the bar's opaque resting `--background-secondary`
(`rgb(246, 246, 246)`). So on hover the bar goes ~93% see-through and the editor content behind it (the
plugin's "Split file" minimized bar sits over a split editor full of text) bleeds through, making the
title unreadable. `src/styles/minimizable-modal.scss:57-59`.

NOTE: the #121 "Current Task" section above appears stale (G58) — its hover code is already shipped in
the dev-utils version the plugin depends on (that is how #124 manifests at plugin 3.30.0). Flag for
review while here.

### Proposed fix (to implement)

- `src/styles/minimizable-modal.scss` — in `.minimized-modal-bar:hover`, layer the translucent hover
  tint over the opaque base instead of replacing the background:
  `background-image: linear-gradient(var(--background-modifier-hover), var(--background-modifier-hover))`.
  The base rule's `background: var(--background-secondary)` (opaque `background-color`) stays untouched,
  so the composited result is opaque while keeping the subtle hover highlight. Leave the inner
  `.minimize-button` / `.restore-button` hovers as-is — they sit on an opaque parent, so their
  translucent tint is correct there.

### Diagnosis findings (already gathered)

- Empirically confirmed the premise in real Obsidian 1.12.7 via CDP: `--background-modifier-hover` =
  `rgba(0, 0, 0, 0.067)` (translucent → the bug), `--background-secondary` = `rgb(246, 246, 246)`
  (opaque → the layered fix keeps the bar opaque).
- CSS-only change; no visual-regression harness exists. Optionally add a jsdom browser test asserting
  the hover rule sets a `background-image` gradient rather than a bare translucent `background-color`.

### Steps

1. ~~Apply the SCSS fix; `npm run build:styles`.~~ ✅ DONE — `.minimized-modal-bar:hover` now uses
   `background-image: linear-gradient(var(--background-modifier-hover), var(--background-modifier-hover))`,
   layered over the untouched opaque `background: var(--background-secondary)`. Compiled `dist/styles.css`
   confirmed to carry the gradient. No unit test added — SCSS is not part of coverage and there is no
   established SCSS-unit-test pattern here (matches how #121 shipped); premise already confirmed via CDP.
2. ~~Confirm REAL behavior (R2 G10r)~~ ✅ premise confirmed via CDP earlier (translucent
   `--background-modifier-hover` vs opaque `--background-secondary`); the layered-gradient result is opaque
   by construction. Visual check over a busy editor still worth a glance when the plugin bumps the dep.
3. ~~Full pre-commit gate (spellcheck / compile / lint / format), commit on a fix branch.~~ ✅ DONE — on
   branch `fix/minimized-modal-bar-transparent-hover`; spellcheck 0 issues (added `rgba` to `cspell.json`),
   `tsc` clean, `eslint --fix` + `dprint fmt` clean.
4. Ship a dev-utils patch release; then advanced-note-composer bumps the `obsidian-dev-utils` dep and
   releases (irreversible, public-facing — get go-ahead). ⏳ PENDING user go-ahead.
5. Close issue #124 (public-facing — draft in chat, get approval before posting). ⏳ PENDING.

### Real-hover regression test — deferred, BLOCKED on a harness helper (cross-repo)

No unit/jsdom test can catch this bug: jsdom cannot resolve CSS `var()` or composite backgrounds, and
`:hover` is a pointer **state** that can't be `dispatchEvent`-triggered. A real-Obsidian integration
test needs a **trusted pointer move** to set a genuine `:hover` — the analog of the harness's
`typeIntoEditor` trusted keypress — which the harness does NOT yet expose (its `evalInObsidian`
callbacks get only `app` / `obsidianModule` / `typeIntoEditor`).

Decision: add a `hoverElement({ element })` helper to `obsidian-integration-testing` (planned in THAT
repo's `CLAUDE.md` → "Current Task", per the cross-repo workflow — the user drives it from a session
started there). Once it ships and this repo bumps the dep, add a **red-first** integration test to
`src/obsidian/modals/minimizable-modal.obsidian.integration.test.ts`: open + minimize a real
`MinimizableModal`, `await hoverElement({ element: barEl })`, then assert
`getComputedStyle(barEl).backgroundColor` alpha === 1 (opaque). Verify it goes red against the pre-fix
translucent `background` before finalizing. Until the helper lands, the CSS fix is confirmed only by
the earlier CDP premise check (opaque `--background-secondary` vs translucent
`--background-modifier-hover`) — no automated regression guard exists yet.

## Known Issues

- None currently.

## Commits

- Conventional Commits enforced via commitlint + husky (commit-msg hook)
- nano-staged runs spellcheck, compilation, lint, and format on staged files via husky pre-commit hook
  - Opt out per-developer by setting `NANO_STAGED=0` (or `false`/`off`/`no`) in a gitignored `.env`
    (cross-platform, mirrors husky's own `HUSKY=0`); the `.env` is read by `getNanoStagedConfig()` in
    `src/script-utils/nano-staged-config.ts`, which the thin `scripts/nano-staged-config.ts` entry calls.
    The commit-msg/commitlint hook still runs.
- Use `npm run commit` (Commitizen) for guided commit messages
- Before each commit, run these commands and ensure they complete without errors:
  - `npm run spellcheck`
  - `npm run build:compile:typescript`
  - `npm run lint:fix`
  - `npm run format`
