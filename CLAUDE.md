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
- `static/scripts/` — consumer example scripts organized by module (bundlers, formatters, linters, test-runners, build, version)
- `src/script-utils/commitlint-config.ts` — shared commitlint configuration
- `src/script-utils/nano-staged-config.ts` — shared nano-staged pre-commit configuration
- `dist/` — compiled output (ESM `.mjs` + CJS `.cjs` + type declarations)

### TypeScript

- Extends `@tsconfig/strictest` — very strict settings
- Target: ES2024, Module: NodeNext
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

## Testing

### Goals

- The project aims for 100% test coverage. Every new or changed code path must be covered by tests.
- Currently unit tests only; full E2E Obsidian Electron tests are planned for the next phase.

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

See `static/scripts/` for the full set of consumer examples.

## Current Task

### Architectural Vision: Improve DX + Testability of Plugin Base Classes

**Goal:** Make all base classes testable (remove v8 ignore comments) and simplify DX for ~23 consuming plugins. Currently PluginBase and related classes are fully untested.

#### Plugin Audit Results (2026-04-14)

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

#### Boilerplate Analysis (2026-04-14)

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

#### Proposed Architecture: Ideal DX

##### Goal: Minimal boilerplate, maximum testability, beginner-friendly

##### 1. Simplest possible plugin (no settings)

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

##### 2. Plugin with settings

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

##### 3. Plugin with custom settings tab

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

##### 4. Component-based architecture

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

##### 5. Command simplification

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

#### Summary of changes

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

#### Implementation plan (incremental PRs)

##### PR 1 (non-breaking): Internal testability refactor

- Break `plugin` dependency in manager/tab internals
- Add tests for all base classes
- Remove v8 ignore comments
- No consumer-facing API changes

##### PR 2 (breaking): Simplify generics + eliminate PluginTypes

- PluginBase becomes non-generic
- `PluginSettingsManagerBase<S>` and `PluginSettingsTabBase<S>`
- Delete plugin-types-base.ts and Extract* helpers
- Migration: delete PluginTypes.ts, update extends clauses

##### PR 3 (breaking): Merge settings triple + auto-generate tab

- PluginSettingsBase = data + validation + persistence
- Default settings tab auto-generated from properties
- Custom tab still supported via override
- Migration: merge 3 files into 1, update Plugin class

##### PR 4 (breaking): Command simplification

- Keep `addCommand()` as the primary API (it's already Obsidian-native)
- Deprecate CommandInvocationBase / CommandBase classes
- Migration: inline simple commands, keep classes for complex ones

##### PR 5 (optional): Decorator-based settings metadata

- `@setting()` decorator for auto-generating tab UI
- Only if the simpler approaches prove insufficient

##### Migration tooling

- Provide a codemod script (`jscodeshift` transform) for PRs 2-4
- Each PR gets its own migration guide
- Major version bump covers all breaking PRs

#### Files modified

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

### Plugin migrations (IN PROGRESS)

- **obsidian-edit-link-alias** — migrated (simple, no settings). Deleted PluginTypes.ts, removed generic from Plugin.
- **obsidian-new-note-fixer** — migrated (medium, with settings). Updated manager/tab constructors, deleted PluginTypes.ts.
- **Remaining ~21 plugins** — not yet migrated, awaiting approval of approach

### Migration pattern for consuming plugins

1. Delete `PluginTypes.ts`
2. `Plugin.ts`: Remove `<PluginTypes>` from `extends PluginBase<PluginTypes>` → `extends PluginBase`
3. `PluginSettingsManager.ts` → rename to `PluginSettingsComponent.ts`: Change `PluginSettingsManagerBase<PluginTypes>` → `PluginSettingsComponentBase<PluginSettings>`, constructor takes `params: PluginSettingsComponentParams`
4. `PluginSettingsTab.ts`: Change `PluginSettingsTabBase<PluginTypes>` → `PluginSettingsTabBase<PluginSettings>`, constructor takes `params: PluginSettingsTabBaseParams<PluginSettings>`
5. In Plugin constructor: `this.settingsComponent = this.registerComponent({ component: new PluginSettingsComponent({loadData: this.loadData.bind(this), saveData: this.saveData.bind(this)}), shouldPreload: true })`
6. `Plugin.createSettingsTab()`: Pass `{plugin: this, settingsComponent: this.settingsComponent}`
7. `this.settings` returns `ReadonlyDeep<object>` — cast to your settings type where needed

## Pending Questions

### Q1: i18n decoupling approach (auto-selected: B)

The i18n system uses `PluginTypes` for type-safe translations. Two options:

- A) Keep i18n coupled to a generic parameter (simpler, but PluginBase stays generic)
- B) Decouple i18n from PluginTypes entirely — `initI18N()` takes a plain `TranslationsMap` without generic constraints
- **Auto-selected B** because only 2/23 plugins use custom translations, and making PluginBase non-generic is the primary goal.

### Q2: Settings persistence approach (auto-selected: A, implemented)

Settings persistence uses `loadData`/`saveData` callbacks passed to `PluginSettingsComponentBase` constructor — cleanest DI, no plugin dependency.

## Commits

- Conventional Commits enforced via commitlint + husky (commit-msg hook)
- nano-staged runs spellcheck, compilation, lint, and format on staged files via husky pre-commit hook
- Use `npm run commit` (Commitizen) for guided commit messages
- Before each commit, run these commands and ensure they complete without errors:
  - `npm run spellcheck`
  - `npm run build:compile:typescript`
  - `npm run lint:fix`
  - `npm run format`
