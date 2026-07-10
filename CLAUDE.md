# CLAUDE.md

## Project Overview

`obsidian-dev-utils` is a TypeScript utility library for Obsidian plugin development. It publishes as a dual-format (ESM + CJS) npm package.

## Current Task — resource-lock: click-to-unlock + always release + cancel + required operation name (branch `lock`)

**Origin:** the parked plan in the global CLAUDE.md ("resource-lock: reusable unlock active note + release-on-abort",
from advanced-note-composer #129) PLUS user refinements (2026-07-10). All refs are to `src/obsidian/resource-lock.ts`.

**Implemented (increments a–d + API-shape refinements):**

- (a) **Ancestor-aware force-unlock** — `ResourceLockManager.forceUnlock(app, pathOrFile)` resolves the covering
  owner via `resolveLockOwnerPath`, aborts every entry's controller (cancel the op) AND removes the entries
  (release), via the private `abortAndReleaseEntries(app, ownerPath)`. Exposed as
  `ResourceLockComponent.requestUnlockForPath(pathOrFile)`. The legacy exact-path abort-only `requestUnlock` /
  free `requestResourceUnlockForPath` are kept unchanged. The indicator/file-menu "Unlock" item now calls
  `abortAndReleaseEntries` (always releases + cancels), satisfying user #2 for both direct and subtree locks.
- (b) **Opt-in release-on-abort + notify** — `ResourceLockComponentLockForPathParams` carries
  `shouldReleaseOnAbort?: boolean` (`@default false`) + `onUnlockRequested?()`. Both are stored on the `LockEntry`;
  `wireReleaseOnAbort(app, path, entry)` adds a one-shot `abort` listener → `removeEntry` (release) + callback.
  No-op without an `abortController` or when neither opt-in is set (transactional locks release via their own cleanup).
- (c) **`UnlockActiveNoteCommandHandler`** — `src/obsidian/command-handlers/unlock-active-note-command-handler.ts`,
  a `GlobalCommandHandler` taking `{ app, resourceLockComponent }`; `canExecute` = active file exists AND
  `isLockedByAncestorForPath(activeFile)` (which already covers the direct-lock case, so no redundant OR); `execute`
  = `requestUnlockForPath(activeFile)`. Barrel regenerated (do not hand-edit `command-handlers/index.ts`).
- (d) **Click-to-unlock** — `registerUnlockMenu` now registers the shared `openUnlockMenu` on BOTH `click` and
  `contextmenu`, so a LEFT-click on any of the three lock indicators (action icon / tab icon / status bar) opens
  the same unlock context menu.

**API-shape refinements (user, 2026-07-10):**

- **`operationName` is REQUIRED on every lock** — carried on `ResourceLockComponentLockForPathParams`,
  `LockResourceForPathParams`, `ManagerLockParams`, and `LockEntry` (all non-null `string`). Shown next to the
  plugin name in the unlock confirmation via the new `lockDescriptors()` (one entry per distinct plugin+operation) →
  `unlockConfirmMessage` renders `code(pluginName)` + `: operationName` per lock. `vault.ts` `process()` passes
  `operationName: 'Process note'`.
- **All lock acquirers take a single params object** — `ResourceLockComponent.lockForPath(params)` (pathOrFile
  merged in), the free `lockResourceForPath(params)`, and the internal `ResourceLockManager.lock(params)` (app +
  pathOrFile + pluginId + options all flattened into `ManagerLockParams`).
- **`abortController` stays OPTIONAL** (user decision): force-unlock always RELEASES the lock even without a
  controller (it removes the entry); it just cannot CANCEL an operation that has no controller.

**Status:** code + unit tests complete (`resource-lock.test.ts` 100%; new `unlock-active-note-command-handler.test.ts`
100%). Full gate green (compile + full `test:coverage` 3778 passing + lint + format + spellcheck). Real behavior
confirmed in live Obsidian via `resource-lock.obsidian.integration.test.ts` (force-unlock releases a real editor
lock + aborts the operation). Landed in commit `feat(resource-lock)!: click/command unlock that always releases and
cancels`. A follow-up commit dropped the now-redundant per-test `vaultPath: inject('tempVaultPath')` across all
obsidian integration suites (the harness worker setup already wires `setVaultPathResolver(() => inject('tempVaultPath'))`).

**After this lands (consumer, separate session):** advanced-note-composer drops its local
`UnlockActiveNoteCommandHandler` + hand-wired `abortController.signal → moveSelectionBuffer.clear()`, consuming the
library command + `lockForPath({ …, shouldReleaseOnAbort: true, onUnlockRequested: () => moveSelectionBuffer.clear() })`.
Then remove the parked entry from the global CLAUDE.md.

## Current Task — External `file://` link normalization (for obsidian-better-markdown-links issue #35) — LIBRARY CORE DONE

**STATUS (2026-07-10): Body `file://` normalization is COMPLETE in obsidian-dev-utils** (12 commits on branch
`file-links`, every increment 100% coverage + full gate). Delivered: `parse-link` module; `ParseLinkReference` +
frontmatter reference types; `CachedMetadataEx` (features enum + gated arrays) + `getLinks` feature-gated
selection; `getCacheSafe`/`parseMetadata` return `CachedMetadataEx` and parse body/frontmatter external links via
`ParseCacheOptions`; `parseFrontmatterLinks`; `normalizeFileUrl`; and the high-level
`updateFileUrlLinksInFile`/`updateFileUrlLinksInContent`.
**FOLLOW-UPS:** (1) FRONTMATTER external `file://` normalization — parsing + surfacing are DONE, but the converter
(`normalizeFileUrlLink`) and `shouldEditExternalLinks` are scoped to the note BODY only; frontmatter values need a
frontmatter-value-aware converter (emit a bare/normalized url, not a regenerated `[alias](url)` markdown link).
(2) The plugin wiring described under "After this lands".

The detailed design record below is kept as history.

**Origin:** `obsidian-better-markdown-links` FR <https://github.com/mnaoumov/obsidian-better-markdown-links/issues/35> — "Support `file:///` links". The plugin should be able to normalize external `file://` links into a pretty, angle-bracketed form. The plugin delegates ALL link parsing/conversion to this library, so the core work lives here; the plugin will only add a setting + wire the new converter once this lands. This section is the resumable plan — drive it from a session started in THIS repo.

**Scope (decided with the user):** `file://` scheme ONLY (leave `http(s)://` and other externals untouched).

**The issue's secondary `!`-escaping note turned out to be a backslash-separator artifact — SUBSUMED by this work, no dedicated logic needed** (verified via CDP 2026-07-09). A path separator `\` immediately before `!` (a folder/file name starting with `!`) forms `\!`, which markdown consumes as an escape and DROPS the separator, merging two path segments into a broken path. Confirmed: raw `\` sep breaks it even inside angle brackets and even when the bang is written `%21` (it's the SEPARATOR, not the bang); doubling to `\\!` works (the user's manual fix); and **forward-slash separators eliminate it entirely** (`/! dir/` has no `\!` sequence). Since the normalizer already converts `\`→`/`, a raw `!` in a normalized `file://` link is harmless and resolves correctly — no `!`-specific escaping required.

### Confirmed runtime behavior (Obsidian 1.13.1, Windows; verified via CDP + `obsidian-versions/obsidian.asar/main.js`)

- Renderer overrides `window.open`: only strings starting with `file:` are routed to the OS opener (`ipcRenderer.send('open-url', rawHref)`); anything else falls through to native `window.open` and does NOT open a local file. The click handler passes the raw `href` **attribute**. ⇒ **the `file://` scheme is mandatory**; a scheme-less path (`<F:/dir/x.txt>`) renders as a link but Obsidian will not follow it.
- Main process `open-url` (main.js `ipcMain.on('open-url', …)` → `$()` → `L()` → `shell.openPath`): `L(url)` = strip `^file:(\/\/)?`, drop a leading `/` on Windows, `decodeURIComponent`, `path.normalize`. So `%20`→space AND `%5C`→`\` both decode, and `/` vs `\` both normalize. **Every `file://` form resolves to the same path** and opens — the choice of slashes/encoding is purely cosmetic, not a correctness issue. (The user's current `%5C`+`%20` links already open; they're just ugly — that is the whole FR.)
- Parse/render: a raw space with NO angle brackets breaks the markdown link (won't render). Angle brackets `<…>` permit raw spaces (Obsidian encodes them to `%20` in the href attr).
- Vault-external files trigger a one-time "open external application?" warning dialog (format-independent, not plugin-controllable) — nothing to design around.

### Target normalized output (respect the existing angle-bracket / leading-slash options)

Always keep the `file://` scheme; convert backslashes → forward slashes; decode `%5C`.

- Angle brackets ON: `[x](<file:///F:/dir/My Notes/x.txt>)` — raw spaces, readable.
- Angle brackets OFF: `[x](file:///F:/dir/My%20Notes/x.txt)` — `%20`-encoded.

Both are confirmed to open correctly.

### Settled design (decided with the user 2026-07-09)

External `file://` links are invisible to the conversion pipeline because Obsidian's metadata cache
excludes ALL external links, and `getFileChanges` → `getAllLinks(cache)` only reads the cache. The
library's own `parseLinks(content)` DOES parse externals (with offsets). The chosen approach bakes
parsed externals into an extended cache object so the existing offset-splice pipeline handles them
with no new apply logic:

- **`CachedMetadataEx extends CachedMetadata`** adds `externalLinks: ParseLinkReference[]` (required —
  property PRESENCE means "computed with externals"; a note with none gets `externalLinks: []`).
  Guard: `isCachedMetadataEx(cache)` = `'externalLinks' in cache`.
- **`ParseLinkReference extends ReferenceCache`** (Obsidian type) adds `parseLinkResult: ParseLinkResult`.
  So it flows through `isReferenceCache` → `isContentChange` → offset splice unchanged, AND carries the
  full parse result so the normalizer reads `.isFileUrl`/`.url` with NO re-parse. Built with
  `link` = decoded `url`, `original` = `raw`, `displayText` = `alias`, `position` = offsets (line/col 0,
  as the frontmatter-offset path already does). Guard: `isParseLinkReference(ref)` = `'parseLinkResult' in ref`.
- **`getCacheSafe`/`parseMetadata` gain `{ shouldIncludeExternalLinks }`** (default false). When true they
  additionally `parseLinks` the content and attach `externalLinks`, returning a `CachedMetadataEx` at
  RUNTIME. Simple API — NO overloads; static return type stays `CachedMetadata | null`. **Must COPY, not
  mutate** Obsidian's cached object: `{ ...cache, externalLinks }` (`getCacheSafe` returns Obsidian's own
  object; `parseMetadata`'s `computeMetadataAsync` result is fresh and safe to attach to). `getCacheSafe`
  reads content via `cachedRead` only when the flag is on.
- **REVISED — features-enum model + `getLinks` (current, supersedes `getAllLinksEx`/required-arrays notes below):**
  - `getAllLinks(cache)` is RENAMED to `getLinks(params)` ("all" is misleading once toggles select subsets) —
    cache-driven ONLY (NO path/content: the `Ex` cache already carries externals). Params:
    `{ cache, shouldIncludeReferences?=true, shouldIncludeEmbeds?=true, shouldIncludeFrontmatterLinks?=true,
    shouldIncludeExternalLinks?=false, shouldIncludeFrontmatterExternalLinks?=false,
    shouldIncludeMultiValueFrontmatterExternalLinks?=false }`. Rename/delete callers just pass `getLinks({ cache })`.
  - `CachedMetadataEx` records WHAT was parsed via `readonly features: CachedMetadataExFeature[]`
    (enum `Native | ExternalLinks | FrontmatterExternalLinks | MultiValueFrontmatterExternalLinks`) plus THREE
    OPTIONAL link arrays (`externalLinks`, `frontmatterExternalLinks`, `multiValueFrontmatterExternalLinks`), each
    populated iff its feature is in `features`. `isCachedMetadataEx(cache)` = `'features' in cache`.
  - `getLinks` external selection is PER-KIND and throws if that kind wasn't parsed:
    `if (!isCachedMetadataEx(cache) || !cache.features.includes(<Feature>)) throw;` then
    `links.push(...ensureNonNullable(cache.<array>))`.
  - Five features: `Native` (Obsidian's native parse — internal links/embeds/frontmatter links; the baseline),
    `ExternalLinks` (body), `FrontmatterExternalLinks` (single-value fm external),
    `MultiValueFrontmatterExternalLinks` (multi-value fm external), `MultiValueFrontmatterLinks` (multi-value fm
    INTERNAL — which Obsidian does NOT natively cache). Four gated arrays (`externalLinks`,
    `frontmatterExternalLinks`, `multiValueFrontmatterExternalLinks`, `multiValueFrontmatterLinks`). Selection in
    `getLinks` uses a data-driven `FeatureLinkSelector[]` loop (keeps complexity ≤ 20).
  - **ALL functions that returned `CachedMetadata` now return `CachedMetadataEx`** (`getCacheSafe`, `parseMetadata`)
    with at least `features: [Native]` (`CachedMetadata` ↔ `CachedMetadataEx { features: [Native] }`). SCOPE of
    this sweep + its callers — confirm before implementing.
  - STATUS: DONE — `getLinks` (91a132d4); `Ex` sweep `getCacheSafe`/`parseMetadata` → `CachedMetadataEx` `[Native]`
    (71fb2517); `parseFrontmatterLinks` reusable frontmatter parser (e9788565); PARSING engine — `ParseCacheOptions`
    (`shouldParse{ExternalLinks,FrontmatterExternalLinks,MultiValueFrontmatterExternalLinks,MultiValueFrontmatterLinks}`)
    plus `toParsedCachedMetadataEx` + `parseExternalBodyLinks` (skips frontmatter region + internal) wired into
    `parseMetadata` (7544d1da). REMAINING: (a) wire the SAME options into `getCacheSafe` (needs a `cachedRead` for
    body content; restructure its two returns to a single parse tail); (b) thread parse + selection flags through
    `editLinks`/`editLinksInContent`/`getFileChanges`; (c) the `file://` normalizer + wiring.
- **Module cycle fix (A):** `parseLinks` lives in `link.ts`, which already imports `metadata-cache.ts`,
  so having `getCacheSafe` call `parseLinks` would close a cycle (`import-x/no-cycle` blocks it).
  Resolution: extract the parse cluster into a NEW leaf module `src/obsidian/parse-link.ts`
  (`parseLink`/`parseLinks`, `ParseLinkResult`, `ParseLinkReference` + guard, `encodeUrl`/`escapeAlias`/
  `unescapeAlias`, and the private parse helpers). Both `link.ts` and `metadata-cache.ts` import from it;
  it imports neither. NOTE: this moves public `parseLink`/`parseLinks`/`ParseLinkResult`/`encodeUrl`/… to a
  new import path — a breaking change (acceptable; this branch is a version bump).
- **`file://` normalizer + wiring:** library owns it (mechanism); plugin supplies only opt-in + the
  angle-bracket option (policy). The flag threads through `editLinks`/`editLinksInContent` →
  `getFileChanges` (which switches to `getAllLinksEx` + passes the fetched `Ex` cache). The normalizer
  reads the attached `parseLinkResult`, does `\`→`/` on the decoded url, filters to `file:` scheme,
  and emits via `generateRawMarkdownLink` (angle-bracket raw-space vs `%20` per the plugin's option).
  All external links are surfaced generically; the file://-only policy lives in the converter.
- **`toParseLinkReference({ content, parseLinkResult })`** builds the wrapper. `position` uses REAL
  line/col computed from `content` (`offsetToLoc` counts newlines before the offset) — NOT `line: 0`.
  So the wrapping needs the content string the offsets index into (whole note for body links; the
  frontmatter VALUE string for frontmatter links, where offsets are value-relative).
- **Comprehensive parsing-flag taxonomy (cover ALL parsing kinds).** On `getCacheSafe`/`parseMetadata`
  (each opt-in, default false): `shouldIncludeExternalLinks` (parse BODY externals → `externalLinks`);
  `shouldIncludeFrontmatterExternalLinks` (parse FRONTMATTER values for externals → append external
  `FrontmatterLinkCacheWithOffsets` to `frontmatterLinks`); `shouldParseMultiValueFrontmatterStrings`
  (parse frontmatter string values that hold MULTIPLE links — the `key: "url1 url2"` case — via per-value
  `parseLinks` + `isSingleLink = parseLinkResults[0]?.raw === value`, emitting offset-carrying
  `FrontmatterLinkCacheWithOffsets`). On `getAllLinksEx` (selection): `shouldIncludeReferences`/
  `shouldIncludeEmbeds`/`shouldIncludeFrontmatterLinks` (default true) + `shouldIncludeExternalLinks`
  (default false).
- **Frontmatter parsing logic must be REUSABLE** — `obsidian-frontmatter-markdown-links`'s
  `src/frontmatter-markdown-links-component.ts` `processFrontmatterLinks` (line ~371) is the reference
  implementation (per-value `parseLinks`, single-vs-multi `FrontmatterLinkCache`/`WithOffsets`, currently
  `continue`s on `isExternal`). The library helper added here should be general enough that plugin adopts
  it later (cross-repo; plan-then-hand-off), replacing its local copy.

### Increment checklist (each red-first, atomic, full gate: compile + test:coverage 100% + lint + format + spellcheck)

- [x] `feat: decode file:// URLs when parsing links` (decodeUrlSafely decodes file://; `isFileUrl` in url.ts). DONE (ed9cc8dd)
- [x] `feat: expose isFileUrl on ParseLinkResult`. DONE (f6bfc1a1)
- [x] Extract parse cluster into `src/obsidian/parse-link.ts` (pure move; behavior-identical; parse tests → `parse-link.test.ts`). DONE (d064ae53)
- [x] Add `ParseLinkReference` + `isParseLinkReference` + `toParseLinkReference` (real line/col via `offsetToLoc`). DONE (6de8ba84)
- [x] Add `CachedMetadataEx` (`externalLinks` + `frontmatterExternalLinks`) + `isCachedMetadataEx`, plus frontmatter reference types `ParseLinkFrontmatterReference` / `...WithOffsets` (latter extends former). DONE (b15e44c7)
- [ ] `getCacheSafe`/`parseMetadata` parsing flags → attach `externalLinks` (body) (copy-not-mutate).
- [ ] Frontmatter external + multi-value parsing (reusable helper; `shouldIncludeFrontmatterExternalLinks`, `shouldParseMultiValueFrontmatterStrings`) → attach `frontmatterExternalLinks`.
- [ ] `getAllLinksEx({ cache, …toggles })` with runtime Ex-throw.
- [ ] Thread flags through `getFileChanges` + `editLinks`/`editLinksInContent`.
- [ ] `file://` normalizer + wire as external-conversion behavior.

### Testing

- Unit tests (100% coverage) per increment. Real `file://` open behavior is ALREADY CDP-confirmed (routing
  plus `L()` resolution; notes in the plugin's memory `obsidian-file-link-resolution`) — no runtime re-check
  needed for the string transforms. Add an `*.obsidian.integration.test.ts` only if a round-trip is wanted.

### After this lands

Back in `obsidian-better-markdown-links` (separate session): add a "Normalize `file://` links" setting to `PluginSettings` + settings tab, and wire the new converter into the existing modify/save/navigation triggers and the convert-in-file/folder/vault commands.

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
