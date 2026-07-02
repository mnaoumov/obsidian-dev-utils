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

## Current Task — Resource locking + transactional rollback (dev-utils half)

Building the dev-utils primitives that let a consumer plugin (advanced-note-composer) lock the
files/folders an operation touches against **edit + delete + rename + move** (files, and entire folder
**subtrees**), **detect** external/sync changes and abort, and **fully roll back** on cancel/error. Full
approved plan (both repos): `~/.claude/plans/rustling-gliding-stearns.md`.

Prevention model: monkey-patch the vault mutation methods to block locked paths (via
`MonkeyAroundComponent`), plus vault-event detection as a backstop → abort. Owner-vs-intruder: the
operation arms an "expected mutation" token synchronously immediately before each vault call; the patch
allows only armed matches; the detector reconciles events and aborts on any unarmed change.

Dev-utils phases (plugin phases 5–8 are driven from the plugin repo later):

1. **`src/obsidian/vault-transaction.ts` — `VaultTransaction`** ✅ DONE (impl + 100% unit suite +
   real-Obsidian integration test all green; NOT yet committed/released).
   Reversible log: `rename`/`create`/`createFolder`/`modify`/`process`/`trash` (+ `commit`/`rollback`/
   `[Symbol.asyncDispose]`), built on the `*Safe` wrappers. **Soft-delete redesign (user-directed):**
   `trash` moves the resource into a **dot-prefixed, untracked** staging folder
   (`.obsidian-dev-utils-temp`) so Obsidian's file-tree + watcher ignore it (no metadata/file-explorer/
   sync churn in flight). Because `vault.*` is blind to dot-paths, ALL staging I/O goes through
   `app.vault.adapter` (`mkdir`/`rename`/`exists`/`trashSystem`/`trashLocal`/`rmdir`) — NOT `vault.rename`.
   A folder moves its whole subtree in one adapter rename → cheap faithful subtree rollback; `commit`
   trashes staged for real, `rollback` moves them back. `process` dead-branch removed (a missing file
   throws in the inner `process` before the guard, so the pre-image is always non-null → `assertNonNullable`).
   Consequences carried to later phases: the transaction's correctness rests on the adapter + in-memory
   staged-path list, NOT Obsidian's tree (which reflects the change asynchronously via the watcher); and
   **phase 3's detector must treat transaction-owned soft-deletes as armed/expected** (the watcher still
   fires `vault.on('delete'|'create')` for the original path even though the adapter move bypassed
   `vault.*`). No owner session yet (added in phase 4); `process` currently passes `editorLockComponent:
   null` (no lock wiring until phase 4).
2. **`ResourceLockManager` blocking layer.**
   - **2a ✅ DONE (committed `acaf203b`, not released).** Subtree-aware locking added additively to
     `EditorPathLockManager`: `mode:'file'|'subtree'` option, `isLockedByAncestorForPath`, deepest-ancestor
     owner resolution; a note inside a `subtree`-locked folder is made read-only and its
     indicators/tooltip/unlock menu resolve to the folder lock. Existing 'file'-mode behavior unchanged
     (every new query reduces to the old exact-match when no subtree locks exist). 100% unit + real-Obsidian
     integration test.
   - **Storage refactor ✅ DONE (committed `6ee96234`).** Unified the parallel count maps into one
     `Map<path, LockEntry[]>` (each entry carries `pluginId`/`mode`/`blocksMutations`/`abortController`);
     behavior-preserving foundation for the blocker + owner session. (User approved redesigning the
     component.)
   - **2b ✅ DONE (committed `c56456b1`, not released).** Opt-in vault-mutation blocker. A lock taken with
     `shouldBlockMutations: true` rejects edit/delete/rename/move/create of the covered path(s) —
     subtree-aware — via a lazily-installed `MonkeyAroundComponent` patching Vault (`append`/`copy`/`create`/
     `createBinary`/`createFolder`/`delete`/`modify`/`modifyBinary`/`process`/`rename`/`trash`) + FileManager
     (`renameFile`/`trashFile`), throwing the new exported `ResourceLockedError`. Rename/copy check source +
     dest; patch torn down when the last blocking lock releases. **Gating decision (implemented):** blocking
     is OPT-IN per lock — read-only editor locks never block writes, so shipped consumers are unaffected
     (no owner-arming yet; that is phase 4). 100% unit (real MonkeyAroundComponent patching the real
     test-mocks prototypes) + real-Obsidian integration (blocks vault rename + fileManager trash, allows
     after unlock).
3. **External-change detection backstop** — extend the lock's events component to listen to
   `vault.on('rename'|'delete'|'create')` + `metadataCache.on('deleted')`; an event on a locked path with
   no matching armed mutation → `requestUnlock(path)` → aborts the owning operation → rollback.
   **⚠ Interdependency (confirmed while building 2b):** phase 3 needs phase 4's arming to be safe. For a
   `shouldBlockMutations` lock the owner currently cannot mutate the path at all, so any event is an
   intruder — BUT the phase-1 `VaultTransaction` soft-delete moves resources via `adapter.rename`, which
   bypasses the patched `vault.*` yet still fires the watcher's `vault.on('delete'|'create')` for the
   original path. Without arming, the detector would mistake the owner's own soft-delete for an intruder and
   abort it. So **do phase 4 (arming) together with / before phase 3**, or gate the detector to only-armed
   reconciliation. Revisit the plan's 3-before-4 ordering.
4. **`ResourceLockComponent` + owner session.**
   - **Owner mutation-bypass core ✅ DONE (committed `f505ed87` as one-shot arming, then superseded by
     `41df62eb`; not released).** After weighing one-shot arming vs. an ambient scope, the user chose an
     **ambient bypass scope** (simpler; auto-covers compound `*Safe` ops without enumerating internal calls,
     and the same set doubles as the phase-3 "expected vs intruder" filter):
     `EditorLockComponent.bypassBlockedMutations(pathsOrFiles): Disposable`. While the returned Disposable is
     live, the owner's own mutations of those paths (subtree-aware via `isChildOrSelf` — bypassing a folder
     covers its subtree) pass the blocker; everything else stays blocked. The blocker's `shouldBlockMutation`
     = blocked-by-ancestor AND not covered by any active bypass set. 100% unit + real-Obsidian integration
     (a modify passes inside the scope, is rejected once it ends).
     **Residual (accepted):** the scope is ambient, so during an `await` inside it a *concurrent* mutation of a
     bypassed path would also pass — but those paths are locked by this op (editor read-only), so the only
     leak is external sync during the window, caught by the mtime pre/post-check. The phase-3 detector will
     also filter on the bypass set.
   - **NEXT — use the bypass in `VaultTransaction`.** Wrap each op's own `*Safe`/`vault.*` mutations in
     `using _bypass = component.bypassBlockedMutations([...the paths this op touches...])`. Because the scope
     is ambient, this cleanly covers the **compound** `*Safe` calls (e.g. `renameSafe` → `createFolderSafe`
     dest parent → `fileManager.renameFile`) that one-shot arming made awkward — declare the op's path set
     (source, dest, dest-parent, staging) once. `trash`/`commit` use the adapter (bypass the patch) → no
     bypass needed. VaultTransaction will take the lock component + the paths so it can open the scope.
     Phase 3 will abort the owning op via the lock's `abortController` (already on `lockForPath({abortController})`).
   - **Deferred to release-coordination — the breaking rename** `EditorLockComponent` →
     `ResourceLockComponent` (**no back-compat shim**; update `PluginBase`'s field + the free-function
     wrappers `lock/unlock/is/requestEditorUnlockForPath` + all consumers), and the public
     `lockResource`/`unlockResource`/`isResourceLocked(ByAncestor)` facade names. Naming only — the behavior
     already exists on `EditorLockComponent` (`lockForPath({mode, shouldBlockMutations})`,
     `isLockedByAncestorForPath`, `isMutationBlockedByAncestorForPath`, `createOwnerSession`). Sequence with
     the major bump + consumer migration.

Conventions: strict TS, 100% unit coverage, R2/R1 rules, dev-utils integration harness
(`*.obsidian.integration.test.ts` via `window.__obsidianDevUtilsModule__`). Ship dev-utils release(s) as
phases land; the plugin then bumps the dep.

**Progress: phase 1, phase 2, and the phase-4 owner-session arming core are complete (unreleased local
commits on `main`, not pushed).** NEXT: integrate arming into `VaultTransaction` (see the ⚠ design-care note),
then phase 3's detector (which reuses the session's `abortController`), then the deferred breaking rename with
the release.

## Completed — dev-build live-enable + integration library styles

Two independent fixes that also landed on `refactor/restore-agnostic-core-boundary` (so they ride the
pending major; not released):

- **`npm run dev` owns a reused CDP Obsidian instance.** The dev-build live-enable broke when
  `obsidian-integration-testing` 5.x retired the CLI transport — `enableCommunityPlugin` called
  `evalInObsidian` with no transport, so it hit `fetch('/json')` and threw on every rebuild.
  `copy-to-obsidian-plugins-folder-plugin.ts` now launches ONE owned instance
  (`createTransportFromOptions()` + `transport.registerVault()`) on the first rebuild, caches/reuses
  it, and `disposeSync`s it on `process` `exit`/`SIGINT`/`SIGTERM`/`SIGHUP`. Live-enable is best-effort
  (the plugin still enables via `community-plugins.json` + hot-reload; failures log quietly via
  `getLibDebugger`). The owned instance uses an isolated temp `--user-data-dir` but opens the REAL
  configured vault — revisit if it should reuse the user's real profile.
- **Integration tests inject the library CSS.** The harness plugin only exposes the module on `window`
  (it never runs `initPluginContext`), so the library styles were absent from the shared instance. A
  new `obsidian-integration-tests` setup file (`scripts/integration-test-obsidian-setup.ts`) reads the
  already-built `dist/styles.css` (build is assumed to have run beforehand) and injects it into the
  instance once per test file (idempotent, keyed by a `<style>` id). Covered by
  `library-styles.obsidian.integration.test.ts`.

## Completed — Restore the agnostic-core ⊥ Obsidian-layer boundary

DONE on branch `refactor/restore-agnostic-core-boundary` (NOT merged/published). Breaking refactor;
the lib is mid-major (82.x), so the major bump + consumer migration come afterward.

- **Prong A** — replaced the ambient `pluginId` (a capability backdoor) with a single deterministic
  `Library` init entry point on `src/library.ts`: `Library.init({ cssClassScope, debugPrefixNamespace,
  shouldPrintStackTrace })` (throws if called twice) and `Library.resetToDefault()` (re-allows init).
  `debug.ts` is fully agnostic (no `src/obsidian/` imports) and reads `Library` getters;
  `addPluginCssClasses` reads `Library.cssClassScope`. `initPluginContext` calls `Library.init`;
  `PluginContextComponent` resets it on unload (reload safety); `setup.ts` resets it per test.
  `EditorLockComponent` and the free `lockEditorForPath`/`unlockEditorForPath` now take an explicit
  `pluginId`. Deleted `plugin-id.ts` (`getPluginId`/`setPluginId`/`NO_PLUGIN_ID_INITIALIZED`). (`refactor!`)
- **Prong B** — removed the Obsidian-runtime dependency from `blob.ts` (standard
  `document.createElement`/`atob`); moved `css-class.ts` → `src/obsidian/css-class.ts`; extracted the
  build-substituted `LIBRARY_VERSION`/`LIBRARY_STYLES` into `src/generated-during-build.ts` (and updated
  the `scripts/version.ts` release substitution to target it).
- **Prong B (html-element)** — rather than moving the Obsidian-coupled `html-element` helpers into the
  Obsidian layer, they were **reimplemented to be Obsidian-runtime-agnostic** and kept at the top level
  (`src/html-element.ts`): `create{Div,El,Span,Fragment,Svg}Async`, `ensureLoaded`/`isLoaded`,
  `onAncestorScrollOrResize`, `waitUntilConnected`. The Obsidian-injected DOM behavior they relied on is
  ported from `obsidian.asar/enhance.js` to standard DOM — `createEl`/`createSvg`/`createFragment` (a
  partial `DomElementInfo` port: `cls`/`text`/`attr`/`title`/`parent`/`prepend`), `instanceOf`
  (cross-realm via `node.ownerDocument.defaultView`), `activeDocument`/`activeWindow` (via
  `ownerDocument`/`defaultView`), and `onNodeInserted` (via a `MutationObserver`). Only `appendCodeBlock`
  stays in the Obsidian layer (`src/obsidian/html-element.ts`) — it hardcodes Obsidian's
  `markdown-rendered` rendered-markdown CSS class (now `CssClass.MarkdownRendered`/`CssClass.Code`).
- **Revalidation trigger:** the `src/html-element.ts` helpers are a PARTIAL port of
  `obsidian.asar/enhance.js`. Whenever the `obsidian-versions` project gets a new Obsidian release, diff
  that release's `enhance.js` against this port (`createEl`/`createDiv`/`createSpan`/`createSvg`/
  `createFragment`, `Node.prototype.instanceOf`, `Element.prototype.setText`/`setAttrs`,
  `onNodeInserted`) and re-migrate any behavioral change. The port intentionally omits the
  element-type-specific `createEl` fields (`value`/`type`/`placeholder`/`href`) and `on*` handlers —
  extend it if a consumer needs them.
- **Prong C** — `no-restricted-imports` rule banning `./obsidian/**` from the agnostic top-level
  `src/*.ts` modules (excluding the barrel + test files), wired into obsidian-dev-utils' own ESLint
  config (NOT the shared consumer config). Pattern is unit-tested in
  `src/script-utils/linters/eslint-agnostic-core-boundary.test.ts`.
- **Verified** — full unit gate green (compile + `test:coverage` 100% + lint + format + spellcheck);
  full `npm run build` exit 0; `npm run test:integration` green (42 tests in real Obsidian — validates
  the moves, the editor-lock A4 signature, and the injected library styles at runtime).

**Deferred hardening (NOT done):** the plan also wanted `integration-test-plugin/main.ts` upgraded from
`extends Plugin` to a `PluginBase` subclass so `initPluginContext` runs in the harness, plus
`evalInObsidian` assertions that `getLibDebugger` carries the `<pluginId>:` prefix and
`addPluginCssClasses` applies the scope class, and explicit harness coverage of the relocated
`html-element` helpers. The `PluginBase` upgrade was attempted but the harness plugin **fails to load**
in the harness's minimal owned Obsidian vault (`AggregateError` from a child component; reverted to keep
the suite green). The `Library` injection is already unit-covered by `plugin.test.ts` (real
`PluginBase.onload` → real `initPluginContext` → `Library.init`). Picking this up needs separate
diagnosis of why a bare `PluginBase` subclass fails to load in the owned-instance harness.

**Remaining (handed off):** merge + publish the new major via the release tool (irreversible — needs
explicit go-ahead), then migrate the consuming plugins. Public import paths changed:
`obsidian-dev-utils/css-class` → `.../obsidian/css-class`, and `appendCodeBlock` moved from
`obsidian-dev-utils/html-element` → `.../obsidian/html-element` (the other `html-element` helpers stay
at `obsidian-dev-utils/html-element`). At merge time, also flip the `docs/styling.md` CssClass link
from `src/css-class.ts` → `src/obsidian/css-class.ts` — it was left pointing at the old path because the
`lint:md` link-checker (linkinator) validates against GitHub `main`, where the moved file does not exist
until this branch lands.

## Known Issues

- The `package.json` integration scripts `test:integration:desktop`, `test:integration:android`, and
  `test:integration:no-app` reference `scripts/test-integration-{desktop,android,no-app}.ts`, which do
  NOT exist — only `scripts/test-integration.ts` (run via `npm run test:integration`, covering the
  `integration-tests` + `obsidian-integration-tests` vitest projects) is present. Pre-existing; unrelated
  to the boundary refactor. Either add the missing per-target entry scripts or drop the stale
  `package.json` entries.

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
