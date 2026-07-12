# CLAUDE.md

## Current Task

### T1 — Demo-vault release artifact + `OpenDemoVault` command

**Branch.** Do this work on a new `demo-vault` branch (off `main`). This repo is currently on
`migrate-funcs`; if `demo-vault` is cut from `main`, re-add this entry there. Not yet started — plan
only.

**Context.** Consuming Obsidian plugins release through `updateVersion(...)`
(`src/script-utils/version.ts`); a plugin release currently uploads only the loose plugin files from
`dist/build/`. We add two cooperating features so a plugin can ship a **demo vault** — a curated
vault at `demo-vault/` in the plugin repo root — and let users open it in one step.

**Locked decisions.**

- Demo-vault folder: fixed `demo-vault/` at the plugin repo root; absent → skip silently.
- Archive format: `.zip` (adds `adm-zip`; no zip dep exists today).
- Git tracking: the built plugin copied into `demo-vault/.obsidian/plugins/<id>/` is gitignored by
  the consumer; installed fresh at release time so nothing built lands in git.
- Runtime repo resolution: fetch
  `https://raw.githubusercontent.com/obsidianmd/obsidian-releases/HEAD/community-plugins.json`, find
  the entry whose `id` matches the plugin, read its `repo` (`owner/name`). This is authoritative —
  `app.plugins.manifests[pluginId]` carries no repo (verified against Obsidian's asar runtime).
- Up-to-date UX: open directly, no dialog (like Open sandbox vault). Dialog only when current < latest.

**Grounding (verified during planning).**

- Open a folder as a vault in a new window: `window.electron.ipcRenderer.sendSync('vault-open',
  vaultPath, false)` — fully typed via obsidian-typings; registers the folder in `obsidian.json` and
  opens a new window. Desktop-only.
- Runtime HTTP: Obsidian's `requestUrl` (bypasses CORS; `.arrayBuffer` for the zip). `fetch` is
  script-only here.
- Command stack: `GlobalCommandHandler` (async `execute()`) + `CommandHandlerComponent` +
  `PluginCommandRegistrar`.
- Modals: `ModalBase<Value>` + `showModal` exist; `confirm`/`alert`/`prompt`/`selectItem` are
  fixed-shape — no N-button primitive, so build a reusable `selectOption`.
- Version compare: `compare-versions` (already a runtime dep); installed = `manifest.version`.

#### Feature 1 — release side: archive the demo vault

1. Deps: add `adm-zip` (`^0.5.x`) to `dependencies`, `@types/adm-zip` to `devDependencies` (reused by
   Feature 2). `sort-package-json`; add `adm-zip` to `cspell.json` if flagged.
2. New `src/script-utils/demo-vault.ts` → `archivePluginDemoVault(newVersion): Promise<string | null>`:
   return `null` if `demo-vault/` absent; else read plugin `id` from root `manifest.json`,
   `mkdir -p demo-vault/.obsidian/plugins/<id>`, `cp(dist/build, thatFolder, {recursive:true})` (same
   pattern as `copy-to-obsidian-plugins-folder-plugin.ts`), zip the whole `demo-vault/` to
   `dist/build/demo-vault-<version>.zip` via `adm-zip`, return that path. Reuse
   `resolvePathFromRootSafe`, `ObsidianPluginRepoPaths.DistBuild`/`ManifestJson`, `join`, `cp`/`mkdir`,
   `existsSync`.
3. Hook in `updateVersion`: after the `if (!shouldRelease) return;` guard, after `gitPush()`, before
   `publishGitHubRelease(...)`:
   `if (isObsidianPlugin && shouldArchiveDemoVault) { await archivePluginDemoVault(newVersion); }`.
   The zip lands in `dist/build/`, so the existing `publishGitHubRelease` (uploads every file there)
   attaches it automatically — no signature change.
4. CLI flag `--no-demo-vault` (default on): add `'no-demo-vault'` to `parseVersionArgs`, expose
   `shouldArchiveDemoVault: !(values['no-demo-vault'] ?? false)`, read it in `updateVersion`
   (`shouldArchiveDemoVault = true`).

Enabling the plugin in the archived vault is the consumer's committed
`demo-vault/.obsidian/community-plugins.json` = `["<id>"]` — the release step touches no tracked file.

#### Feature 2 — runtime `OpenDemoVault` command (reusable in dev-utils, opt-in per plugin)

1. `src/obsidian/community-plugins.ts` → `getCommunityPluginRepo(pluginId): Promise<string | null>`:
   `requestUrl` the `obsidian-releases/HEAD/community-plugins.json`, find `entry.id === pluginId`,
   return `entry.repo` or `null`; cache the parsed list. Local interface `{ id; name; author;
   description; repo }`.
2. `src/obsidian/modals/select-option.ts` → `selectOption<T>(params): Promise<T | null>`: extends
   `ModalBase<T | null>`, one `ButtonComponent` per option (label + value, optional CTA), resolves the
   chosen value or `null` on dismiss. Mirrors `confirm.ts`; exported via the modals barrel.
3. `src/obsidian/demo-vault-opener.ts` → `openDemoVault({ app, manifest })` (only invoked on desktop):
   resolve `repo` (notice + return if `null`); `currentVersion = manifest.version`, `latestVersion` =
   `requestUrl` `api.github.com/repos/<repo>/releases/latest` → `tag_name` (bare version);
   `compareVersions` → `>= 0` open current directly, `< 0` show `selectOption` dialog (message
   `Current version of plugin <name> v<current> is not the latest (v<latest>)`, buttons
   `Open demo vault for latest version (v<latest>)` CTA / `Open demo vault for current version
   (v<current>)` / `Cancel`); for the chosen version, cache dir
   `join(tmpdir(), 'obsidian-demo-vaults', <id>, <version>)` (reuse if extracted, else
   `requestUrl(<asset-url>).arrayBuffer` → `new AdmZip(Buffer).extractAllTo(dir, true)`; asset
   `https://github.com/<repo>/releases/download/<version>/demo-vault-<version>.zip`, 404 → notice);
   open via `window.electron.ipcRenderer.sendSync('vault-open', <cacheDir>, false)`.
4. `src/obsidian/command-handlers/open-demo-vault-command-handler.ts` →
   `OpenDemoVaultCommandHandler extends GlobalCommandHandler` (id `open-demo-vault`, name
   `Open demo vault`, icon `download`): `execute()` → `openDemoVault(...)`; `canExecute()` →
   `Platform.isDesktopApp` (via `checkCallback` this hides the command on mobile — no mobile notice).
   Opt-in: the plugin adds it to its `CommandHandlerComponent` `commandHandlers`. Notices via
   `pluginNoticeComponent.showNotice`.

**Consumer setup (documented, per-plugin, future).** Create `demo-vault/` with curated notes +
`.obsidian/`; gitignore `demo-vault/.obsidian/plugins/<id>/` (+ `workspace*.json`); commit
`community-plugins.json` = `["<id>"]`; register `OpenDemoVaultCommandHandler`. Document in
`README.md`/`docs/`.

**Tests (unit — fs/network/adm-zip/`window.electron` mocked).** `demo-vault.test.ts` (absent → null;
present → `cp`+`adm-zip` right paths, returns zip path); `version.test.ts` (flag/non-plugin skip
paths); `community-plugins.test.ts` (hit/miss/cache); `select-option.test.ts` (renders N buttons via
real test-mocks `ButtonComponent`, resolves chosen, null on dismiss — mirror `confirm.test.ts`);
`demo-vault-opener.test.ts` (up-to-date → direct; behind → dialog + each button; cache hit skips
download; missing asset / not-in-registry → notice + no open; `sendSync('vault-open', dir, false)`
fires); `open-demo-vault-command-handler.test.ts` (id/name/icon; `checkCallback` invokes; `canExecute`
gates desktop — drive the real base). Run the full gate before each commit.

**Verification (real behavior).** Release side: throwaway `demo-vault/` + real `dist/build`, call
`archivePluginDemoVault('9.9.9')` from a node one-liner, unzip, confirm the note +
`.obsidian/plugins/<id>/main.js`+`manifest.json`; clean up. Runtime side: desktop CDP/`evalInObsidian`
probe drives the command, asserts the `selectOption` 3 buttons render with exact labels when
current < latest; confirm the actual new-window open manually via CDP (IPC stubbed in unit tests).

**Commits (atomic):** (1) `chore(deps): add adm-zip`; (2) `feat(script-utils): archive plugin demo
vault as a release artifact`; (3) `feat(obsidian): add reusable selectOption modal`; (4)
`feat(obsidian): add OpenDemoVault command`; (5) `docs: document the demo-vault feature`.

### T2 — Migrate reusable helpers from `obsidian-integration-testing` (OIT) into ODU

**Branch.** In progress on `migrate-funcs`. This entry is the self-contained source of truth (G77).

**Goal.** Migrate the useful helpers from OIT's `namespace-bootstrap.ts` (the serialized-closure `lib`
helpers) into ODU as real importable modules — usable in plugin code AND surfaced in the injected `lib`
bag via `__merged`. OIT must never depend on ODU, so every shared helper is a hand-synced **duplicate**;
sync is behavioral (closures vs modules can't be byte-identical), governed by ODU **L18** + OIT **L17**,
no automated drift check.

**Dispositions (settled with user).**

- **Migrate → `src/obsidian/desktop-trusted-input.ts`:** `typeIntoEditor`, `pressKey`, `moveMouse`,
  `hoverElement`, `unhoverElement` (+ the six param interfaces from OIT `eval-in-obsidian.ts`).
  - `moveMouse` and `pressKey` become **sync** (`void`) — their bodies only fire `sendInputEvent`; the
    private `moveMouseTo` is **removed** (folded into `moveMouse`). This is a **breaking `Lib` change in
    OIT** (see hand-off) — prerequisite for ODU's compile.
  - Delays use the **ambient global `sleep(ms)`** (declared in `obsidian.d.ts`), NOT ODU's params-object
    `sleep` — matches the serialized-closure originals. See the open R1 rule below.
  - `Platform.isMacOS` via `import { Platform } from 'obsidian'` (not `ns.obsidianModule`). Trusted input
    via `window.electron.remote.getCurrentWebContents().sendInputEvent` (typed by `obsidian-typings`; if a
    member is missing, report per G66 + `// TODO`).
- **Migrate → `src/obsidian/workspace.ts`:** bare `ensureLayoutReady(app): Promise<void>`. **DONE**
  (committed `220afbeb`).
- **REUSE existing:** `#7 waitUntil` → NOT migrated; poll with the existing `retryWithTimeout` (already in
  `__merged`/`lib`). `serializeError` → reuse `errorToString` (`src/error.ts`, already richer:
  handles `AggregateError`). OIT renames/enriches its own copy (hand-off).
- **SKIP:** `destroyCurrentWindow` + `ipcSendSync` (cut — niche in plugin code; `sendSync` is a one-liner
  callers use directly), plus harness-only `app` getter, `evalWrapper`, `getObsidianModule`,
  `pollVaultBasePath`, `setLocalStorageItem`.

**Sync set (L18/L17):** `typeIntoEditor`, `pressKey`, `moveMouse`, `hoverElement`, `unhoverElement`,
`ensureLayoutReady`, `errorToString`.

**Tests.** ODU is the **source of truth** for these helpers' integration coverage — do NOT duplicate the
integration tests in OIT. ODU adds unit tests (100%) + `*.obsidian.integration.test.ts` (desktop) driving
the real app; OIT sheds the now-redundant trusted-input integration tests (hand-off).

**OIT hand-off = OIT T1 (G55, cross-repo — driven from an OIT session; plan already written into OIT `CLAUDE.md`).**
(1) make `moveMouse`/`pressKey` sync + remove `moveMouseTo` + `Lib` signatures `Promise<void>`→`void`
(**breaking → release 8.0.0**, prerequisite for ODU); (2) rename `serializeError`→`errorToString` +
enrich with `AggregateError`; (3) `// do-not-migrate` TSDoc on the SKIP members; (4) revise L17 to the
sync set (drop `waitUntil`, note `moveMouseTo` fold); (5) drop trusted-input integration tests ODU now
owns. After 8.0.0, ODU bumps `obsidian-integration-testing` to `^8.0.0`.

**Open — R1 sleep rule (needs user confirmation of wording).** R1 already mandates `sleep` (G71 + the
"prefer `sleep`" convention, which routes unit/Node code to ODU's `sleep({ milliseconds })` and closures
to the global `sleep(ms)`). The new rule must add the case "production **renderer-module** code → global
`sleep(ms)`" without contradicting the existing "import ODU `sleep`" guidance — confirm wording before
writing.

**Status.** OIT hand-off (= OIT T1) written into OIT `CLAUDE.md` (uncommitted, for an OIT session).
`ensureLayoutReady` **DONE** (committed `220afbeb`, full gate green). `waitUntil` drafted then reverted
(reuse `retryWithTimeout`). `destroyCurrentWindow`/`ipcSendSync` cut. **All remaining ODU work is blocked
on OIT 8.0.0** — the `desktop-trusted-input.ts` module, the `L18` mirror rule, the `^8.0.0` dep bump, and
the R1 `sleep(ms)` rule (its only ODU consumer is that module). Once OIT ships 8.0.0: bump dep, write
`desktop-trusted-input.ts` (sync `moveMouse`/`pressKey`), add integration tests, add L18, confirm + write
the R1 rule.

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
- `src/__merged.ts` is an auto-generated flat re-export barrel of every renderer-safe **value** export
  (gitignored + eslint-ignored, exactly like `index.ts`; produced by `build:generate-merged`, which runs
  before `build:generate-index`). It backs the `obsidian-dev-utils/__merged` subpath and the `lib` bag
  injected into `evalInObsidian` closures — wired via `registerLibResolver` in
  `scripts/integration-test-obsidian-setup.ts` plus the `Lib` augmentation in
  `src/@types/obsidian-integration-testing.d.ts`. The generator **fails the build if two modules export
  the same value name**: every public value export must be unique (this is why `path.ts` / `string.ts`
  `normalize` were renamed to `normalizePath` / `normalizeString`). Do NOT edit `__merged.ts` manually.

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
  output does not pollute the test report), clears `localStorage` (so per-worker Web Storage does
  not leak between tests), and starts collecting unhandled async errors; after each test it drains any
  tracked fire-and-forget operations, disables tracking, restores the original `console` methods
  (`restoreConsole()`), and fails the test with an `AggregateError` if any unhandled async error was
  emitted (see "Unhandled async errors" below), so tests can `await waitForAllAsyncOperations()` against
  isolated state. A test that needs to assert on console output re-instruments the method it cares about (e.g.
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
- It is installed by the standard `setup()` (`src/setup.ts`), so **every** consumer of
  `obsidian-dev-utils/vitest-setup`, `obsidian-dev-utils/jest-setup`, or the agnostic
  `obsidian-dev-utils/setup` gets it — it is forced, not opt-in. `installWarningsAsErrors()` is
  idempotent, so the repeated `setup()` calls across setup files register the listener at most once.
  Note this pairs with the `--localstorage-file` fix above: with warnings-as-errors on, a run that does
  **not** provide `localStorage` fails on the `ExperimentalWarning` — so tests must be launched through
  the runner (which supplies the flag) or with `--localstorage-file` set.

### Unhandled async errors

- The standard `setup()` also fails a test if a fire-and-forget async operation emitted an async error
  that no consumer handler was there to receive — the "no swallowed async errors" harness. `beforeEach`
  calls `startCollectingUnhandledAsyncErrors()` (`src/error.ts`); `afterEach` drains tracked operations
  via `waitForAllAsyncOperations()` (guarded by `isAsyncOperationTrackingEnabled()`, so a test that
  disabled tracking itself does not trip the drain), then throws an `AggregateError` of whatever
  `stopCollectingUnhandledAsyncErrors()` returns. It is forced, not opt-in.
- "Unhandled" is decided the Node `unhandledRejection` way: `emitAsyncErrorEvent()` collects an error
  only when `asyncErrorHandlerCount === 0` — i.e. no handler registered via
  `registerAsyncErrorEventHandler()` is active at emit time (the built-in `handleAsyncError` printer is
  registered directly on the event source and is deliberately not counted). So the many existing tests
  that register a handler and assert on the emitted error are auto-exempt and needed no changes.
- A test that deliberately triggers an async error with no consumer handler opens an ignore context:
  `using _ = startAsyncErrorIgnoreContext()` (an `asyncErrorIgnoreContextDepth` counter checked by
  `emitAsyncErrorEvent`, exposed via `isAsyncErrorIgnoreContextActive()`). Crucially this also covers
  **fire-and-forget** operations: `addErrorHandler` (`src/async.ts`) captures the active ignore context
  synchronously at schedule time and passes it as `emitAsyncErrorEvent(error, shouldIgnore)`, so a
  rejection that settles during the `afterEach` drain — after the `using` scope has exited — is still
  ignored. No manual `waitForAllAsyncOperations()` in the test is needed. Only operations scheduled
  *inside* the context are ignored; one scheduled outside is still reported.

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
