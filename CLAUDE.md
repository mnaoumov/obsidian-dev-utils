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

## Current Task

**Extract `*Params`/`*Options` parameter bags — BREAKING public-API conversion (option C).
LIBRARY CONVERSION COMPLETE on branch `refactor/extract-params-options` (~25 commits, all green:
3508 tests, 100% coverage, compile/lint/format/spellcheck clean). NOT merged/published.**

Re-running `npx jiti F:/tmp/analyze-params.ts` shows the 3+-param count down from 112 → **11**, and
every one of those 11 is an event/DOM/Proxy-parity signature deliberately kept positional AND now
documented with an `@remarks` note: `on`/`once` (async-events, plugin-settings-component,
plugin-event-source — keep parity with `obsidian#Events#on`/`once`), `createElAsync`/`createSvgAsync`
(keep parity with `obsidian#createEl`/`createSvg`), and `strict-proxy` `get` (keeps parity with the
`ProxyHandler.get` trap). `checkExtension` stays positional (documented hot path).

Everything else from the prior "excluded" set was subsequently bagged on user instruction (group-by-
group): `onSaveSettings` (event-parity arrow adapter at registration), command-handler
`shouldAddTo*Menu`/`handle*Menu`/`editorCheckCallback` (Obsidian callbacks adapted at registration),
`registerAll*DomEvent` (callback member keeps `this: HTMLElement` per the DOM API), `ToJsonConverter`
private methods, and `PluginSettingsTabBase.bind` (both overloads + impl, folding `BindOptions` via
`extends`). The reg-exp flag-merge cluster also became a `RegExpFlagMerger` class per G10o.

**Remaining (handed off, NOT done here):** merge + npm publish the new major (irreversible — needs
explicit go-ahead), then migrate the ~23 consuming plugins against the published version.

Phase 1 (non-breaking internal helpers) — DONE (5 atomic commits): `file-change.ts`, `link.ts`,
`markdown-code-block-processor.ts`, `rename-delete-handler-component.ts`, `over-exposure.ts`.

Phase 2 (BREAKING) — DONE — all exported candidate functions converted to params/options bags.
Design rule (consistent with existing lib style, e.g. `process(app, pathOrFile, provider, options?)`):
keep unambiguously-typed leading args positional (`app: App`, a single `pathOrFile`/`path`/`content`,
a callback); move ambiguous same-typed pairs (old/new path), boolean/enum flags, and optional config
into a trailing bag. Pure 2-string utils with no obvious anchor (`makeFileName`, `ensureStartsWith`)
become a sole required bag. Naming per `params-options-name-match`: sole+required → `...Params`;
optional/supplementary → `...Options`. Use `refactor!:` commits (release tool derives the major bump
from conventional commits — do NOT hand-edit `package.json` version).

**Execution boundary (unattended):** library refactor only — all commits local on the branch.
**Publishing to npm is NOT done unattended** (irreversible outward-facing release). The ~23-plugin
migration is BLOCKED until the new major is published (plugins depend on `obsidian-dev-utils@^80`
from npm), so it is handed off, not executed here.

### Exhaustive candidate inventory (AST pass over all `src/**/*.ts`, excl. tests/`.d.ts`/`index.ts`)

Source of truth: `F:/tmp/analyze-params.ts` (re-run with `npx jiti F:/tmp/analyze-params.ts`). Found
**112 functions/methods with 3+ params** and **202 with exactly 2**. Categorized:

**DONE:**

- Phase 1 internal helpers (file-change, link, markdown-code-block-processor,
  rename-delete-handler-component, over-exposure) — commits `003e3b04`..`1f306c96`.
- `file-system.ts` getters — full-bagged (single `*Params` incl. `app`) in `a6d72e64`
  (superseding the earlier `db994812` `(app, path, options?)` shape).
- `object-utils.ts` toJson family — now a `ToJsonConverter` CLASS (state as fields, helpers as
  methods) per the new R2 **G10o**; commit `9a31c6ac` (superseding the `ToJsonContext` param approach).
- `vault.ts` — `copySafe`/`getAbstractFilePathSafe`/`getOrCreateAbstractFileSafe`/`getSafeRenamePath`/
  `invokeWithFileSystemLock`/`isChild`/`isChildOrSelf`/`renameSafe`/`process`/`invokeFileActionSafe`
  full-bagged; `process` → `ProcessParams extends ProcessOptions` — `refactor!` `4249db15`.

**EXCLUDED — signature-locked (do NOT convert):** event-source `on`/`once`/`onSaveSettings`
(async-events, plugin-settings-component, plugin-event-source); command-handler `shouldAddTo*Menu`/
`handle*Menu`/`editorCheckCallback` (Obsidian event arg contracts); `registerAll*DomEvent` (DOM
addEventListener); `createElAsync`/`createSvgAsync` (Obsidian `createEl`); `strict-proxy` `get`
(Proxy handler); transformer `canTransform`/`transformValue`/`getTransformerId` (framework); `bind`
(already options); `checkExtension` (hot path — see file-system commit).

**EXCLUDED — not a candidate (distinct-typed args + trailing options/callback; roles obvious):**
`editLinks`/`editBacklinks`/`process`/`processFrontmatter`/`getBacklinksForFileSafe`/`exec`/
`execFromRoot`/`editJson*`/`editPackage*`/`readdirPosix`/`tempRegisterFilesAndRun(Async)`/
`writeJson*`/`writePackage*`/2-arg `app+path` family in vault.ts/metadata-cache.ts.

**REMAINING — to convert (breaking where exported):**

- `string.ts`: `insertAt`(4), `replaceAllAsync`(4), `replaceAll`(3), `trimEnd`(3), `trimStart`(3),
  `unindent`(3); 2-string ambiguous: `ensureEndsWith`, `ensureStartsWith`, `hasSingleOccurrence`, `indent`.
- `path.ts`: `makeFileName` (2 strings).
- `async.ts`: `invokeAsyncSafelyAfterDelay`(4), `sleep`(3), `timeout`(3).
- `debug.ts`: `printWithStackTrace`(4), `logWithCaller`(4, intern).
- `error.ts`: `CustomStackTraceError` ctor(3).
- `object-utils.ts`: `setNestedPropertyValue`(3), `tryEntryEquality`(3, intern; a/b ambiguous).
- `reg-exp.ts`: `shouldPickFlag`(3), `addSemanticFlags`(3), `addUnicodeFlags`(3) (intern).
- `obsidian/markdown.ts`: `markdownToHtml`, `registerLinkHandlers`, `renderExternalLink`, `renderInternalLink`.
- `obsidian/file-manager.ts`: `addAlias`, `deleteAlias`.
- `obsidian/attachment-path.ts`: `getAttachmentFolderPath`, `hasOwnAttachmentFolder` (trailing enum).
- `obsidian/dataview.ts`: `insertCodeBlock`; `createPageLink`(intern).
- `obsidian/dataview-link.ts`: `fixTitle`.
- `obsidian/resource-url.ts`: `relativePathToResourceUrl`.
- `obsidian/file-change.ts`: `applyContentChanges`(5, exported), `applyFileChanges`(5, trailing bool after options).
- `obsidian/link.ts`: `editLinksInContent`(4), `extractLinkFile`(4).
- `obsidian/metadata-cache.ts`: `registerFileCacheForNonExistingFile`(3).
- `obsidian/logger.ts`: `invokeAsyncAndLog`(4).
- script-utils: `copyToObsidianPluginsFolderPlugin`(4), `fixSourceMapsPlugin`(3), `execString`(3),
  `executeBatches`(3), `spawnViaShell`(3), `over-exposure` `record`(3), assorted eslint-rule intern helpers.
- `test-helpers/mock-implementation.ts`: `mockImplementation`(3).

**CONFIRMED DESIGN (user, this session): FULL BAG EVERYTHING.** Every converted function takes ONE
object that includes ALL arguments (incl. `app`) as named members → always `<Owner>Params` (sole
required). Fully labeled, order-independent call sites: `copySafe({ app, oldPathOrFile, newPath })`,
`getFile({ app, pathOrFile, isCaseInsensitive: true })`, `isChild({ app, childPathOrFile,
parentPathOrFile })`. Rename meaningless params (`a`/`b` → `childPathOrFile`/`parentPathOrFile`).
Optional args → optional members. Fold any pre-existing options type into the single Params bag (e.g.
`ProcessParams extends ProcessOptions`). Constructor bag = `<ClassName>ConstructorParams`. Use
`refactor!:` for breaking commits.

**Also confirmed:** convert the hot 2-string utils (`ensureStartsWith`/`ensureEndsWith`/`indent`/
`hasSingleOccurrence`) too.

**REWORK NEEDED:** `file-system.ts` getters shipped in `db994812` as `(app, path, options?)` must be
re-done as full bags (`getFile({ app, pathOrFile, ... })`), folding the `*Options` interfaces into
`*Params`.

## Architectural Vision: Improve DX + Testability of Plugin Base Classes

**Goal:** Make all base classes testable (remove v8 ignore comments) and simplify DX for ~23 consuming plugins. Currently PluginBase and related classes are fully untested.

### Plugin Audit Results (2026-04-14)

Reviewed all 23 plugins in `F:\dev\projects\@obsidian\`. Key findings:

| Feature | Usage | Notes |
| --- | --- | --- |
| PluginTypes generic interface | 23/23 | Pure boilerplate for simple plugins (4 plugins define only `plugin` member) |
| createSettingsManager() | ~20/23 | Almost universal |
| createSettingsTab() | ~18/23 | Almost universal |
| onloadImpl() | ~21/23 | Main setup point |
| onLayoutReady() | ~14/23 | Very popular lifecycle hook |
| onSaveSettings() | ~8/23 | Re-register watchers, update timers |
| onLoadSettings() | ~6/23 | React to loaded settings |
| abortSignal | ~8/23 | Cancel long-running ops on unload |
| createTranslationsMap() | 2/23 | Only consistent-attachments + custom-attachment-location |
| consoleDebug() | ~4/23 | Underused |
| waitForLifecycleEvent() | ~3/23 | Rare |
| handleAsyncError() override | 0/23 | Default always sufficient |
| onunloadImpl() | ~2/23 | Rare |
| registerLegacySettingsConverters | ~3/23 | Migration scenarios |
| Custom validators | ~4/23 | email-to-vault, smart-rename, etc. |
| addChild() for components | ~3/23 | advanced-exclude, advanced-note-composer, nested-properties |

**Plugins without settings (4):** edit-link-alias, nested-properties, root-folder-context-menu, file-explorer-reload

### Boilerplate Analysis (2026-04-14)

Reviewed plugin source code across simple/medium/complex plugins:

| Plugin type | Files required | Boilerplate % | Key pain |
| --- | --- | --- | --- |
| Simple (no settings) | 3 (main, PluginTypes, Plugin) | ~23% | PluginTypes is 100% boilerplate |
| Medium (with settings) | 6 (+Settings, Manager, Tab) | ~31% | Settings triple is pure ceremony |
| Complex (settings + commands) | 6+ feature files | ~51% | Command pattern adds ~30 LOC each |

**Boilerplate files that are 100% ceremony in every plugin:**

- `main.ts` (3-4 lines, always identical)
- `PluginTypes.ts` (7-13 lines, always identical structure)
- `PluginSettingsManager.ts` (11 lines, just returns `new PluginSettings()`)

**Current universal features in PluginBase:**

- Lifecycle: onloadImpl, onLayoutReady, onunloadImpl, load/layoutReady/unload events
- Settings: createSettingsManager, createSettingsTab, onLoadSettings, onSaveSettings
- Utilities: consoleDebug, showNotice, abortSignal
- i18n: createTranslationsMap (only 2 plugins use)
- Error handling: handleAsyncError (0 plugins override)

### Proposed Architecture: Ideal DX

#### Goal: Minimal boilerplate, maximum testability, beginner-friendly

#### 1. Simplest possible plugin (no settings)

**Current (3 files, ~26 LOC boilerplate):**

```typescript
// main.ts (boilerplate)
// PluginTypes.ts (boilerplate)
// Plugin.ts
export class Plugin extends PluginBase<PluginTypes> {
  protected override async onloadImpl(): Promise<void> {
    await super.onloadImpl();
    new EditCommand(this).register();
  }
}
```

**Proposed (1 file + main.ts):**

```typescript
// Plugin.ts
export class Plugin extends PluginBase {
  protected override async onloadImpl(): Promise<void> {
    await super.onloadImpl();
    new EditCommand(this).register();
  }
}
```

- No PluginTypes interface needed — PluginBase is non-generic
- main.ts still needed (Obsidian requires `export default Plugin`)

#### 2. Plugin with settings

**Current (6 files):**

```text
main.ts                    — boilerplate
PluginTypes.ts             — boilerplate (13 LOC)
PluginSettings.ts          — data class
PluginSettingsManager.ts   — boilerplate (11 LOC, just returns new PluginSettings())
PluginSettingsTab.ts       — UI definition
Plugin.ts                  — orchestration + createSettingsManager + createSettingsTab overrides
```

**Proposed (3 files):**

```text
main.ts                    — boilerplate (unavoidable, Obsidian requirement)
PluginSettings.ts          — data class + validation + persistence (extends PluginSettingsBase)
Plugin.ts                  — orchestration
```

The settings tab is built declaratively from metadata on the settings class:

```typescript
// PluginSettings.ts
export class PluginSettings extends PluginSettingsBase {
  @setting({ name: 'Auto-refresh interval', desc: 'Seconds between refreshes' })
  public autoRefreshIntervalInSeconds = 10;

  @setting({ name: 'Should prompt for folder', desc: 'Prompt when creating notes' })
  public shouldPromptForFolderLocation = false;
}
```

Or, if decorators are too magical, a static method approach:

```typescript
export class PluginSettings extends PluginSettingsBase {
  public autoRefreshIntervalInSeconds = 10;
  public shouldPromptForFolderLocation = false;

  // Optional: custom validation
  protected override registerValidators(): void {
    this.registerValidator('autoRefreshIntervalInSeconds', (v) =>
      v < 1 ? 'Must be at least 1 second' : undefined
    );
  }
}
```

Settings tab is auto-generated from settings properties by default but can be customized:

```typescript
// Plugin.ts
export class Plugin extends PluginBase {
  protected override createSettings(): PluginSettings {
    return new PluginSettings();
  }

  // Only override if you need custom tab UI
  protected override createSettingsTab(): PluginSettingsTab | null {
    return new CustomTab(this.app, this.settings);
  }
}
```

#### 3. Plugin with custom settings tab

For plugins that need custom UI (code highlighters, secret fields, grouped sections):

```typescript
// PluginSettingsTab.ts
export class PluginSettingsTab extends PluginSettingsTabBase<PluginSettings> {
  public override display(): void {
    super.display();
    new SettingEx(this.containerEl)
      .setName('Email address')
      .addText((text) => this.bind(text, 'emailAddress'));
  }
}
```

- Generic is just `<PluginSettings>`, not `<PluginTypes>`
- `bind()` API stays the same — it's one of the best parts of the current design

#### 4. Component-based architecture

**Universal features PluginBase provides automatically:**

- "Open settings" command (registered if settings exist)
- consoleDebug with plugin namespace
- abortSignal for lifecycle management
- onLayoutReady as a first-class hook
- Error handling with user-visible notice

**Features that become opt-in components:**

```typescript
export class Plugin extends PluginBase {
  constructor(app: App, manifest: PluginManifest) {
    super(app, manifest);
    // Only compose what you need
    this.settings = this.addChild(new PluginSettings());
    this.emailChecker = this.addChild(new EmailChecker(app, this.settings));
  }
}
```

Each component is independently testable:

```typescript
// In tests — no Plugin mock needed
const settings = new PluginSettings();
const checker = new EmailChecker(mockApp, settings);
await checker.onload();
expect(checker.lastCheckTime).toBeDefined();
```

#### 5. Command simplification

**Current (2 classes per command, ~30 LOC):**

```typescript
class CheckEmailsInvocation extends CommandInvocationBase<Plugin> { ... }
export class CheckEmailsCommand extends NonEditorCommandBase<Plugin> { ... }
```

**Proposed (inline registration):**

```typescript
// In Plugin.onloadImpl()
this.addCommand({
  id: 'check-emails',
  name: 'Check emails',
  icon: 'mail',
  callback: () => this.emailChecker.checkEmails()
});
```

For editor commands that need more structure, keep the class pattern as opt-in.

### Summary of changes

| What | Current | Proposed | Benefit |
| --- | --- | --- | --- |
| PluginTypes interface | Required (7-13 LOC) | Eliminated | -1 file per plugin |
| PluginBase generic | `<PluginTypes>` | Non-generic | No type threading |
| PluginSettingsManager | Required class (11+ LOC) | Folded into PluginSettingsBase | -1 file per plugin |
| PluginSettingsTab | Always required class | Auto-generated, override for custom | -1 file for simple settings |
| Settings validation | Separate registerValidators() | On the settings class itself | Co-located with data |
| Commands | 2 classes per command | Inline `addCommand()` + opt-in classes | -30 LOC per command |
| Universal features | All in PluginBase god-object | Auto-registered by PluginBase | Same DX, better internals |
| Testing | Requires full Plugin mock | Each component testable alone | Enables 100% coverage |

### Implementation plan (incremental PRs)

#### PR 1 (non-breaking): Internal testability refactor

- Break `plugin` dependency in manager/tab internals
- Add tests for all base classes
- Remove v8 ignore comments
- No consumer-facing API changes

#### PR 2 (breaking): Simplify generics + eliminate PluginTypes

- PluginBase becomes non-generic
- `PluginSettingsManagerBase<S>` and `PluginSettingsTabBase<S>`
- Delete plugin-types-base.ts and Extract* helpers
- Migration: delete PluginTypes.ts, update extends clauses

#### PR 3 (breaking): Merge settings triple + auto-generate tab

- PluginSettingsBase = data + validation + persistence
- Default settings tab auto-generated from properties
- Custom tab still supported via override
- Migration: merge 3 files into 1, update Plugin class

#### PR 4 (breaking): Command simplification

- Keep `addCommand()` as the primary API (it's already Obsidian-native)
- Deprecate CommandInvocationBase / CommandBase classes
- Migration: inline simple commands, keep classes for complex ones

#### PR 5 (optional): Decorator-based settings metadata

- `@setting()` decorator for auto-generating tab UI
- Only if the simpler approaches prove insufficient

#### Migration tooling

- Provide a codemod script (`jscodeshift` transform) for PRs 2-4
- Each PR gets its own migration guide
- Major version bump covers all breaking PRs

### Files modified

- `src/obsidian/plugin/plugin-base.ts` — non-generic, component-based architecture
- `src/obsidian/plugin/plugin-settings-manager-base.ts` — **deleted**, merged into `plugin-settings-component.ts`
- `src/obsidian/plugin/components/plugin-settings-component.ts` — unified settings component (data + persistence + validation + events)
- `src/obsidian/plugin/plugin-settings-wrapper.ts` — kept as interface (used by tab)
- `src/obsidian/plugin/plugin-settings-tab-base.ts` — simplified generic to `<PluginSettings>`, uses `settingsComponent` instead of `settingsManager`
- `src/obsidian/plugin/plugin-types-base.ts` — kept, all types deprecated
- All ~23 consuming plugins need migration

## Progress

### Library refactoring (DONE)

- Branch: `refactor/plugin-architecture-v2`
- All changes compile (0 TypeScript errors)
- All 2795 tests pass
- Lint clean, formatted

### Key changes made

1. **PluginBase** — now non-generic (was `PluginBase<PluginTypes>`), uses component-based architecture
2. **PluginSettingsManagerBase** — deleted; all logic merged into `PluginSettingsComponentBase<PluginSettings>` in `src/obsidian/plugin/components/plugin-settings-component.ts`
3. **PluginSettingsTabBase** — generic over `<PluginSettings extends object>` (was `<PluginTypes>`), takes `{plugin, settingsComponent}` params
4. **i18n** — decoupled from PluginTypes, `TranslationsMap` is now a plain `Record<string, Record<string, unknown>>`
5. **plugin-types-base.ts** — kept but all types marked `@deprecated` with eslint-disable

### Command architecture refactor (DONE)

- Replaced old `src/obsidian/commands/` (6 files, all v8-ignored) with `src/obsidian/command-handlers/` (8 source files + 9 test files)
- **Eliminated 14 invocation classes** — merged canExecute/execute into handler classes directly
- **Removed `TPlugin` generic** from all command classes — handlers take `pluginName: string`, no `Plugin` or `App` God objects
- **Separated concerns via interfaces**: `ActiveFileProvider`, `MenuEventRegistrar` — injected via `CommandHandlerRegistrationContext` during `onRegistered()`
- **Concrete App implementations**: `AppActiveFileProvider`, `AppMenuEventRegistrar` — consumers and `CommandHandlerComponent` use these
- **Handlers don't implement `Command`** — `CommandHandler.buildCommand()` returns a plain `Command` object for Obsidian, eliminating `originalId`/`originalName` workaround
- **Renamed classes**: `CommandBase` → `CommandHandler`, `NonEditorCommandBase` → `GlobalCommandHandler`, `EditorCommandBase` → `EditorCommandHandler`, `FileCommandBase` → `FileCommandHandler`, `FolderCommandBase` → `FolderCommandHandler`, `CommandComponent` → `CommandHandlerComponent`
- **44 new tests**, all passing. No v8 ignore comments in command-handler files.
- All 2935 tests pass, lint/format/spellcheck clean

### Obsidian integration tests (IN PROGRESS)

- Infrastructure: test harness plugin (`integration-test-plugin/`), build script, vitest global setup, vitest config project
- `getDomEventsHandlersConstructor` — 2 tests (basic extraction + consistency)
- `markdown` — 6 tests (markdownToHtml variants + fullRender)
- `attachment-path` — 4 tests (getAttachmentFolderPath, getAvailablePathForAttachments, hasOwnAttachmentFolder)
- `rename-delete-handler` — 5 tests (rename, move, link update, delete, export check)
- `markdown-code-block-processor` — 5 tests (export checks + vault read)
- `backlink` (via metadata-cache) — 4 tests (backlink retrieval, getAllLinks)
- All tests use `obsidian-integration-testing` library with `evalInObsidian` + `TempVault`

### Plugin migrations (IN PROGRESS)

- **obsidian-edit-link-alias** — migrated (simple, no settings). Deleted PluginTypes.ts, removed generic from Plugin.
- **obsidian-new-note-fixer** — migrated (medium, with settings). Updated manager/tab constructors, deleted PluginTypes.ts.
- **Remaining ~21 plugins** — not yet migrated, awaiting approval of approach

### Migration pattern for consuming plugins

1. Delete `PluginTypes.ts`
2. `Plugin.ts`: Remove `<PluginTypes>` from `extends PluginBase<PluginTypes>` → `extends PluginBase`
3. `PluginSettingsManager.ts` → rename to `PluginSettingsComponent.ts`: Change `PluginSettingsManagerBase<PluginTypes>` → `PluginSettingsComponentBase<PluginSettings>`, constructor takes `params: PluginSettingsComponentParams`
4. `PluginSettingsTab.ts`: Change `PluginSettingsTabBase<PluginTypes>` → `PluginSettingsTabBase<PluginSettings>`, constructor takes `params: PluginSettingsTabBaseParams<PluginSettings>`
5. In Plugin constructor: `this.settingsComponent = this.addChild(new PluginSettingsComponent(new PluginDataHandler(this)))`
6. `Plugin.createSettingsTab()`: Pass `{plugin: this, settingsComponent: this.settingsComponent}`
7. `this.settings` returns `ReadonlyDeep<object>` — cast to your settings type where needed

## Pending Questions

**Q: Publish the new major + migrate the ~23 plugins?** User chose option **C** (all exported
candidates). The library refactor is being done unattended on `refactor/extract-params-options`, but
the npm publish (irreversible) and the dependent 23-plugin migration are NOT done unattended.
Once the library branch is reviewed: (1) merge + publish the new major via the release tool, then
(2) run the plugin-migration sweep against the published version. Awaiting go-ahead on the release.

## Known Issues

None. The three performance issues previously tracked here (eager per-attachment `readBinary`,
`RenameDeleteHandler` acting on synthetic index-only deletions, and O(vault) string-path resolution
on a miss) are all fixed in the library — see **Current Task** for what landed and the remaining
cross-repo follow-up for the `custom-attachment-location` lazy-provider migration.

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
