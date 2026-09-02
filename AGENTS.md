# AGENTS.md

## Project Overview

`obsidian-dev-utils` is a TypeScript utility library for Obsidian plugin development. It publishes as a dual-format (ESM + CJS) npm package.

## Commands

All npm scripts follow the `"alpha:bravo": "jiti scripts/alpha-bravo.ts"` pattern. Each script imports its command function directly from the relevant tool module (e.g., `linters/eslint.ts`, `formatters/dprint.ts`).

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
- `npm run build:compile` — compile: fans out to the svelte and TypeScript passes below
- `npm run build:compile:svelte` — type-check Svelte components with svelte-check. **The gate globs the
  Svelte extensions (`**/*.svelte`, `**/*.svelte.js`, `**/*.svelte.ts`) directly — never the tsconfig
  `include` patterns.** Globbing `include` and filtering the result for Svelte extensions is empty *by
  construction* (a tsconfig `include` lists `.ts` globs), so the step silently skipped in every consumer
  until 2026-09-02, T817. `node_modules`/`dist` are excluded explicitly because a tsconfig that sets
  `exclude` at all replaces TypeScript's default `node_modules` exclusion. A project that has Svelte files
  but does not declare `svelte-check` in its `package.json` now **fails** with an error naming it, rather
  than falling through to the package manager's exec form and downloading the tool mid-build. The
  declaration is read from `package.json`, not probed in `node_modules/.bin`, because a locally installed
  tool has no bin shim under yarn PnP.
- `npm run build:compile:typescript` — type-check with tsc
- `npm run build:templates` — copy consumer templates
- `npm run build:validate-templates` — type-check the copied consumer templates (needs `dist/lib` built)
- `npm run spellcheck` — spell check with cspell. **A `words` entry in `cspell.json` covers only that exact
  word — it carries no affix flags, so its inflections are separate unknown words.** `unhover` was listed and
  its `-s` form still failed the check (2026-09-01, T876). Prefer rewording over adding the inflection: the
  list is for domain terms, not for coinages a rewrite avoids. Note this bullet cannot spell out the example
  without failing the very check it documents.
- `npm run find-overexposed` / `find-overexposed:fix` — report (or narrow) declarations exposed more broadly
  than their references require. **It is NOT part of `lint` / `test` / `format` / `spellcheck`, but it IS one
  of `npm run version`'s preflight checks** — so a fully green branch gate can still fail at release time on
  it. Run it before releasing rather than discovering it there (2026-08-29, T677).
- `npm run commit` — guided commit via Commitizen
- `npm run version` — update version
- `npm run publish:npm` — publish the built package to NPM; runs in CI only (see [Releasing](#releasing))
- `npm run docs:dev` — start the documentation site dev server (Astro)
- `npm run docs:build` — build the documentation site to `docs/dist`, then validate its internal links, assets, and anchors offline plus its (deduplicated) external links for 404s (`scripts/docs-link-check.ts`)
- `npm run docs:preview` — serve the built documentation site locally

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
- `src/script-utils/package-manager.ts` — resolves how locally-installed tools and package scripts are invoked, so the library never assumes npm. `resolveToolCommand({ tool })` returns the `node_modules/.bin` shim (walking up to a hoisted workspace install), falling back to the owning manager's exec form (`npx` / `bun x` / `pnpm exec` / `yarn exec`) when no shim exists — the only path that works under yarn PnP. `getPackageManagerRunCommand()` does the same for package scripts. **Every tool invocation goes through it; do not add a bare `npx <tool>` call.** `npx` is npm-specific and does its *own* resolution rather than reading `node_modules/.bin`: under bun on Windows, where `bun install` writes `tsc.exe`/`tsc.bunx` and no `tsc.cmd`, `npx tsc` misses the local install entirely and downloads the `tsc` **decoy** package from the registry (`This is not the tsc command you are looking for`), which is why no ODU-based plugin could build under bun (T785). Detection prefers the lockfile (it describes the tree) over `npm_config_user_agent` (it only describes whoever launched us). `npm publish` / `npm pack` deliberately stay literal npm — they talk to the npm registry.
- `scripts/` — npm script entry points (executed via `jiti`), each wraps its call in `wrapCliTask()` for error handling and exit codes
- `templates/` — consumer-facing templates copied verbatim into `dist/templates/` by `build:templates` (so they ship in the package, copyable from `node_modules/obsidian-dev-utils/dist/templates`). A trailing `.template` on a source file name is stripped during the copy (e.g. `templates/eslint.config.mts.template` → `dist/templates/eslint.config.mts`), so an active config template can live in the repo under a name the corresponding tool does not auto-discover (only `eslint.config.mts` currently needs this — ESLint treats any `eslint.config.*` as a flat config). Two kinds of file live here:
  - Root config templates (`templates/commitlint.config.ts`, `templates/eslint.config.mts.template`, `templates/vitest.config.ts`, `templates/.markdownlint-cli2.mjs`, `templates/.nano-staged.mjs`, `templates/dprint.json`) — thin re-exports a consumer drops at their project root.
  - `templates/scripts/` — the script entry points a consumer drops in their `scripts/` folder. This holds both the per-tool example scripts grouped by category (`bundlers/`, `formatters/`, `linters/`, `test-runners/`, `build/`, `version/`) and the flat `*-config.ts` logic files that the root config templates re-export (`commitlint-config.ts`, `eslint-config.ts`, `vitest-config.ts`, `markdownlint-cli2-config.ts`, `nano-staged-config.ts`).
  - `templates/` is kept self-contained: every root config template resolves to a real `templates/scripts/*-config.ts`, so the imports never dangle. `commitlint-config`/`markdownlint-cli2-config`/`nano-staged-config`/`vitest-config` are pure re-exports (identical for every plugin); `eslint-config` is a generic baseline a consumer customizes.
  - **`templates/` is type-checked by `build:validate-templates`, and by nothing else.** It is outside `tsconfig.json`'s `include` and outside every ESLint `files` pattern (see `EslintConfigContext` in `src/script-utils/linters/eslint-config.ts` and the comment in `src/script-utils/nano-staged-config.ts`), because the templates import the library by its *published* specifier — `obsidian-dev-utils/…` — which cannot resolve in this repo. That gap is how 96.0.1 shipped a `templates/scripts/version/version.ts` calling `parseVersionArgs` after the library had renamed it to `parseVersionArguments`: the rename landed in the source but not in the template beside it, and the break surfaced only in a consumer's first release (2026-08-31, T754). `tsconfig.templates.json` closes it with a `paths` shim mapping `obsidian-dev-utils/*` onto the emitted `dist/lib/esm/*.d.mts` — the exact surface a consumer resolves, and self-contained by construction (that is what `build:validate-declarations` proves), so the templates program pulls in no `src/` file and no ambient augmentation. **Map the shim at the declarations, never at `src/*.ts`**: sources rely on global augmentations scattered across the main config's whole `include` list (`src/@types/**`, plus `Window` augmentations under `integration-test-plugin*/`), so a `src`-targeted shim reports errors that the main `tsc` pass does not. The step needs `dist/lib` built, hence its slot after `build:templates` in `scripts/build.ts`. Not covered: `templates/eslint.config.mts.template`, whose `.mts.template` suffix `tsc` will not treat as TypeScript.
- `src/script-utils/commitlint-config.ts` — shared commitlint configuration
- `src/script-utils/nano-staged-config.ts` — shared nano-staged pre-commit configuration
- `src/script-utils/test-runners/vitest-config.ts` — shared vitest configuration for Obsidian plugins (`defineObsidianPluginVitestConfig`)
- `dist/` — compiled output (ESM `.mjs` + CJS `.cjs` + type declarations)

### Documentation Site

The API-reference + guides site is a self-contained **Astro + Starlight** project deployed to **GitHub
Pages** at `https://mnaoumov.dev/obsidian-dev-utils/` (the `mnaoumov.dev` custom domain aliases
`mnaoumov.github.io`). It is NOT a separate npm package — its dependencies live in the root
`package.json` and it is driven by the root `docs:dev`/`docs:build`/`docs:preview` scripts.

- `astro.config.ts` (repo root) — the Astro config. `srcDir` is set to `./docs/src` so the site's
  source tree never collides with the library's own `src/`; `outDir` is `./docs/dist`, `site` is
  `https://mnaoumov.dev` and `base` is `/obsidian-dev-utils`. The Starlight integration uses
  `starlight-github-alerts` to render GitHub-style Markdown alerts as native Starlight asides.
- `docs/src/content.config.ts` — Starlight content-collection config.
- `docs/src/content/docs/` — site content: `index.mdx` (landing), `guides/` (the hand-written topic
  guides, each with Starlight frontmatter; co-located screenshots under `guides/images/` — the guides
  sidebar autogenerates from the directory), and the generated `api/` (gitignored — regenerated on
  every build).
- `scripts/docs-gen/` — the **custom** API-reference generator (there is no TypeDoc / `starlight-typedoc`
  in the pipeline). `generate-api-docs.ts` walks `src` with **ts-morph**, extracts every documentable
  exported declaration, and emits Starlight-compatible MDX plus a sidebar JSON; the output tree mirrors
  the library's module/subpath structure (a type's namespace is its source path relative to `src`). It
  reads each module's `@file` overview directly (`helpers/api-doc-jsdoc.ts`), so no
  `@packageDocumentation`/`@module` tag is needed. `generate-og-images.ts` renders the per-page OG
  images (satori). Paths are centralized in `helpers/api-doc-constants.ts`: output
  `docs/src/content/docs/api`, cache `…/api/.cache-hash`, sidebar `docs/src/generated-sidebar.json`,
  base path `/obsidian-dev-utils`. `DOCS_ROOT` overrides the repo root for out-of-tree runs. All three
  outputs are gitignored (`.gitignore:30-32`, the third being `docs/public/og`).
  **Every** generated page kind (module index, type overview, property, method) emits its frontmatter
  through the single `renderFrontMatter` helper in `helpers/api-doc-page-generation.ts`. `description`
  is not only the meta description — it is the line the OG card renders under the title, so a page kind
  that skips it produces a title-only card next to fully populated ones (module index pages did until
  the helper was introduced). A hand-written guide must therefore carry a `description` too, and a
  symbol with no TSDoc summary yields a title-only card no generator change can fix.
- **Tooling scope:** ESLint validates `astro.config.ts`, `docs/src/**/*.ts`, `docs/**/*.astro`, and the
  documentation generator under `scripts/docs-gen/`; `npm run lint` explicitly supplies the `.astro` glob
  because ESLint does not discover that extension by default. Markdownlint excludes the whole docs sub-project
  because Starlight's MDX follows its own conventions, while `astro build` validates the site. cspell excludes
  the generated `docs/src/content/docs/api`, `docs/dist`/`.astro`, `docs/src/components`, `docs/src/styles`,
  and `scripts/docs-gen`. `linkinator.config.json` skips the
  `mnaoumov.dev/obsidian-dev-utils` links (the site is not reachable until the first Pages deploy).
- `.github/workflows/build-pages.yml` — a release event dispatches a `workflow_dispatch` run on `main`,
  which builds and deploys the site to GitHub Pages. Its generated-docs cache includes the API pages,
  `docs/src/generated-sidebar.json`, and OG images; the generator only skips regeneration when its cache
  hash and sidebar file both exist. Requires Pages to be enabled with **GitHub Actions** as the source.

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
- **The integration-test harness plugin bundle is checked at build time for whether it can load on mobile.**
  `buildIntegrationTestPlugin` runs `assertMobileLoadableBundle`
  (`scripts/helpers/assert-mobile-loadable-bundle.ts`), which evaluates the emitted `main.js` in a
  `node:vm` context shaped like Obsidian mobile — `require` returns `undefined` for every Node builtin and
  a permissive stand-in for the app-provided externals, and `process` is present and renderer-shaped so a
  load-time branch (as in `debug`) takes the browser path a webview does. It asserts only that module
  INITIALIZATION survives, so L6's call-time dynamic `import()` of platform-only work still passes. It
  guards both outputs (`dist/integration-test-plugin/`, which ships, and `dist/dev/`), because that
  bundle is seeded into an Android integration vault, where a load-time reach for a platform-only API
  surfaces as an opaque "plugin failed to load" with every test in the project failing behind it.
- **That one check covers the whole library, which is why L5 can allow the barrels to re-export every
  module.** The harness plugin's entry imports `../src/index.ts` — the entire public surface — so its
  bundle is the worst-case consumer: a plugin that imports everything. Any module that stops being
  import-safe on mobile fails `npm run build` here, long before it reaches a phone. Do not weaken that
  entry to a narrower import; it is what makes the check load-bearing rather than incidental.

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
- **An `Async` suffix disambiguates, it does NOT mean "this returns a promise".** Add it only when a
  synchronous counterpart of the same name already exists and would otherwise collide. Being `async` is
  never on its own a reason for the suffix — measured 2026-07-31, ~18 suffixed members against ~179 async
  members without one, and **every** established use resolves a name collision: `onloadAsync` (Obsidian's
  `onload`), `hideAsync`, `triggerAsync`/`tryTriggerAsync`, `createDivAsync`/`createElAsync`/… (Obsidian's
  sync `createDiv`/`createEl`), `setTimeoutAsync`/`requestAnimationFrameAsync`/`setImmediateAsync`/
  `nextTickAsync` (the callback-based globals), `replaceAllAsync`
  (`String.replaceAll`), `noopAsync` (`noop`). (`invokeAsyncSafely` is not a counter-example — its `Async`
  is mid-name, describing what it invokes.) A `*Params` interface is named after its method, so it follows
  the method either way.

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
- The in-house rules live in `src/script-utils/linters/eslint-rules/`, are registered by
  `obsidian-dev-utils-plugin.ts`, and each has a `*.test.ts`: `manifest-description`, `manifest-id`,
  `manifest-name`, `manifest-schema`, `no-async-callback-to-unsafe-return`,
  `no-untrusted-input-events`, `no-unused-params-members`,
  `no-used-underscore-variables`, `params-options-name-match`, `prefer-noop-async`,
  `readonly-params-options-result-members`, `require-component-suffix`, `require-method-template`,
  `require-super-call`. The TypeScript rules use `@typescript-eslint/rule-tester` via
  `rule-tester-helper.ts`; the four `manifest-*` rules use ESLint's own `RuleTester` with
  `{ language: 'json/json', plugins: { json: jsonPlugin } }`.
- **ESLint covers the root `manifest.json` and `LICENSE`** (`getManifestConfigs` / `getLicenseConfigs` in
  `src/script-utils/linters/eslint-config.ts`), which nothing linted before. Three things about that are
  worth not rediscovering:
  - **`obsidianmd/validate-manifest` can never fire, whatever it is scoped to.** It registers a `Program`
    visitor and expects an ESTree `ObjectExpression`; `@eslint/json`'s `json/json` language produces a
    Momoa `Document`, and `jsonc-eslint-parser` produces `JSONObjectExpression`. Measured on
    `eslint-plugin-obsidianmd@0.4.2` against a manifest violating nearly every check: zero messages. The
    four in-house `manifest-*` rules exist because of this, not to duplicate it.
  - **`manifest.json` is strict JSON, so a check can only be waived in the config.** A comment there is a
    parse error and would stop Obsidian loading the plugin; an ignore *key* would ship to users and is
    itself reported as a disallowed key. That is why the checks are split across four rules — a repo with
    a grandfathered `id` turns off `manifest-id` alone. ESLint 10's `eslint-suppressions.json` is the
    other option, but the config has room for the written justification the directory review needs.
  - **`obsidianmd/validate-license` needs the LICENSE line in its own shape.** Its regex wants
    `Copyright (C) <year>[-<year>] by <holder>`; a conventional `Copyright (c) 2024 <holder>` matches
    nothing, so the rule silently passes. Its year check runs against `new Date().getFullYear()` at lint
    time, so `.github/workflows/update-license-year.yml` bumps the end year on 1 January — a repo
    adopting this config needs that workflow too, or its CI fails at the turn of the year. It also needs
    the plugin's unexported `PlainTextParser`, reached through `dist/`.
- **ODU's own root `manifest.json` is a stub kept for `eslint-plugin-obsidianmd`, not a plugin manifest.**
  It arrived with the plugin in `7858d3c3`, its `version` is frozen at `1.0.0`, and `version.ts` already
  decides `isObsidianPlugin = packageJson.name !== 'obsidian-dev-utils'`. Do not delete it: the plugin's
  `no-nodejs-modules` rule is configured as `manifest && manifest.isDesktopOnly ? 'off' : 'warn'`, so
  removing the manifest turns it on across every `node:*` import under `src/script-utils/**` (and adds a
  `Failed to load JSON file:` line to every lint run). It is linted like any other manifest so the rules
  are exercised end to end here.
- The shared config extends **`eslint-plugin-unicorn`'s `recommended`** preset
  (`getUnicornConfigs()` in `src/script-utils/linters/eslint-config.ts`), adopted repo-wide in
  `7808eeb1`. It is a curated adoption, not a blanket one: a long explicit off-list turns off the rules
  that fight this codebase, and `unicorn/name-replacements` carries custom replacements because unicorn
  substitutes at the word level inside compound names.
- **File-name casing is `unicorn/filename-case`'s job — do not re-add an in-house rule for it.** The
  migration above initially kept `obsidian-dev-utils/kebab-case-file-name` alongside it, so every bad
  name was reported twice; it was deleted once measured. `unicorn/filename-case` arrives enabled with
  the `recommended` preset (nothing here turns it off) and defaults to `case: 'kebabCase'`, and it
  already does everything the in-house rule did: `multipleFileExtensions` (default on) makes it judge
  only the part before the FIRST dot, so `alpha.obsidian.integration.test.ts` reduces to `alpha` exactly
  as before. It additionally checks DIRECTORY names, which the in-house rule never did. The only
  divergence is that unicorn exempts a name starting with `$` (`filename.startsWith('$')`) — no such
  file exists here. The in-house rule's other claimed edge, stripping a leading dot so
  `.markdownlint-cli2.mjs` is judged as `markdownlint-cli2`, never actually ran: root dotfiles are not
  in `EslintConfigContext.allFiles()` (test + script + source files plus three named root configs), so
  no rule sees them.

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

### L4. Trusted-input & layout helpers are hand-synced with `obsidian-integration-testing`

- `src/obsidian/desktop-trusted-input.ts` (`typeIntoEditor`, `pressKey`, `moveMouse`, `clickMouse`, `hoverElement`, `unhoverElement`, `clickElement`) and `ensureLayoutReady` (`src/obsidian/workspace.ts`) are importable-module **twins** of helpers the `obsidian-integration-testing` harness seeds into its `evalInObsidian` `lib` bag (its `namespace-bootstrap.ts`). `errorToString` (`src/error.ts`) is likewise mirrored by the harness's own error-to-string helper. The harness must never depend on this library, so each is an intentional **duplicate kept in sync by hand — there is no automated drift check.** Any behavior change to one of these helpers must be mirrored in the harness in the same coordinated cross-repo change (and vice-versa); the harness carries the counterpart rule.
- **The mobile twin is the exception that proves the rule: it delegates instead of duplicating.** `src/obsidian/mobile-trusted-input.ts` calls `window.__obsidianIntegrationTesting.trustedInput.*` — the seam the harness publishes on its namespace (`namespace-bootstrap.ts`), holding the very function objects it seeds into a closure's `lib` bag. A phone has no in-renderer route to a trusted event, so the injection is a round-trip to the host over the harness's Appium-transport channel; duplicating that wire format here would make the library monkey-patch the harness, inverting this rule's own "the harness must never depend on this library". Delegating keeps the mobile semantics (tap, long-press for `button: 'right'`, a throw for `'middle'`, the accepted `pressKey` key set, and the throws for the `:hover` helpers) identical for free. **The namespace shape is declared LOCALLY in that module** — the harness is not a dependency in either direction, at runtime or in types, and the harness deliberately publishes no exported mirror of its namespace shape for anyone to import.
- The copies are deliberately **not byte-identical** (a serialized closure vs a real module): here they call the ambient global `sleep(ms)`, read `Platform.isMacOS` via `import { Platform } from 'obsidian'`, and the pointer primitive is folded into `moveMouse` (no separate `moveMouseTo`); the harness closure instead uses its runtime `sleep` / `ns.obsidianModule`. So the sync obligation is **behavioral**, not textual.
- **All seven are `Promise<void>` on both sides, and the peer range is `^12.0.0` — a floor, not a preference.** The harness majored first (OIT `12.0.0`) and this library followed, which is the only order that compiles: `interface Lib extends MergedLib` makes this library's signatures the derived ones, `() => Promise<void>` is assignable to a `() => void` base but not the reverse, so a new `Promise<void>` copy here against an installed OIT 11 still typing them `void` is **TS2430**. Admitting `^11.0.0` would also be a claim the mobile arm cannot honour — it calls a namespace seam only 12 has. Nothing about the desktop arm needs to await anything; the `async` is the cross-platform **contract**, so a suite growing a mobile lane never rewrites its `await`s (hence the `@typescript-eslint/require-await` disables).
- (cannot be forced by ESLint — a cross-repo hand-sync convention)

### L5. Platform-only modules carry a `desktop-` / `mobile-` filename prefix

- A module that only works on (or is only meant for) **desktop** must have a `desktop-` filename
  prefix; a **mobile**-only module must have a `mobile-` prefix. The prefix marks the file, not its
  exports — e.g. `desktop-trusted-input.ts` exports `typeIntoEditor`, not `desktopTypeIntoEditor`.
- "Platform-only" means the module directly uses a platform-restricted API (Node builtins,
  `window.electron`, mobile-only APIs) at the **top level** (so importing the module loads that API).
  Examples: `desktop-trusted-input.ts` (`window.electron` trusted input), `desktop-demo-vault-opener.ts`
  (`node:fs`/`node:os` + `window.electron`). A module using only cross-platform APIs at the top level
  gets no prefix — e.g. `community-plugins.ts` (uses `requestUrl`), and `open-demo-vault-command-handler.ts`,
  which is desktop-*gated* but stays cross-platform-loadable by dynamic-importing the desktop-only opener
  (see **L6**).
- **The prefix restricts where a module may be CALLED, never whether it may be IMPORTED — every module
  in `src/` must survive being imported on either platform.** The generated barrels (`src/**/index.ts`,
  `src/__merged.ts`) re-export **every** leaf they find, and `src/index.ts` pulls in both, so anything
  under `src/` is on the load path of every consumer that imports a namespace — and of the
  integration-test harness plugin, which loads the whole library on a phone. A `desktop-` name therefore
  buys no exemption from being loaded there; it only says "calling this on mobile is a bug".
  `desktop-trusted-input.ts` is the model: it names `window.electron` only *inside* its functions, so
  importing it on mobile is inert.
- **So a platform-only dependency that runs code while INITIALIZING must be dynamically imported.** A
  static `import { existsSync } from 'node:fs'` is fine (mobile's `require` returns `undefined` and
  nothing reads it at load time), but a dependency whose own top level *evaluates* a platform-only API is
  not. `adm-zip` opens with `const { randomFillSync } = require('crypto')`, so a static
  `import AdmZip from 'adm-zip'` in `desktop-demo-vault-opener.ts` threw during barrel initialization and
  killed the harness plugin's load on Android — every test in its `integration-tests:android` project
  failed behind an opaque "plugin failed to load". That opener no longer depends on it at all:
  extraction moved to `desktop-zip-extractor.ts`, which needs only `node:zlib`. The rule stands for the
  next such dependency — defer it behind a call-time `import()`, or do without it.
- **A dependency on the plugin-runtime path costs every consumer's bundle, and a dynamic `import()` does
  NOT buy it back.** An Obsidian plugin ships one CJS `main.js`, esbuild has no code splitting to put a
  chunk behind, and `await import()` only defers EVALUATION — the module body is inlined either way.
  Measured 2026-08-31 in `obsidian-fix-tab-size`'s 247 KB bundle: the demo-vault opener and the `adm-zip`
  it then imported took ~41 KB of it, ~17%, in a plugin that opens no archives of its own. Prefer a Node
  builtin (already `external`, so free) over a dependency for anything reachable from `src/obsidian/`.
- `mobile-trusted-input.ts` is the `mobile-` example: it reads `window.__obsidianIntegrationTesting`, a
  global only the integration-testing harness installs, and calling it anywhere else throws. Like its
  `desktop-` twin it names that global only *inside* its functions, so importing it on desktop is inert —
  which it has to be, since the barrels put it on every consumer's load path.
- (the naming half cannot be forced by ESLint — a custom check could flag `node:`/`window.electron` usage
  in a non-`desktop-` file. The **import-safety** half IS enforced, by the mobile-load check on the
  harness plugin bundle described under **Build** — that bundle imports the entire library, so it stands
  in for the worst-case consumer.)

### L6. Public-facing APIs must be cross-platform-loadable — internalize the platform split

- No **public-facing** API (anything a consuming plugin imports and uses — a command handler, a
  component, a helper it registers) may force the consumer to write a platform check
  (`if (Platform.isDesktop) { … }`) or a dynamic `import()` around it. That is too much hassle and leaks
  an implementation detail. The public entry point must be **cross-platform-loadable**: importing it
  never loads a platform-only module, so a plugin registers it directly (`new FooCommandHandler({ … })`)
  on any platform.
- The library **internalizes the platform split**: the public module keeps only cross-platform top-level
  imports, and defers the desktop-/mobile-only work to a `Platform`-gated **dynamic `import()`** of a
  `desktop-`/`mobile-` prefixed module (L5) at **call time** — inside a method that only runs on the
  right platform. This is the library-owned counterpart to the consumer-side R1 rule (a dual-platform
  plugin reaching a `desktop-*` module uses a dynamic import); here the library does it so the consumer
  never has to.
- Reference: `OpenDemoVaultCommandHandler` (`command-handlers/open-demo-vault-command-handler.ts`, no
  prefix) is registered directly by any plugin; its `canExecute` gates on `Platform.isDesktopApp` (so the
  command hides on mobile and `execute` runs only on desktop), and `execute` does
  `const { openDemoVault } = await import('../desktop-demo-vault-opener.ts')` — so the desktop-only
  opener (static `node:fs` imports) is never on the mobile load path, yet the consumer writes no platform
  guard. The dynamic `import()` needs no `eslint-disable` (the `no-restricted-syntax` `ImportExpression`
  ban was removed from the shared config — see R2 G10a); keep the literal path so esbuild can bundle it.
- **Second reference — a facade over BOTH arms, and the flat-barrel rule it needs.** `trusted-input.ts`
  (no prefix) exports the same seven helper names as `desktop-trusted-input.ts` and
  `mobile-trusted-input.ts`, and each one dispatches through a `Platform.isDesktopApp`-gated call-time
  `import()` of the arm that fits. Unlike the demo-vault case there is no `canExecute` to hide the
  command on the wrong platform, so the dispatch happens per call, in the helper itself.
  - **That trio is a name collision in the flat barrel**, which is one namespace — and L5 forbids the
    obvious escape ("the prefix marks the file, not its exports", so no `desktopPressKey`). So
    `scripts/build-generate-merged.ts` **supersedes**: when an unprefixed module has a `desktop-` /
    `mobile-` prefixed sibling of the same name in the same directory, the barrel exports the facade and
    skips the twins. `lib.pressKey` inside an `evalInObsidian` closure is then platform-correct, both
    published subpaths stay importable, and no export is renamed. The per-directory `index.ts` barrels
    need none of this — they re-export namespaced (`export * as 'desktop-trusted-input'`), so a
    same-named sibling never collides there.
  - **A facade may supersede its twins only if it exports every value name they do**, and the generator
    throws otherwise (`scripts/helpers/module-supersession.ts`). Without that invariant a twin that later
    grows an export the facade lacks would silently vanish from the flat bag instead of failing the
    build. A prefixed module with no facade — `desktop-demo-vault-opener.ts` — supersedes nothing and
    reaches the barrel on its own.
- The rule constrains what the library **forces**, not what a consumer **may** import. A consumer is
  free to import a `desktop-*` / `mobile-*` module directly — that is a **deliberate platform
  commitment**: correct for a desktop-only plugin (or a G80 facade), and a knowingly-wrong choice for a
  cross-platform plugin (it will break that plugin's load on the other platform). What L6 forbids is the
  library shipping its **cross-platform-intended** public API as a `desktop-*`/`mobile-*` module, thereby
  forcing every consumer into a platform guard. So: prefer a cross-platform facade as the primary,
  documented entry point; still expose the `desktop-*`/`mobile-*` modules for consumers who deliberately
  opt in.
- (cannot be forced by ESLint — an API-design convention)

### L7. Register/unregister commands by their pre-registration id (Obsidian mutates `command.id`)

- Obsidian's `Plugin.addCommand(command)` **mutates the passed object**, prefixing `command.id` (and
  `command.name`) with the plugin id/name; `Plugin.removeCommand(commandId)` then **re-prefixes** the id
  it is handed. So a command must be removed by its ORIGINAL, unprefixed id — the id it had **before**
  `addCommand`. Reading `command.id` *after* registration yields the already-prefixed id, which
  `removeCommand` prefixes again, so the command is never removed (a silent leak).
- `CommandHandlerComponent.registerCommandHandlers` captures the id before `addCommand` for exactly this
  reason. Any other add/remove pairing routed through a `CommandRegistrar` / `Plugin` must do the same.
- The `obsidian-test-mocks` `Plugin` does NOT prefix ids, so a unit test cannot catch this — it only
  surfaces against real Obsidian. Confirm command register/unregister with a
  `*.obsidian.integration.test.ts` using the real `PluginCommandRegistrar` (via the harness plugin
  `obsidian-dev-utils-integration-test`) and asserting on `app.commands.commands['<pluginId>:<id>']`.
  This is exactly how the leak in the ad-hoc `registerCommandHandlers` was found and fixed.
- (cannot be forced by ESLint — a runtime-behavior gotcha; a custom rule could flag reading `command.id`
  after an `addCommand` call, but not reliably)

### L8. Re-export a type from an ESM-only package through its `import type`, never `export … from`

- `build:validate-declarations` type-checks the emitted `dist/lib/cjs/**/*.d.cts` under CJS resolution.
  There, any reference to an **ESM-only** dependency (`type-fest`, and anything else without a CJS entry)
  fails with **TS1479** unless the module specifier carries `with { 'resolution-mode': 'import' }`.
- TypeScript's declaration emit adds that attribute **only to import declarations**. It does NOT add it to
  a re-export, so `export type { PackageJson } from 'type-fest';` compiles fine in `src/` and then fails
  the `.d.cts` validation — a break invisible to `lint`, `test`, and `build:compile:typescript`.
- Re-export the binding already imported at the top of the file instead
  (`import type { PackageJson } from 'type-fest';` … `export type { PackageJson };`). The resolution mode
  stays attached to the import, and both the `.d.cts` and `.d.mts` emit the bare `export type { … };`.
- `unicorn/prefer-export-from` actively pushes back toward the broken form, so the re-export needs an
  `// eslint-disable-next-line unicorn/prefer-export-from -- …` naming this reason. See
  `src/script-utils/npm.ts` for the reference case.
- (cannot be forced by ESLint — the opposing rule is the one ESLint has; `build:validate-declarations` is
  the check that catches it)

### L9. Another plugin's API: the registry when it publishes one, hand-declared narrow types otherwise — never a build-time dependency

- **When the other plugin publishes through the registry, use the registry.** `publishPluginApi` /
  `watchPluginApi` (`src/obsidian/plugin/plugin-api.ts`) are this library's own protocol for cross-plugin
  APIs, and they generalize everything below into one mechanism: records keyed by `manifest.id`, semver
  contract-version negotiation, a revocable handle that names its provider instead of null-dereferencing,
  a `PluginApiUnavailabilityReason` that tells the five failure causes apart, and debug-gated Standard
  Schema payload validation. The live `PluginApiRef` is what replaces the layout-ready timing dance below:
  its `value` starts `null` and becomes correct on its own, so there is nothing to time. The rest of this
  rule is the fallback for the (currently universal) case of a plugin that publishes nothing.
- **The registry record is a WIRE FORMAT between different `obsidian-dev-utils` copies**, since every plugin
  bundles its own. Nothing crossing it may be `instanceof`-checked — plain data and plain functions only,
  read structurally. `src/obsidian/plugin/plugin-api.obsidian.integration.test.ts` is the test that would
  actually catch a violation; a unit test cannot, because it has only one copy of the library.
- A plugin whose surface this library integrates with (today: Notebook Navigator, see
  `src/obsidian/notebook-navigator.ts`; `folder-notes`, whose folder-note settings
  `src/obsidian/folder-note.ts` reads; and Templater, whose UNDOCUMENTED internals
  `src/obsidian/templater.ts` wraps) is reached through `app.plugins.getPlugin(<id>)` and typed by
  **interfaces declared here**, narrowed to the members actually called. Do NOT add the other plugin as
  a dependency — most ship a `.d.ts` for download rather than an npm package, and depending on one
  turns an optional integration into a build requirement. This mirrors the vendored
  `src/obsidian/@types/dataview/**`, minus the vendored tree when the used slice is small.
- The value arrives as `unknown`, so narrow it with a **runtime type-guard predicate**, never an `as`
  cast (R1 G43). A version that predates the API, renames it, or breaks it then reads as "not there"
  and the integration stays dormant, instead of throwing while the user's context menu is opening.
- **Binding to UNDOCUMENTED internals is a further step, and it ships in two tiers or not at all.**
  Templater publishes nothing — not through this registry, not as a documented API — so
  `src/obsidian/templater.ts` reads `plugin.templater`, which no version guarantee covers. Where that
  trade-off is taken deliberately (owner's call, T689), the module says so in its `@file` block, NAMES
  the Templater version its shapes were read from, and exposes BOTH a `resolve…Api` returning `null`
  (for an optional integration) and a `require…Api` throwing a named error carrying a
  `…UnavailabilityReason` (for a caller that cannot carry on without it). What is never acceptable is
  the middle ground: an `as` cast that fails somewhere deep inside the other plugin with no name
  attached to it.
- Bind at **layout-ready**, not `onload`: plugin load order is not ours to choose, and the other
  plugin's API only exists once it is up.
- **Menu surfaces plug in as additional `MenuEventRegistrar`s.** `CommandHandlerComponent` takes
  `additionalMenuEventRegistrars` and calls the `CommandHandlerFactory` once per surface, so a plugin
  declares its handlers ONCE. The extra passes add no commands (the palette already has them) and
  carry `CommandHandlerRegistrationContext.shouldAddCommandToSubmenu: false`, because such a bridge
  wraps everything in its own plugin-titled parent entry — a handler's own section submenu would make
  `Menu.sort()` nest a second, identical entry inside the first. Each surface needs its OWN handler
  instances: a handler carries per-registration state, which is exactly why the API is a factory.
- (cannot be forced by ESLint — an API-integration convention)

### L10. Never hold a phantom file registration across an `await` during a rename

- `registerFiles` (`obsidian/metadata-cache.ts`) makes a **non-existing** path resolve again, by putting a
  phantom `TFile` into `vault.fileMap` + `metadataCache.uniqueFileLookup`. That is exactly what
  Obsidian's own post-rename link update consults, so a live phantom is not inert — it changes core's
  answer.
- `FileManager.runAsyncLinkUpdate()` snapshots each reference's resolved paths, `await`s the handler
  (which performs the rename), then in its `finally` sets `inProgressUpdates = null` and **immediately**
  calls `updateAllLinks()`, which rewrites a link only when `getLinkpathDest()` now returns an empty or
  different path set. That per-link decision is **synchronous** — nothing else can interleave once it
  starts. So a registration confined to a synchronous span is invisible to it; one held across an
  `await` is not, and while it is live the old path still resolves, core concludes "unchanged", and
  **nothing rewrites the link** — a silent data-consistency bug, not an error.
- Two ways to stay safe, in order of preference: (a) keep the registration inside a purely synchronous
  span (this is why `getBacklinksForFileOrPath` registers and reads without awaiting); (b) when the
  work in between is unavoidably async — a consumer-supplied attachment-path callback, a backlink
  fetch — `await waitForPendingLinkUpdates(app)` (`obsidian/file-manager.ts`) **first**. Observing
  `inProgressUpdates === null` proves core has already decided, precisely because of the ordering above.
- `RenameHandler.handle()` awaits it unconditionally for this reason. The invariant is one sentence:
  *never touch the vault index while Obsidian is mid-decision.*
- A unit test cannot see this — it is a microtask race against real Obsidian. Cover it with an
  `*.obsidian.integration.test.ts` asserting the link was rewritten, and confirm the test is **red
  before the fix**; a race that happens to pass proves nothing. See
  [#47](https://github.com/mnaoumov/obsidian-custom-attachment-location/issues/47).
- (cannot be forced by ESLint — a custom rule could flag an `await` inside the scope of a
  `using … = registerFiles(…)`, which would catch the common shape but not the cross-operation case)

### L11. A path-keyed registry must be re-keyed on rename — and so must everything derived from it

- A vault path is a **name, not an identity**: a rename changes it while the resource stays the same.
  Any long-lived structure keyed by path (today: `ResourceLockManager.lockEntriesByPath`) must move its
  entry — and every **descendant** entry, since a folder rename changes a whole prefix — when the path
  is renamed, or it silently stops describing anything. Subscribe to `vault.on('rename')` and re-key
  **before** the handler's other work, so the rest of it sees where things actually are.
- Re-keying the map is the easy half; what breaks is everything that **captured a path**. When
  `ResourceLockManager` was fixed, three separate captures had to move with it, and each was its own
  bug: a sibling registry of path strings (`bypassPathSets` — leaving it behind inverts the defect, so
  the owner's own mutations start reading as intruders), a captured path inside the release closure
  (release silently no-ops → the lock leaks forever, which is worse than the original symptom), and a
  captured path inside a UI element's click handler (`assertNonNullable` throws when the user clicks).
  So the checklist is: **grep for every place that path was stored or closed over**, and either re-key
  it too or make it resolve at use time. Prefer resolve-at-use-time — a mutable `path` on the entry, a
  `() => resolve(view.file?.path)` getter — over another thing to remember to re-key.
- Make the re-key **idempotent** (a path that no longer matches is left alone). Obsidian's event order
  for a folder rename vs its descendants' is not a contract, and a consumer's own
  `vault.on('rename')` may run before or after ours. Anything order-dependent works in the test and
  fails in the field. Reconcile **unconditionally** after a rename, not only when a key moved:
  coverage also changes when a resource is renamed *into* or *out of* a subtree-scoped entry.
- A unit test with the mock vault covers the branches, but only an `*.obsidian.integration.test.ts`
  replaying the real sequence proves the event ordering — and it must be **red before the fix**. See
  the folder-swap case in `resource-lock.obsidian.integration.test.ts`, and
  [#49](https://github.com/mnaoumov/obsidian-custom-attachment-location/issues/49).
- (cannot be forced by ESLint — a design invariant; a custom rule could flag a `Map`/`Set` field whose
  name ends in `ByPath` in a class with no `vault.on('rename')` subscription, but not the captures)

### L12. Do not read an unofficial member of a consumer-supplied object on a hot path

- A member that only `@obsidian-typings` declares (`Modal.bgEl`, `App.setting`, …) type-checks fine here,
  but the objects this library is *handed* by a consumer are, in that consumer's unit tests,
  `obsidian-test-mocks` doubles — and every one is a `strictProxy` that **throws** on an unmocked string
  read (R1 G90), not one that returns `undefined`. The mocks model the official surface; the unofficial
  members are mostly absent. So reading one turns every consumer's unit test into a crash we caused.
- The cost scales with how often the read runs. A read inside an **event handler** installed on a
  consumer's object is the worst case: it fires on interactions the consumer's tests already simulate,
  in tests that have nothing to do with the feature. `MinimizableModal`'s background-click guard was
  planned as `$event.target === modal.bgEl` and would have thrown on *any* click inside *any* wrapped
  modal, in this repo's tests and in every plugin's.
- Prefer an equivalent expressed in **official** members: DOM structure (`composedPath().includes(modalEl)`,
  `containerEl`) usually pins down the same element as the unofficial handle. Prefer `composedPath()` over
  `contains($event.target)` / `instanceof HTMLElement` — it needs no cast and stays correct in popout
  windows, where an `instanceof` against another realm's constructor is false (see
  `src/obsidian/popovers/popover.ts`).
- Reading one is still fine where the consumer cannot be caught in the blast radius: a one-shot read this
  library performs on an object **it constructed**, or one behind an explicit opt-in. When there is no
  official equivalent at all, teach `obsidian-test-mocks` the member instead of casting around it — and
  remember that lands on consumers only after they bump it.
- (cannot be forced by ESLint — a custom rule could flag member reads whose declaration file lives in
  `@obsidian-typings`, via `ts-declaration-location`, but not the "hot path" judgment)

### L13. A listener cannot protect data from a destructive action — intercept the primitive

- `RenameDeleteHandlerComponent` is otherwise purely reactive (`vault.on('delete')`, `vault.on('rename')`,
  `metadataCache.on('deleted')`), and for a *note* deletion that is enough: the note is gone but its
  attachments are not, so `deleteIfNotUsed` can still decide their fate afterwards. For a *folder* deletion
  it is not — Obsidian reports the folder only once its children are already destroyed, so there is nothing
  left to protect. The event tells you what happened, never what is about to. Whenever the thing at risk is
  destroyed *by* the event, the hook has to be a patch on the primitive, not a listener.
- **Patch every primitive that can perform the action, and remember they nest.** A folder deletion arrives
  through `FileManager.trashFile` (the file-explorer Delete flow, via `promptForDeletion`) *and* through the
  raw `Vault.delete` / `Vault.trash` a plugin may call directly — and `trashFile` itself calls down into the
  other two. So one user action fires several patches. Guard with a **path-scoped** in-flight set, not a
  boolean flag, or a concurrent unrelated deletion interleaving on an `await` loses its protection.
- **Do the work through the intercepted primitive's unpatched original** (`originalMethodBound`). It keeps
  the caller's semantics — `vault.delete` is permanent, `vault.trash` is not, and routing both through
  `trashSafe` would silently change which one the user gets — and it makes re-entry into your own patch
  impossible by construction rather than by bookkeeping.
- **Scan first; when nothing is at risk, call `fallback()` and let the native action run untouched.** This is
  what makes patching a shared primitive safe: the overwhelming majority of deletions behave exactly as they
  did before, and only the rare one that would lose data takes your replacement path. It also dodges the
  trap that `deleteIfNotUsed` refuses to remove a folder containing anything Obsidian does not track, which
  would otherwise turn ordinary folder deletions into silent no-ops.
- **A protection that cannot be overridden is a bug of its own.** `deleteIfNotUsed` keeps *any* still-
  referenced file, so handing it a whole folder would preserve every note inside that anything else links
  to — making a folder of linked-to notes undeletable. Obsidian's own answer is to leave a dangling link,
  so notes are exempted via `shouldProtectIfStillUsed`. Ask what the feature makes *impossible*, not only
  what it makes safe.
- Prove it with a **negative control**: detach the patch and confirm the integration test goes red on every
  primitive, and that the "deletes normally" control stays green. A protection test that passes because
  nothing was ever at risk asserts nothing.

### L14. Never drive the user's workspace to obtain a runtime handle — supply the missing half yourself

- Reaching an unofficial Obsidian internal by **making the app do something** (open a leaf, open a file,
  render a view) so a monkey-patch can intercept what it passes around is not a neutral read: it is a
  mutation of the user's workspace, and it lands on **every consumer, on every load**.
  `getDomEventsHandlersConstructor` did exactly that to obtain the `DomEventsHandlers` class —
  `getLeaf(true)` + `openFile(…, { active: true, state: { mode: 'preview' } })`, a 5 s
  `retryWithTimeout`, `leaf.detach()`, and `__temp.md` created and trashed in an empty vault. Measured
  cost per plugin load, desktop and Android alike: leaf count 9 → 10 → 9, two `file-open` and two
  `active-leaf-change` cascading into every other plugin, and an unrelated note rendered in preview.
  A consumer could not opt out (the memoised constructor is module-private), so the only lever was
  *when* the dance ran — which is why it ping-ponged between the first dialog and plugin load.
- **Look for the seam first: how much of the internal do you actually need?** Obsidian's link handling
  is two separable halves — `MarkdownPreviewRenderer.registerDomEvents(el, handlers)` does the
  **delegation** (which element was hit, which link text it carries, `belongsToMe` scoping, and the
  `a.internal-link` / `a.footnote-link` / `a.external-link` / `a.tag` / `img,video` cases), and the
  `handlers` object does the **behavior**. Only the second half was private. Porting those seven
  methods (`markdown.ts`'s `LinkDomEventsHandlers`) removed the leaf entirely while keeping every
  delegation case, which hand-wiring a bare `createEl('a')` + click listener would have silently
  dropped.
- **Port from the shipped bundle, not from memory.** The reference implementation is readable in
  `%APPDATA%\obsidian\obsidian-<version>.asar` (`grep -aob '<methodName>'`, then `dd` a window around
  the offset). Substitute house helpers where Obsidian reaches for its own privates (`isUrl` for its
  `new URL(…)` probe; an `obsidianDevUtils.*` i18n key for its own catalog, which our typed `t()`
  cannot address).
- The cost of the port is that the copy can drift from Obsidian's original. That is the trade: a
  behavior that may lag a version against a workspace mutation every consumer pays on every load.
  Pin it down with integration assertions on the **contract** — the `hover-link` payload, the URL
  handed to `win.open`, the `tag:` query — not on Obsidian's internals.
- **The assertion that catches this class of bug is a workspace-invariance snapshot**: leaf count via
  `iterateAllLeaves`, the active file, and `active-leaf-change` / `file-open` counters taken around the
  call, plus `vault.getFiles().length` for the file-writing half. Prove it with a **negative control** —
  restore the extraction and confirm the leaf assertion goes red; a leaf-count assertion is exactly the
  kind that passes vacuously.
- (cannot be forced by ESLint — a custom rule could flag `getLeaf(` / `openFile(` inside a module whose
  purpose is extraction, but not the judgment)

### L15. A function serialized into the emitted banner may only reference its own module — and `globalThis` stays spelled out

- `preprocess-plugin.ts` ships code as **text**: `makeBanner()` builds the esbuild banner out
  of `String(fn)`, so what lands in every consumer's bundle is source text, not a linked module. Two
  consequences that no type-check or unit test catches, because both are correct in the builder process
  and wrong only in the emitted artifact:
- **Cross-module calls do not survive.** esbuild compiles an imported call to `(0, import_module.fn)(…)`
  in the CJS dist — `makeValidVariableName` appears exactly that way in
  `dist/lib/cjs/script-utils/bundlers/esbuild-impl/preprocess-plugin.cjs` — naming a binding the emitted
  bundle does not have. Only **same-module** references stay bare identifiers. That is why
  `ensureBrowserProcess` / `keepName` live beside `initCjs` / `initEsm` rather than in a tidy
  `banner-shims.ts` (drafted for T581, then deleted for this reason), and why `makeBanner()` serializes
  the shims alongside the `init` function that calls them.
- **A helper that is referenced but not serialized fails silently**, degrading to whatever the consumer's global
  scope holds under that name. `globalThisRecord['__name'] ??= name;` shipped for years resolving `name`
  to `window.name` — a string, not a function. Nothing threw, because nothing called it.
- **Never let `lint:fix` shorten `globalThis.x` to `x` in banner code.** `unicorn/no-unnecessary-global-this`
  autofixes `globalThis.process` → `process`, which is equivalent in a module but not in the banner: there
  a bare `process` is a free identifier, so reading it where the host has none throws a **ReferenceError**
  — precisely the case `ensureBrowserProcess` exists to handle. The line carries a disable comment saying
  so; keep it.
- **Verify against the built `dist`, never only the source.** Run `npm run build`, then execute the
  banner sliced out of `dist/lib/cjs/*.cjs` and `dist/lib/esm/*.mjs` against the host shapes you care
  about. The unit tests call `String(fn)` on vitest's transform, which is exactly the compilation step
  that differs.
- (cannot be forced by ESLint — a custom rule could flag imported identifiers inside the serialized
  functions, but not the `globalThis` autofix interaction)

### L16. A notice is transient by design — record it as it arrives, never sample the DOM for it

- `PluginNoticeComponent.showNotice` defaults to `PluginNoticeMode.Replace`, which calls
  `this.notice?.hide()` before showing the new one: **the next notice from the same component removes
  the previous one from the DOM.** So a test that reads
  `activeDocument.querySelectorAll('.obsidian-dev-utils.plugin-notice-content')` is not asking "was
  this notice shown?" — it is asking "is it *still* the newest notice at this instant?", and any
  follow-up notice makes that false.
- Two mechanisms turn that into an unwinnable race. The rescue notice in
  `didRescueStillUsedAttachment` is followed by the `updatedLinks` notice the `RenameHandler` defers
  through `addToQueue`, which takes the same slot; and OIT's `waitUntil` **polls immediately**, so a
  predicate whose condition is already met exits on the first poll and a latch riding along in that
  predicate never gets a second look.
- **The tell is inverted timing: it fails when the run is FAST and passes under load.** `waitUntil`
  returns instantly when the machine is idle, so the loop never runs; a loaded machine spreads the
  queue out and a poll happens to land while the notice is still up. That is the opposite of a normal
  flake, which is why running the whole suite is not a valid check — the bug hides there. Run the file
  ALONE (`npx vitest run --project=obsidian-integration-tests <file>`) to reproduce it.
- **The fix is a `MutationObserver` installed before the action**, accumulating the text of every
  `.obsidian-dev-utils.plugin-notice-content` element as it is inserted (test the added node and sweep
  its subtree — the content element rides inside the `.notice` container that is what actually gets
  added). Do not seed it with a sweep of the existing DOM: a notice left over from an earlier case
  would then satisfy this one. Assert on the recording, and put both conditions in the same `waitUntil`
  predicate rather than reading one after the other.
- **Size an in-vault `waitUntil` to fail INSIDE the harness's 30 s `Runtime.evaluate` ceiling.** A
  30 s wait can never report: the CDP command is killed first, and vitest's own 30 s `testTimeout`
  fires at the same moment — so the message naming the unmet condition is replaced by a bare "Test
  timed out"/"CDP command timed out". The rescue cases use 12 s for this reason. Raising the vitest
  timeout does not help; the CDP ceiling is the binding one.
- Prove the assertion is not vacuous with a **negative control**: comment out the `showNotice` call and
  confirm the case fails on the wait's own message.
- (cannot be forced by ESLint — a rule could flag `querySelectorAll('…plugin-notice-content')` inside
  an `evalInObsidian` closure, but not the timing judgment)

### L17. Never key a cached `Reference` by its `position` across an `await` — and never skip a link in silence

- A `Reference` carries `position.{start,end}.{line,col,offset}`, so `toJson(reference)` is a
  **position-bearing** key. `RenameHandler` used exactly that to match links snapshotted before the
  attachments moved against links re-read from the live metadata cache afterwards. Any edit to the file
  in between shifts the offsets of every link **below** it, so each of those missed its key — while the
  links above it matched and were rewritten. Partial, ordered, and completely silent. Key by the link's
  **text** (`getLinkIdentityKey`: `{ link, original }`) instead: text is the only part that survives the
  gap, unchanged text matches however far it moved, and text somebody else already rewrote legitimately
  misses because it needs no rewrite. Identical link texts in one file resolve to the same target, so
  collapsing them costs nothing.
- **Assume something else edits the file inside your window.** The window here is wide — snapshot,
  N attachment renames, then the rewrite — and `FileManagerRunAsyncLinkUpdatePatchComponent` only
  suppresses *Obsidian's* markdown link updates, never a co-installed plugin's. This is why
  <https://github.com/mnaoumov/obsidian-custom-attachment-location/issues/60> reproduced only with
  other plugins enabled, and why the plain "move a note with 30 attachments" test stayed green against
  the broken build. A single-plugin test cannot cover a multi-plugin window; supply the concurrent edit
  yourself, from inside the `vault.on('rename')` of the first attachment move.
- **A lookup miss on a link you were asked to rewrite must be logged.** That branch had no output of
  any kind, so every broken embed reported nothing — no error, no retry, no notice, and the user's only
  signal was an image that stopped rendering. Where a skip is a legitimate outcome and a bug looks
  identical to it, the debug line is the only thing that tells them apart.
- **Insert the perturbation in the MIDDLE when diagnosing this shape.** An edit at the top shifts every
  link and loses all of them, which is indistinguishable from a whole-file bail-out
  (`applyFileChanges` returning `null`). A middle insertion leaves a contiguous stale **tail**, which
  only a per-link key mismatch can produce.
- (cannot be forced by ESLint — a rule could flag `toJson()` on a value typed `Reference` used as a
  `Map` key, but not the lifetime that makes it wrong)

### L18. The Windows command-line budget is not 8191 — measure what you can, reserve for what you cannot

- `exec()` has **two** length limits on purpose and they must not be collapsed into one.
  `getMaxCommandLength()` is the raw platform maximum and guards a command that cannot be split;
  `getMaxBatchCommandLength()` subtracts `WINDOWS_CHILD_EXPANSION_RESERVE` and sizes an
  `ExecArgument` batch. Splitting a batch costs one extra sequential invocation, so that side may be
  wrong in the safe direction; rejecting a command that cannot be split is fatal, so that side must stay exact.
- **The assembled command is not what `cmd.exe` sees.** Two costs are spent after any naive length
  check: node's `spawn(…, { shell: true })` wraps the command as `%ComSpec% /d /s /c "…"`, and
  `spawnViaShell` then runs `cmdEscapeCommandLine` over it, which grows a list of quoted paths by a few
  percent. Both are ours, so `getEffectiveCommandLineLength()` computes them rather than guessing —
  and its platform branch must stay in sync with `spawnViaShell`'s.
- **A third cost is not computable and must be reserved for.** `npx <tool> <args…>` is a *chain* of
  `cmd.exe` lines: `npx.cmd` re-expands `%*`, the tool's `.bin/<tool>.cmd` shim does it again, and each
  hop re-quotes what it forwards. Every line in the chain faces the same 8191 limit and every one is
  longer than ours. Measured on P36's 187-file list (T635): a `markdownlint-cli2` invocation **assembled
  at 7051 chars** — 1140 under the limit — died with `The command line is too long.`
- **The symptom names nothing wrong with the content**, and it is size-dependent, so a repo passes until
  the day it adds a few files and does not. Both halves of `markdownlint.ts`' `lint()` are exposed, not
  just the `linkinator` one. If it ever returns, raise the reserve; never lower it.
- (cannot be forced by ESLint — the limit is a property of the spawned process's own shim chain)

### L19. An adapter flag is a claim, not a contract — check the two adapters separately, and they may fail opposite ways

- `DataAdapter.rmdir(path, recursive)` looks like one API with one behavior. It is two implementations that
  disagree, and **both** ignore the flag — in **opposite directions**. Read from `obsidian-1.13.7.asar`:
  `CapacitorAdapter` (mobile) is `rmdir(e, t) { this.fs.rmdir(this.getFullPath(e)) }` over a layer that
  hardcodes `Lf.rmdir({ …, recursive: !0 })` — the argument is not even accepted, so a non-recursive call
  **deletes the whole subtree silently**. `FileSystemAdapter` (desktop) is
  `fsPromises.rm(fullPath, { maxRetries: 5, recursive: t })`, and Node's `fs.rm` throws `ERR_FS_EISDIR` for
  **any** directory when `recursive` is `false` — so the non-recursive call **never succeeds, not even on an
  empty folder**. One is data loss, the other is a permanent failure, and no single-platform test can see both.
- **Do not generalize a footgun from the platform you happen to run on.** T686 was opened describing the
  mobile data loss as universal, because that is the half that gets noticed. The desktop half is invisible
  until something calls it — and then it looks like a bug in the caller.
- **The fix for "the flag is ignored" is to establish the precondition yourself and then call the mode that
  works.** `RmdirGuardComponent` proves the folder empty (through `isEmptyFolder` → `adapter.list`, i.e. the
  adapter's own truth) and forwards to `originalMethodBound(path, true)`. Forwarding *recursively* after
  proving emptiness looks redundant and is not: it is what makes the empty-folder case succeed on desktop.
  Anything the precondition does not cover takes `fallback()` and keeps native semantics exactly.
- **Never decide "is this folder empty?" from the vault file tree.** `folder.children.length === 0` is not
  the question — the index omits dot-prefixed and otherwise hidden entries, so a folder holding only hidden
  files reads as empty there. For a guard whose whole job is preventing a deletion, that inverts it.
- **Pin the premise with a negative control at the integration layer.** The unit tests here drive
  `obsidian-test-mocks`' in-memory adapter, which is *our own* reimplementation of `rmdir` — it can only
  confirm the component matches our model. `rmdir-guard-component.obsidian.integration.test.ts` asserts the
  unguarded `ERR_FS_EISDIR` directly, so if Obsidian ever fixes `rmdir` the case goes red and says the guard
  is obsolete, rather than quietly guarding nothing.
- **Read the bundle rather than trusting the signature or the memory of it.** `grep -aob '<methodName>'` over
  `%APPDATA%\obsidian\obsidian-<version>.asar`, then `dd` a window around the offset (same technique as L14).
- (cannot be forced by ESLint — a runtime-behavior asymmetry between adapters)

### L20. A patch token is for a NON-IDEMPOTENT patch — an idempotent one stacks safely and must not defer

- Every plugin bundles its own copy of this library, so a patch on a shared object (`app.vault.adapter`,
  `app.fileManager`) is installed once per plugin that opts in. The reflex is to add a `patchToken` +
  `hasPatchToken` so later copies defer to the first. **That reflex is right only when running the patch
  twice would actually do something different from running it once.**
- **The stacking is already safe, because `monkey-around` neutralizes an unloaded wrapper in place.** Its
  `remove()` sets `current = original` unconditionally — it restores `obj[method]` only when its own wrapper
  is still the outermost, but the wrapper it cannot splice out of the middle becomes a pass-through either
  way. So N patches can be unloaded in **any** order and the method stays patched until the last one goes.
  `rmdir-guard-component.test.ts` pins this with all six unload orders of three guards; they pass with and
  without a token, which is the measurement that settles the question.
- **Idempotent → no token.** `RmdirGuardComponent` is "prove empty, then delete": the outermost guard either
  throws or forwards with `recursive: true`, which every guard beneath passes straight through. One `stat`,
  one `list`, same result. A token would only move the decision from the outermost (last-loaded) guard to
  the innermost (first-loaded) one — an equally arbitrary load-order accident — while adding a code path on
  which a guard **declines to guard**. For anything protecting data, that trade is strictly negative.
- **Non-idempotent → token.** `FileManagerRunAsyncLinkUpdatePatchComponent` suppresses `runAsyncLinkUpdate`
  so a custom handler owns link rewriting. Two of those would both suppress and both rewrite — a real
  conflict — so deferring via `hasPatchToken(originalMethod, PATCH_TOKEN)` is what keeps them from fighting.
- **Cost of a token, when you do add one:** it is a deferral, i.e. trusting a patch you do not control. Its
  safety rests on the token being dropped on unload (`registerMethodPatch` does this) — otherwise a guard
  defers to a neutralized wrapper and the call falls through to the unpatched original. And `Symbol.for` is
  a global name, so anything that registers the same token can switch your patch off.
- The question to ask is therefore never "could this be installed twice?" but **"does installing it twice
  behave differently from installing it once?"** If no, write down why there is no token — otherwise the
  reflex re-fires on the next reader.
- (cannot be forced by ESLint — an idempotence judgment about the patch body)

## Testing

### Goals

- The project aims for 100% test coverage. Every new or changed code path must be covered by tests.
- Three layers, one vitest project per concern (see `scripts/vitest-config.ts`): unit tests
  (`*.test.ts`, jsdom or node), Node-side integration tests (`*.integration.test.ts`), and real-Obsidian
  E2E tests (`*.obsidian.integration.test.ts`, driven over CDP by `obsidian-integration-testing`
  against an owned Electron instance). The E2E layer is no longer "planned" — it is the only layer that
  sees behavior the mocks cannot reproduce (see L7, L10, L11 above for cases that only surface there).
- **Three E2E projects own a DEDICATED Obsidian instance each**, because their vaults cannot be shared with
  the pooled `obsidian-integration-tests` one. Each has its own `globalSetup` and its own ascending
  `groupOrder`, so the instances never run concurrently:
  `obsidian-integration-tests:demo-vault-helper` (bootstraps a whole demo vault),
  `obsidian-integration-tests:consumer-lib` (a vault with NO plugin-under-test, proving a consumer's `lib`
  wiring), and `obsidian-integration-tests:plugin-api` (two SEPARATELY BUNDLED plugins in one vault, so two
  distinct copies of this library share one renderer — the only place the plugin-API registry's wire-format
  claim can actually be tested; sources under `integration-test-plugin-api/`, built by
  `scripts/helpers/build-plugin-api-test-plugins.ts` into `dist/` and never shipped). A file belonging to
  one of these must ALSO be added to the pooled project's `exclude` list, or it runs twice against the
  wrong vault.

### Test setup

- Consumers wire the library's per-test setup into their suites via three endpoints, mirroring
  `obsidian-test-mocks`'s naming: `obsidian-dev-utils/setup` (framework-agnostic
  `setup({ beforeEach, afterEach, afterAll })`), `obsidian-dev-utils/vitest-setup`, and
  `obsidian-dev-utils/jest-setup`. `afterAll` is **required** — it closes the unhandled-async-error
  collection window for the file (see "Unhandled async errors" below); the two framework endpoints pass it
  for you.
  Before each test the setup resets the shared-state bag on `globalThis.__obsidianDevUtils` (so
  accumulated state does not leak between tests), enables async-operation tracking, silences every
  `console` method (replacing each with a no-op via `silenceConsole()`, so incidental log/warn/error
  output does not pollute the test report), clears `localStorage` (so per-worker Web Storage does
  not leak between tests), and starts collecting unhandled async errors; after each test it drains any
  tracked fire-and-forget operations **and the pending macrotask queue**, disables tracking, restores the
  original `console` methods
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

- The standard `setup()` also fails a test if a fire-and-forget async operation emitted an async error the
  test did not declare as expected — the "no swallowed async errors" harness. `beforeEach` calls
  `startCollectingUnhandledAsyncErrors()` (`src/error.ts`); `afterEach` drains tracked operations
  via `waitForAllAsyncOperations()` (guarded by `isAsyncOperationTrackingEnabled()`, so a test that
  disabled tracking itself does not trip the drain), then throws an `AggregateError` of whatever
  `drainCollectedUnhandledAsyncErrors()` returns. It is forced, not opt-in.
- **A registered consumer handler does NOT exempt an error** (changed by T655; it used to, via an
  `asyncErrorHandlerCount === 0` gate mirroring Node's `unhandledRejection`). `PluginBase` adds
  `AsyncErrorHandlerComponent` during `onload`, which registers such a handler — so the old gate disarmed
  the harness for the whole of **every plugin's `plugin.test.ts`**, where it was needed most. In
  production a handler showing the user a Notice is a defensible definition of "handled"; in a test it is
  not an assertion that the error was expected. `startAsyncErrorIgnoreContext()` is now the single,
  explicit opt-out, and it is explicit at the call site rather than dependent on which components a plugin
  happens to load. Consequence for consumers: a test that registers a handler and asserts on the emitted
  error must now also open an ignore context.
- **The collection window spans the gaps between tests, and `afterAll` closes it.** A `setTimeout(…, 0)`
  a test leaves pending (e.g. `LayoutReadyComponent.onload`) is not a tracked async operation, so
  `waitForAllAsyncOperations()` does not wait for it. `afterEach` therefore also lets the macrotask queue
  turn over (`drainPendingMacrotasks()`, built on a `globalThis.setTimeout` captured at module load so
  `vi.useFakeTimers()` cannot hang teardown), and *drains* the window rather than closing it — an error
  emitted in the gap is reported by the next `beforeEach` ("after the previous test finished"), and one
  emitted after the file's last test by `afterAll` ("after the last test finished"). Before T655 such an
  error hit a nulled bucket after `restoreConsole()` had run: it printed to a real console and failed
  nothing. The tell was a `stderr | <file>` block with **no test name** — i.e. emitted outside any running
  test.
- A test that deliberately triggers an async error opens an ignore context:
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
- **`ensureMetadataCacheReady` is NOT sufficient for a file you just created.** It awaits
  `onCleanCache`, which resolves as soon as the cache is clean *at that instant* — and right after
  `vault.create` the indexing work is not queued yet, so it returns before there is anything to wait
  for. Measured under T236: it left 2 of 3 flakes in place. For a fresh file, wait on the concrete
  condition instead (e.g. the file's `resolvedLinks` entry appearing), not on cache cleanliness.
- When there is no readiness event to await, poll with `retryWithTimeout` (bounded) rather than a
  single frame or fixed delay — e.g. `getDomEventsHandlersConstructor` retries until the constructor
  is intercepted instead of asserting after one `requestAnimationFrame`.
- Inside `evalInObsidian` callbacks, library helpers arrive via the injected `lib` bag — **not** via the
  test file's imports, since the callback is serialized and runs in the Obsidian process. `lib` is
  **flat**, so it is `lib.ensureMetadataCacheReady`, not `lib.obsidian['metadata-cache'].…`. Destructure
  by name (`fn({ app, lib: { ensureMetadataCacheReady } })`). A new export only appears there after
  `npm run build:generate-merged` regenerates the gitignored `src/__merged.ts`; otherwise `tsc` fails with
  `Property '<name>' does not exist on type 'Lib'`. The runtime source is
  `window.__obsidianDevUtilsModule`, published by the harness plugin.
- **A test that opens the settings POPOUT must point the active window home before it ends.** Obsidian
  moves the `activeWindow` / `activeDocument` globals on window FOCUS, and the owned test instance is
  hidden by being moved OFF-SCREEN — so `app.setting.close()` alone leaves them pinned to the popout
  that was just destroyed, permanently. Every later file shares that instance and builds its UI in
  `activeDocument`, so each modal / popover / notice then renders into a dead window and waits out its
  full timeout with no assertion failure. Close Settings and reassign
  `window.activeWindow = getMainWindow(app)` (plus `window.activeDocument`) in a `finally`.
  `scripts/integration-test-obsidian-setup.ts` carries an `afterEach` that does this for every file as a
  net, but a test that leaks is still a bug — the net exists so one leak cannot fail unrelated files.
- **A whole-file, flat-timeout failure is an ordering symptom, not a load symptom.** Vitest orders files
  from its `node_modules/.vite/vitest` duration cache, so the order changes run to run and a
  state-leak like the one above surfaces as a different set of "flaky" files each time, while every file
  passes in isolation. Before blaming load, run the suspect file alone, then again with the files that
  preceded it, and bisect.

## Dependencies

### Pinned versions

An **exact** version (no `^`) is how a dependency is held back here, and it is also what makes it
invisible to `update-npm-deps.ps1`: that script upgrades caret ranges and *silently* skips exact pins.
Nothing will ever remind you a pin is stale, so every row below states the condition that releases it
and the command that tests that condition. **A pin added without an "upgrade when" row cannot be
retired by anyone but its author — do not add one.**

| Package | Pin | Why | Upgrade when |
| --- | --- | --- | --- |
| `@codemirror/state` | `6.5.0` | `obsidian`'s `peerDependencies` names this exact version. A second copy in the tree means two CodeMirror state instances at runtime. | `obsidian` names a different version — see "the CodeMirror pins are already due" below. |
| `@codemirror/view` | `6.38.6` | Same — `obsidian` peer-pins it exactly. | Same as above. |
| `@lezer/common` | `1.5.2` | Must match the copy Obsidian bundles at runtime — our copy is types-only, so a newer pin declares API the runtime lacks. Nothing else in the tree depends on it, so npm cannot detect or correct a mismatch. Verified against Obsidian `1.13.4` — see below. | A newer `@lezer/common` publishes — `npm view @lezer/common version` — which is the cue to re-derive what Obsidian bundles, not proof the pin is stale. `obsidian-api` still declares no `@lezer/*`, so there is no upstream manifest to ask. |
| `typescript` | `6.0.3` | `@typescript-eslint` peer-requires `>=4.8.4 <6.1.0`, and its parser crashes on the TypeScript 7 (tsgo) native API, so type-aware ESLint cannot run on 7. TypeScript 7 was adopted in `db7c417c` (compile on 7, tooling on 6) and rolled back in `846d6c6a`; `3234c7d0` then made the pin exact so a dependency sweep could not drift it back. `6.0.3` is also the newest stable `6.x`. | `@typescript-eslint`'s peer range admits `7.x` — `node -e "console.log(require('typescript-eslint/package.json').peerDependencies.typescript)"` |
| `js-yaml` (override) | `4.3.1` | `js-yaml@5` breaks `npm run docs:build` — see the next section. | `astro` accepts `js-yaml@5` — `node -e "console.log(require('astro/package.json').dependencies['js-yaml'])"` |
| `@puppeteer/browsers` (override) | `^3.2.0` | Not a pin but an advisory-driven override, tracked here for the same reason: it clears `extract-zip` GHSA-jmr9-qjv8-65gv, which nothing else in a sweep can reach. See "Security overrides (`extract-zip`)" below. | `@wdio/utils` asks for `@puppeteer/browsers@^3` itself — the `check` in [`pinned-versions.json`](pinned-versions.json) |

**The CodeMirror pins are already due — the condition has fired upstream but not yet on npm.**
`obsidian-api` master ([`package.json`](https://github.com/obsidianmd/obsidian-api/blob/master/package.json))
is at `1.13.2` and peer-pins `@codemirror/state` **`6.7.0`** and `@codemirror/view` **`6.43.5`**
(it also moves `moment` `2.29.4` → `2.30.1`). npm still serves `1.13.1` with `6.5.0` / `6.38.6`, which
is what is installed here. Because the spec is `obsidian: ^1.13.1`, the day `1.13.2` publishes a plain
`npm install` will pull it in and the two pins below it become wrong — they must be bumped to
`6.7.0` / `6.43.5` **in the same commit**, or the tree ends up with two CodeMirror instances.

So the check is two-sided — the installed copy tells you only after the fact:

```sh
node -e "console.log(require('obsidian/package.json').peerDependencies)"   # what is installed
npm view obsidian version                                                 # what npm serves
# and https://github.com/obsidianmd/obsidian-api/blob/master/package.json  # what is coming
```

**`@lezer/common` was settled by reading the bundle — and `1.2.3` was simply wrong.** `1fdd8d24`
("chore: update libs") had **downgraded** it from `^1.4.0` to `1.2.3` inside an upgrade sweep without
recording a reason, and the old wording here ("`obsidian` uses this version at runtime") was inherited
rather than verified. `obsidian-api`'s manifest lists **no** `@lezer/*` entry in any section, so unlike
the CodeMirror pins there is no declared upstream version to compare against — Obsidian bundles Lezer
inside `app.js`, which is also where the pin's *reason* is visible: `app.js` registers `'@lezer/common'`
in the module map it hands to plugins (Obsidian `1.13.4`, `app.js:167784`), so our copy is types-only.

The bundle carries no version string, but the implementation is identifiable. Diff the `dist` of
candidate versions (`npm pack @lezer/common@<v>`) and grep `app.js` for what distinguishes them; against
Obsidian `1.13.4` (exactly one Lezer copy in the bundle) the markers land on **`1.5.2`**:

| Marker present in `app.js` | Introduced in |
| --- | --- |
| `combine` field on the `NodeProp` constructor; `depth++` on the active overlay after `materialize` | `1.3.0` |
| `-4 == size` (`SpecialRecord.LookAhead`) accepted in the skipped-node scan | `1.4.0` |
| `IterMode.EnterBracketed = 16`; `MountedTree.bracketed` | `1.5.0` |
| `nextChild`'s bracketed test in the `!mounted.overlay && mounted.bracketed && pos >= start` form (`1.5.0` used an `?.overlay === null` form) | `1.5.1` |
| `FragmentCursor.moveTo` guarding the advance with `cursor.to <= pos` | `1.5.2` |

`npm view @lezer/common version` is therefore a *trigger*, not a verdict: when it moves past `1.5.2`,
re-run the marker comparison against the current `app.js` before touching the pin. A single value can
serve as the pin because this project targets the **latest** Obsidian only — "what Obsidian bundles"
always means the current release, and no older bundle has to stay satisfied. Stronger enforcement
would be an integration test — the harness runs inside Obsidian, where `require('@lezer/common')`
returns the real bundled module, so its export keys and `IterMode` members can be compared against the
installed copy — which is the mismatch that actually bites. Not written yet.

Not pinned, despite what this table used to claim: `@types/node` is `^26.1.2`. The old row said
`25.0.3` "matches the Node.js version used in the project"; it has since moved to a caret range and
tracks the `26.x` line.

### The `js-yaml` override is pinned to `4.3.1` — do NOT take it to `5.x`

`overrides.js-yaml` is an **exact pin**, deliberately: `update-npm-deps.ps1` upgrades every
caret-ranged override it finds and has no exclusion list, so `^4.x` got carried to `^5.2.2` twice. An
exact pin is the only self-enforcing form — the script skips exact versions by design.

`js-yaml@5` drops the default export, so forcing it breaks `npm run docs:build` at Astro's own
`import yaml from 'js-yaml'` with `The requested module 'js-yaml' does not provide an export named
'default'`. Unit tests and lint stay green, so this only shows up in the docs build — re-run
`docs:build` after any `js-yaml` change.

The pin is a compromise, not a consensus: `astro` asks for `^4.3.0` (raised from `^4.1.1` in
`astro@7.1.6`), `@astrojs/starlight` and `@astrojs/internal-helpers` for `^4.1.1`, `cosmiconfig` for
`^4.1.0` and `@istanbuljs/load-nyc-config` for `^3`, but `markdownlint-cli2` pins `5.2.2` **exactly**
and is force-downgraded to `4.3.1` by this override. That downgrade is verified green through
`lint:md`. `4.3.1` is the newest `4.x` — it is what the `v4-legacy` dist-tag points at, and it backports
the CVE-2026-59870 fix (GHSA-5p4m-2wfm-xmqj) that `4.0.0`–`4.3.0` lack, so this override is also what
clears that advisory for `astro`, `starlight`, `cosmiconfig`, `markdownlint-cli2` and
`@istanbuljs/load-nyc-config` at once. Astro's bump changed nothing but the recorded `expect` in
[`pinned-versions.json`](pinned-versions.json). When Astro moves to `js-yaml@5`, the pin can be
retired — until then, check `lint:md` as well as `docs:build` on any bump.

Related: do **not** reintroduce `gray-matter`: its `lib/engines.js` binds js-yaml's `safeLoad` /
`safeDump` at **module-load** time, and both were removed in js-yaml v4 — so merely *importing*
`gray-matter` throws `Cannot read properties of undefined (reading 'bind')`, before any `engines`
option can override the default. `scripts/docs-gen/generate-og-images.ts` therefore parses frontmatter
itself with `yaml`. (`yaml`, not `js-yaml`: `depend/ban-dependencies` bans `js-yaml` as a *direct*
dependency, which is why it only ever appears under `overrides`.)

### `@astrojs/markdown-remark` is a direct devDependency on purpose

Astro 7 made Sätteri its default Markdown processor and **stopped installing `@astrojs/markdown-remark`**,
but `markdown.remarkPlugins` (used by [`astro.config.ts`](astro.config.ts) for `remarkRelativeLinks`) still
runs on the `unified` processor from that package. Without it as a direct dependency, `npm run docs:build`
dies during config validation with

```text
`markdown.remarkPlugins`, `markdown.rehypePlugins`, and `markdown.remarkRehype` run on the `unified`
processor from `@astrojs/markdown-remark`, which is no longer installed by default …
```

`@astrojs/mdx` pulls its own **nested** copy, which does not satisfy this — the resolution has to succeed
from the project root. So the package is listed in `devDependencies`; do not drop it as "already
transitively available". It retires only if `astro.config.ts` stops using remark/rehype plugins.

### Security overrides (`brace-expansion` GHSA-mh99-v99m-4gvg)

`brace-expansion` <= `5.0.7` is vulnerable; the fix ships **only** on the `5.x` line, while `minimatch@3`
and `minimatch@9` pin the unpatched `1.x` / `2.x` lines. `npm audit fix` cannot resolve this — its only
offer downgrades unrelated packages — so the `overrides` block carries the fix:

| Override | Why |
| --- | --- |
| `glob` → `^13`, `test-exclude` → `^8`, `readdir-glob` → `^3` | Newest majors, all on `minimatch@^10` (which uses the patched `brace-expansion@5`). Verified against their call sites: `glob.sync` / `globSync` and `readdir-glob`'s `match` / `end` events are unchanged. |
| `eslint-plugin-n` → `$eslint-plugin-n`, `eslint-plugin-json-schema-validator` → `^6` | Replaces the versions `@microsoft/eslint-plugin-sdl` / `eslint-plugin-obsidianmd` pin exactly; `n@18` drops `minimatch` entirely and `json-schema-validator@6` moved to `minimatch@^10`. |
| `eslint-plugin-import` → `npm:eslint-plugin-import-x` | `eslint-plugin-import` still needs `minimatch@^3` at its latest version, and `import-x` is its maintained fork (on `minimatch@^9 \|\| ^10`). |
| `brace-expansion` → `file:patches/brace-expansion-callable` | Last resort for `eslint-plugin-react`, which `@microsoft/eslint-plugin-sdl` pins and which still needs `minimatch@3`. The two lines differ **only** in module shape (`module.exports = expand` vs `exports.expand`), so the patch re-exports the patched `5.x` implementation — installed under the `brace-expansion-upstream` alias — in the legacy callable shape. |

Do not point the `brace-expansion` override at a nested (scoped) key: npm resolves a `file:` spec there
relative to the *dependent*, producing a junction to a path that does not exist. It must stay top-level.

**Remove all of this** once upstream lands the backports — the ranges (`^1.1.7` / `^2.0.2` / `^3.1.2`) mean a
published `brace-expansion@1.1.17` flows in through a plain `npm update`, at which point the patch and the
`brace-expansion-upstream` alias are dead weight. Test the condition with
`npm view brace-expansion versions --json`: the legacy heads were `1.1.16` / `2.1.3` / `3.0.5` as of
2026-07-28, all still unpatched, so anything newer on those lines means the backport landed. The
`eslint-plugin-import` →
`import-x` alias is separate and does **not** retire with it — that one lasts as long as
`eslint-plugin-import` needs `minimatch@^3`.

### Security overrides (`extract-zip` GHSA-jmr9-qjv8-65gv)

`extract-zip` is vulnerable at **every** published version (the advisory range is `*`, and `2.0.1` is the
last release), so unlike `brace-expansion` there is no patched version to override it *to*. It reaches
this tree through one chain only:

```text
obsidian-integration-testing → webdriverio → @wdio/utils → @puppeteer/browsers@2.x → extract-zip
```

Upgrading the direct dependency does not help either: `obsidian-integration-testing` is already at its
latest and pins `webdriverio` **exactly**, and even the newest `webdriverio` still declares
`@puppeteer/browsers: ^2.2.0` under `@wdio/utils`. So the fix goes one level up the chain —
`@puppeteer/browsers` → `^3.2.0`, whose `3.x` line replaced `extract-zip` with `modern-tar`. That drops
the vulnerable subtree entirely (43 packages) and **dedupes**: `puppeteer-core` already pulls `3.2.0`
into this tree, so the override collapses two copies into one rather than adding anything.

The major bump is safe for `@wdio/utils`, the only consumer left on `2.x`. It imports exactly `install`,
`canDownload`, `resolveBuildId`, `detectBrowserPlatform`, `Browser`, `ChromeReleaseChannel`,
`computeExecutablePath` and the `InstallOptions` type — all still exported by `3.x` — and its
`downloadProgressCallback: (downloaded, total) => …` call sites still satisfy `3.x`'s widened
`'default' | fn` type. Both packages are ESM-only, so there is no CJS/ESM break. `3.2.0` wants
node `>=22.12.0` against this repo's `>=22.0.0`, but `puppeteer-core` already imposed that.

**Never take `npm audit fix --force` here.** Its remedy for this advisory is
`obsidian-integration-testing@1.1.2` — a downgrade across eleven majors from the `12.x` in use (rule G100).

**Remove this override** when `@wdio/utils` moves to `@puppeteer/browsers@^3` on its own, which is what
[`pinned-versions.json`](pinned-versions.json) checks on every sweep.

### Unused dependencies (`.depcheckrc.json`)

A dependency nothing references is as invisible to a sweep as a stale pin: npm never mentions it, `npm
audit` never mentions it, and it keeps dragging a whole subtree — and that subtree's advisories — into
every install. `update-npm-deps.ps1` therefore ends by running `depcheck`. depcheck is heuristic and
cannot see a package that is only invoked as a CLI from a script, named as a string in a config, or
pulled in by a compiler option, so it **never** removes anything: it reports, and
[`.depcheckrc.json`](.depcheckrc.json) records each verified false positive **together with the
reference that proves it**. Because that file exists, anything depcheck still reports **fails** the
sweep — so silencing a name without its reason defeats the entire mechanism.

Three entries are subtler than "run as a CLI": `@types/babel__core`, `@types/pug` and `postcss-modules`
are imported by no file here, only by `svelte-preprocess`' and `esbuild-sass-plugin`'s own `.d.ts`. The
compile does not care (`skipLibCheck: true`), but the `skipLibCheck: false` re-check above does — drop
them and its `Ignored N diagnostic(s)` count, which is meant to reach `0`, goes **up** by three.

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

## Releasing

- **Choose the bump from `git log <lastTag>..HEAD`, never from the change you happen to be working on.**
  `npm run version -- <type>` takes the type as an ARGUMENT and derives nothing, so the release ships
  every commit accumulated since the last tag — which is routinely more than the current task's. Scan that
  range for `feat:` (→ minor) and `!` / `BREAKING CHANGE:` (→ major) before picking. Missed on `96.5.1`:
  it was chosen as a patch for a one-line `fix`, and shipped six unreleased `feat:` commits with it.
- **A commit that reaches `main` and is then superseded still lands in the changelog**, which is generated
  from commit messages (`git log <lastTag>..HEAD --format=%B --first-parent`). If an approach is reworked
  before it is ever released, squash the unreleased commits rather than letting the changelog announce a
  state that never shipped (done for `96.5.1` — two `fix(build)!` commits carrying a `BREAKING CHANGE:`
  footer for an abandoned barrel change were squashed into one `fix(obsidian):` commit and force-pushed).

- **The changelog review is the only step that can block, and it is deliberately the last step before
  anything is written.** `updateVersion` settles the changelog on a scratch copy under the OS temp folder
  *before* `updateVersionInFiles`, so interrupting the review leaves the working tree pristine and the
  release simply re-runnable — the earlier order bumped `package.json` / `manifest.json` / `versions.json`
  first, and a stop at the editor then stranded a dirty tree that `assertGitRepoClean` refused to re-release
  (T731, hit cutting App Update Notifier 1.0.0).
- **The GitHub release body is the changelog section delimited by LINES, terminating at the next `'## '`
  heading or at end-of-file — never by a regex that requires a following heading.** `getReleaseNotes` used to match
  `\n## <version>\n\n(…)\n\n##`, whose trailing `##` is mandatory. Sections are PREPENDED, so the newest one is
  bounded by the previous release only once a previous release exists: on a **first release** the match was
  `null` and the body silently shipped as nothing but the `**Full Changelog**` link. It reached the store on
  five plugins' `1.0.0` — nested-properties, edit-link-alias, backlink-full-path, refresh-any-view,
  app-update-notifier — i.e. exactly the release where notes matter most, and no warning was ever emitted
  (T732). The same regex also truncated a section at its own `###` sub-heading, because it treated the
  delimiter as if only version headings could produce it. `extractChangelogSection` now scans lines and stops
  at `'## '` **with the trailing space** (so `###` stays inside the section) or at the end of the file.
- **A release without a TTY refuses in the preflight, not after the gate.** `npm run version` checks
  `process.stdin.isTTY` right after the git/gh assertions and before the checks and build, so an agent- or
  CI-driven run fails in seconds instead of paying ~17 minutes and then hanging on `code -w`. Release
  unattended with `--changelog-file <path>` (prepared release notes replace the commit-derived bullets) or
  `--no-changelog-editing` (accept the generated bullets as is).
- **In PowerShell, QUOTE the `--` separator: `npm run version '--' <type> --no-changelog-editing` (T811).**
  PowerShell consumes a bare `--` as its own end-of-parameters token, so npm never receives the separator
  and parses the following flag as npm's own config — `npm run version -- minor --no-changelog-editing`
  dies with `EUNKNOWNCONFIG … Unknown cli flag: --changelog-editing` before `scripts/version.ts` starts.
  The positional bump type forwards either way, which is what makes the error read like a bad flag name.
  This is a shell-quoting issue, not an npm 12 regression: with the same npm 12.0.2 the bare form forwards
  correctly from bash, and the quoted form forwards correctly from PowerShell (verified both ways,
  2026-09-01). `npx jiti scripts/version.ts <type> --no-changelog-editing` also works from any shell —
  the npm script is only `jiti scripts/version.ts`, so it is the same code path with no separator to lose.
- **`publishGitHubRelease` accepts both `npm pack --json` shapes, and must keep doing so (T806).** npm 11
  emits an array of pack results; npm 12 emits an object keyed by package name. The old code found the
  tarball name by scanning for the array's literal `'[\n  {'` opening, so every release on npm 12 threw at
  the very LAST step — after the bump, changelog, commit, tag and push had all landed, leaving a public tag
  with no GitHub release and therefore nothing on NPM (`publish-npm.yml` triggers on `release: published`).
  It failed four for four before being fixed. `parseNpmPackOutput` now locates the payload by parsing from
  each candidate start — the `npm notice` lines go to stderr, but the `prepare` script's own stdout precedes
  the JSON and may contain braces — and normalizes both shapes. **Any test mocking that output must mock the
  object shape**; mocking only the array is exactly what held coverage at 100% while the real command
  diverged. If a release ever half-fails here again, `npm pack` has already written the tarball, so recovery
  needs no rebuild: `gh release create <version> dist/<tarball> dist/styles.css --title v<version>
  --notes-file <notes>`, the notes being the CHANGELOG section plus the
  `**Full Changelog**: …/compare/<prev>...<new>` line. `publish-npm.yml` fires on a manually-created release
  exactly as it would on a scripted one.

A release is two stages, split across two machines on purpose:

1. **Local** — `npm run version -- <patch|minor|…>` runs the checks and the build, bumps the version,
   writes the changelog, commits, tags, pushes, and creates the **GitHub release**. It stops there; it
   does **not** publish to NPM (`scripts/version.ts` no longer calls `publish()`).
2. **CI** — the `release: published` event triggers `.github/workflows/publish-npm.yml`, which reinstalls,
   rebuilds (`dist/` is gitignored, so the tarball's contents exist only after a build) and runs
   `npm run publish:npm` → `publish()` → `npm publish --tag <latest|beta>`, with the dist-tag derived from
   whether the `package.json` version is a pre-release.

The publish authenticates with **npm trusted publishing** (OIDC), not a token: the job's `id-token: write`
permission lets the npm CLI trade a short-lived GitHub OIDC token for a publish grant, and provenance is
generated automatically. Consequences worth knowing before touching any of this:

- **No `NPM_TOKEN` exists anywhere** — not in repo secrets, not in a local `.env`. `publish()` reads no
  credentials, and publishing from a developer machine is simply not possible (trusted publishing works
  only from the configured CI). A "how do I publish locally?" answer does not exist; re-run the workflow.
- **The npmjs.com side names the workflow file** (Package settings → Trusted publisher: owner, repo,
  workflow filename `publish-npm.yml`, case-sensitive). Renaming or moving that file breaks publishing
  with an auth error that says nothing about the rename — update the setting in the same change.
- Requires npm ≥ `11.5.1` and Node ≥ `22.14.0`; the version in `.nvmrc` satisfies both.
- `workflow_dispatch` is also wired up, so a failed publish can be retried from the Actions tab without
  cutting a new release.
- **Because CI rebuilds, anything the tarball needs must happen in `npm run build` — never in
  `scripts/version.ts`.** The release script runs only on the maintainer's machine, so a step placed
  there reaches the local `dist/` and nothing else, while CI publishes a `dist/` that never saw it.
  This is not hypothetical: the placeholder substitution used to live in `prepareGitHubRelease`, and
  every release from `94.7.0` (the one that moved publishing to CI) through `96.0.0` shipped a literal
  `$(LIBRARY_VERSION)`, which made `initPluginContext` throw `Invalid argument not valid semver` in
  every consumer. It is now the build step `build:stamp-generated`, which throws if the declaration it
  rewrites is missing, so an unstamped publish fails the build instead of reaching NPM. Verify a
  release with `npm pack obsidian-dev-utils@<version>` and grep the extracted
  `dist/lib/esm/generated-during-build.mjs` for the stamped value.

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
