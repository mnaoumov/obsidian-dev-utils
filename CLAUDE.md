# CLAUDE.md

## Project Overview

`obsidian-dev-utils` is a TypeScript utility library for Obsidian plugin development. It publishes as a dual-format (ESM + CJS) npm package.

## Current Task — Bug: `file://` normalization skips multi-link frontmatter values — DONE in dev-utils, pending release + consumer follow-up

**Landed** (`src/obsidian/link.ts`): `updateFileUrlLinksInFile` / `updateFileUrlLinksInContent` now also normalize
`file://` links inside a frontmatter value that holds **more than one link** (the
`MultiValueFrontmatterExternalLinks` feature — each link located by `startOffset`/`endOffset` within the value
via `ParseLinkFrontmatterReferenceWithOffsets`). Previously left unchanged:

```yaml
key: "file:///C:\path\to\a.md file:///C:\path\to\b.md"
```

Delivered: a new `shouldEditMultiValueFrontmatterExternalLinks` option on `EditLinksParams` /
`EditLinksInContentParams` (default `false`, mirroring `shouldEditFrontmatterExternalLinks`), threaded through
`editLinks` → `getCacheSafe` (`shouldParseMultiValueFrontmatterExternalLinks`), `editLinksInContent` →
`parseMetadata`, and `getFileChanges` (`shouldIncludeMultiValueFrontmatterExternalLinks` → `getLinks`);
`updateFileUrlLinksInContent`/`updateFileUrlLinksInFile` pass it `true`. The offset-aware splicing (each
normalized URL spliced back in place without disturbing surrounding text or the other links in the same value)
was already fully handled by the existing `referenceToFileChange` / `applyContentChanges` /
`applyFrontmatterChangesWithOffsets` pipeline and `normalizeFileUrlLink`'s frontmatter branch — no change needed
there. Tests extended: `link.test.ts` (multi-link value, offset splicing/round-trip; existing `updateFileUrl*`
mocks updated to include the new feature + array) + `link.obsidian.integration.test.ts` (real-Obsidian
round-trip). Full gate green (100% coverage on `link.ts`, compile, lint, format, spellcheck, integration).

**Consumer follow-up (obsidian-better-markdown-links, after release).** The plugin's trigger-path gate in
`better-markdown-links-component.ts` (`hasFileUrlLink`) currently checks only `cache.externalLinks` +
`cache.frontmatterExternalLinks`, and `processFile` requests `getCacheSafe(..., { shouldParseExternalLinks,
shouldParseFrontmatterExternalLinks })`. Once the library normalizes multi-value frontmatter file links, extend
both: request `shouldParseMultiValueFrontmatterExternalLinks` and include `cache.multiValueFrontmatterExternalLinks`
in `hasFileUrlLink`, so a note whose only `file://` link lives in a multi-link frontmatter value still triggers on modify/save/navigation.
(Deliberately omitted for now so the gate matches exactly what the library normalizes — avoids no-op conversion churn.)

**Origin.** Surfaced by the user while wiring `file://` normalization into obsidian-better-markdown-links (#35).

## Current Task — External `file://` link normalization (obsidian-better-markdown-links #35) — only plugin wiring remaining

**Body + frontmatter `file://` normalization is DONE** (every increment 100% coverage + full gate). Body work is
merged to `main`; the frontmatter converter is on branch `file-links-frontmatter`. Delivered: `parse-link` module;
`ParseLinkReference` + frontmatter reference types + `isParseLinkFrontmatterReference` guard; `CachedMetadataEx`
(features enum + gated arrays) + feature-gated `getLinks`; `getCacheSafe`/`parseMetadata` return `CachedMetadataEx`
and parse body/frontmatter external links via `ParseCacheOptions`; `parseFrontmatterLinks`; `normalizeFileUrl`;
`editLinks`/`editLinksInContent` `shouldEditFrontmatterExternalLinks` flag; the body-vs-frontmatter-aware
converter (`normalizeFileUrlLink` emits a bare YAML-value url for frontmatter, a `[alias](url)` link for the
body); and the high-level `updateFileUrlLinksInFile`/`updateFileUrlLinksInContent` (both body + frontmatter).

**Origin:** FR <https://github.com/mnaoumov/obsidian-better-markdown-links/issues/35> ("Support `file:///` links").
Scope: `file://` scheme ONLY (leave other externals untouched). Runtime routing/resolution is CDP-confirmed
(notes in the plugin's memory `obsidian-file-link-resolution`); the full round-trip (real Obsidian frontmatter +
body write-back) is confirmed by `link.obsidian.integration.test.ts`.

### Remaining follow-up (separate repo, hand-off) — plugin wiring

Back in `obsidian-better-markdown-links`: add a `shouldNormalizeFileLinks` setting (**default `true`**, per user
2026-07-10) to `PluginSettings` + the settings tab, and wire the new converter into the existing
modify/save/navigation triggers and the convert-in-file/folder/vault commands. Default-on means the plugin
rewrites existing `file://` links automatically on those triggers — intended.

## Current Task — Reusable "Unlock active note" + release-on-abort in `resource-lock` (from advanced-note-composer #129) — DONE in dev-utils, pending consumer follow-up

**Landed** (`src/obsidian/resource-lock.ts`, commit `408f9fe0 feat(resource-lock)!: click/command unlock that always releases and cancels`): (a) ancestor-aware unlock — `ResourceLockManager.forceUnlock` resolves the covering owner via `resolveLockOwnerPath`, aborts its controllers AND removes its entries, exposed as `ResourceLockComponent.requestUnlockForPath(pathOrFile)`; (b) opt-in `shouldReleaseOnAbort` + `onUnlockRequested` on `ResourceLockComponentLockForPathParams`, wired by `wireReleaseOnAbort` (both `@default false`, test-backed); (c) `UnlockActiveNoteCommandHandler` (`src/obsidian/command-handlers/unlock-active-note-command-handler.ts`) + barrel export + `unlock-active-note-command-handler.test.ts`. Tests extended (`resource-lock.test.ts`, `resource-lock.obsidian.integration.test.ts`).

**Consumer follow-up (advanced-note-composer, after release):** replace the plugin-local `UnlockActiveNoteCommandHandler` with the library one; replace the `markSelectionToMove()` helper's hand-wired `abortController.signal → moveSelectionBuffer.clear()` with `lockForPath(…, { shouldReleaseOnAbort: true, onUnlockRequested: () => moveSelectionBuffer.clear() })`. Keep the plugin-specific buffer/notice/highlight cleanup + the identity guard (`get() === markedSelection`, stale-controller safety). The plugin's all-notes lock (a `subtree` lock on the vault root) is covered by the library `canExecute` via `isLockedByAncestorForPath`.

## Current Task — `loop()`: `buildNoticeMessage` callback takes a params object — DONE in dev-utils, pending release + consumer follow-up

**Landed** (`src/obsidian/loop.ts`, commit `refactor(loop)!: pass buildNoticeMessage a params object`): `buildNoticeMessage(item, iterationStr)` → `buildNoticeMessage(params)` where `params: LoopBuildNoticeMessageParams<T> = { item; iterationStr }`, on `LoopParams<T>` (the actual type is `LoopParams`, not `LoopOptions`). Call site + `loop.test.ts` updated; full gate green (100% coverage). (`loop.d.ts` is a gitignored build artifact — regenerated, not hand-edited.)

**Remaining:** cut the **major** release (breaking API change), then the consumer follow-up. The user approved this breaking change (2026-07-10, over leaving the callbacks as thin adapters).

**Consumer follow-up (after release):** update the 15 `buildNoticeMessage: (item, iterationStr) => …` arrows to `buildNoticeMessage: ({ item, iterationStr }) => …` across: `backlink-cache` (2), `better-markdown-links` (1), `consistent-attachments-and-links` (7), `custom-attachment-location` (2), `external-rename-handler` (2), `frontmatter-markdown-links` (1). Bump dev-utils in each and adjust. Full checklist: `F:/tmp/g10d-refactor-todo.md` (§3).

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

- Delay/timeout primitives (e.g. `sleep`, `abortSignalTimeout`, `setTimeoutAsync`) must be built on `globalThis.setTimeout`, never on the native `AbortSignal.timeout`. Vitest fake timers patch `setTimeout` but not `AbortSignal.timeout` (it owns an internal timer they cannot advance), so a primitive built on `AbortSignal.timeout` runs in real wall-clock time even under `vi.useFakeTimers()` — making it and everything layered on it non-deterministic and slow to test.
- Use `globalThis.setTimeout`, not `window.setTimeout`. `globalThis.setTimeout` is present (and fake-timer patched) in BOTH browser/jsdom and Node — under jsdom `window === globalThis`, so nothing changes there — but it additionally works in a `node` environment where `window` is undefined. This matters because consumer integration-test projects run vitest `environment: 'node'`: a hook that awaits `sleep` there would throw `ReferenceError: window is not defined` if the primitive were built on `window.setTimeout`.
- This applies transitively: any helper that awaits a delay (like `sleep` awaiting `abortSignalTimeout`) inherits the (un)controllability of the underlying timer, so the requirement is on the lowest-level primitive.
- When reimplementing a native timing primitive this way, mirror the native abort reason so consumers see identical behavior: `abortSignalTimeout` aborts with a `DOMException` named `TimeoutError` (as native `AbortSignal.timeout` does), not a plain `Error`.
- (cannot be forced by ESLint — a custom `no-restricted-syntax` selector could flag `AbortSignal.timeout` usage in `src/`)

### L3. Expose extendable members as `protected`, documented with TSDoc

- On an **exported** class that a consumer could reasonably subclass, a member a subclass would legitimately reuse must be `protected`, not `private`, so the subclass can access the inherited member without shadowing/colliding on it. Promote generously — this is the deliberate counterweight to the `find-overexposed` linter, which narrows in the opposite direction.
- **Promote to `protected readonly`** (preserving `readonly`): constructor-injected collaborators and identities (`app`, `plugin`, `pluginId`, `pluginName`, injected services/registrars/providers/components, builder/converter callbacks), owned domain objects a subclass reads (an index, a registry, the selectable-values list, a wrapped inner component), and natural override/extension hook methods.
- **Keep `private`**: transient internal state (caches/maps/sets/accumulators, timestamps, flags, counters); a field that merely backs an existing public/protected accessor (the `_x` + `get x()` pattern — the accessor is the exposure, so promoting the backing field only duplicates surface); pure internal helper methods that are not override points; and every member of a **non-exported** class (a consumer cannot subclass it, and TypeScript forbids a `protected` member whose type is a non-exported class).
- **Every promoted `protected` member must carry a TSDoc comment.** For a constructor parameter-property (`protected readonly x` in the constructor signature), the constructor's `@param x` tag is its documentation; for a field declaration, add a `/** ... */` block above it.
- (cannot be forced by ESLint — the promote-vs-keep decision is a judgment call; the TSDoc requirement on non-private members could be partially checked by a custom `jsdoc/require-jsdoc` context)

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
  accumulated state does not leak between tests), enables async-operation tracking, silences every
  `console` method (replacing each with a no-op via `silenceConsole()`, so incidental log/warn/error
  output does not pollute the test report), and clears `localStorage` (so per-worker Web Storage does
  not leak between tests); after each test it disables tracking and restores the original `console`
  methods (`restoreConsole()`), so tests can `await waitForAllAsyncOperations()` against isolated
  state. A test that needs to assert on console output re-instruments the method it cares about (e.g.
  `vi.spyOn(console, 'error')`), which transparently overrides the no-op for that test. The Vitest/Jest
  files are thin setup-file glue (v8-ignored) over the unit-tested agnostic core. The top-level
  `setup.ts` and all `*-setup.ts` files are excluded from the auto-generated barrels (see
  `scripts/build-generate-index.ts`) so a production `import 'obsidian-dev-utils'` never pulls in
  `vitest`/`@jest/globals`.

### `localStorage` in tests (`--localstorage-file`)

- Node 22+ exposes an experimental Web Storage `localStorage`, but touching it without the
  `--localstorage-file` CLI flag emits an `ExperimentalWarning` and leaves `localStorage` unavailable
  (`undefined`). In real Obsidian (Electron) `localStorage` exists, so the root-cause fix is to provide
  it in tests — not to suppress the warning.
- `exec()` (`src/script-utils/exec.ts`) therefore appends `--localstorage-file=:memory:` to every spawned
  child process's `NODE_OPTIONS` (via `CHILD_ENV`, the same env-injection point already used for
  `DEBUG_COLORS`; existing `NODE_OPTIONS` are preserved by `appendNodeOption()`). `:memory:` gives each
  process a working, non-persistent `localStorage` — no file on disk, no state shared between processes.
  Because the flag rides on `NODE_OPTIONS`, it reaches Vitest's forked workers (Vitest ignores
  `poolOptions.*.execArgv` for this) whenever tests are launched through the runner (`npm test` →
  `test()` → `exec`). Running `vitest` **directly** (bare `npx vitest`) bypasses `exec`, so `localStorage`
  is absent there — run tests via the npm scripts.

### Warnings as errors

- `installWarningsAsErrors()` (`src/script-utils/warnings-as-errors.ts`) registers a process `'warning'` listener that
  rethrows, so any Node warning (`ExperimentalWarning`, `DeprecationWarning`, `MaxListenersExceededWarning`,
  …) surfaces as an uncaught error and **fails the run** (non-zero exit). This forces warnings to be fixed
  at the source rather than scrolling past unread.
- It is wired into this repo's `unit-tests:obsidian` project via the `./src/warnings-as-errors-setup.ts`
  setup file (kept **separate** from `vitest-setup.ts`/`jest-setup.ts` so it stays opt-in — adopting the
  standard per-test setup does not silently turn every existing consumer warning into a hard failure).
  Consumers opt in by adding `obsidian-dev-utils/warnings-as-errors-setup` to their `setupFiles` (or
  calling `installWarningsAsErrors()`). Note this pairs with the `--localstorage-file` fix above: with
  warnings-as-errors on, a run that does **not** provide `localStorage` fails on the `ExperimentalWarning`.

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
- The shared setup silences all `console` methods per-test (see "Test setup"); a test that must assert
  on console output re-instruments the method (`vi.spyOn(console, 'error')`), which overrides the no-op.
- The `eslint-plugin-obsidianmd` `no-console` rule flags `console.<member>` access (e.g. `console.log`)
  but NOT bare `console` identifier references. So when a test needs to inspect a console method itself
  (identity/replacement checks), read it via a descriptor — `Object.getOwnPropertyDescriptor(console,
  name)?.value` — which stays lint-clean instead of scattering `eslint-disable no-console` comments
  (`no-console` disables do not even match the obsidian rule's custom message).

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
