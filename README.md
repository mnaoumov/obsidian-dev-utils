# Obsidian Dev Utils

[![Buy Me a Coffee](https://img.shields.io/badge/Buy%20Me%20a%20Coffee-ffdd00?logo=buy-me-a-coffee&logoColor=black)](https://www.buymeacoffee.com/mnaoumov) [![NPM package](https://badge.fury.io/js/obsidian-dev-utils.svg)](https://www.npmjs.com/package/obsidian-dev-utils) [![GitHub release](https://img.shields.io/github/v/release/mnaoumov/obsidian-dev-utils)](https://github.com/mnaoumov/obsidian-dev-utils/releases) [![GitHub downloads](https://img.shields.io/github/downloads/mnaoumov/obsidian-dev-utils/total)](https://github.com/mnaoumov/obsidian-dev-utils/releases)

> [!WARNING]
> `obsidian-dev-utils` is retired and receives no further code changes. Use [`@mnaoumov/obsidian-lib`](https://www.npmjs.com/package/@mnaoumov/obsidian-lib) for the plugin runtime and [`@mnaoumov/obsidian-dev-toolkit`](https://www.npmjs.com/package/@mnaoumov/obsidian-dev-toolkit) for the build, lint, test and release tooling. The import map below says where each module went.

`Obsidian Dev Utils` was a collection of functions and utilities for Obsidian plugin development. It has been split into the five packages below.

## Why it was retired

`obsidian-dev-utils` grew into one package that held four different things: Obsidian plugin runtime code, generic TypeScript helpers, build and release tooling, and test support. Splitting it fixes three problems that a single package could not:

1. **Most of it was not Obsidian-specific.** The async, error, path, string and debug helpers, and the build, lint and test tooling, are useful in any TypeScript project. Inside a package named `obsidian-dev-utils` they could not be used cleanly by projects that have nothing to do with Obsidian. They now live in `@mnaoumov/typescript-lib`, `@mnaoumov/typescript-dev-toolkit` and `@mnaoumov/typescript-test-toolkit`.
2. **Runtime code and tooling were one dependency.** A plugin that only needed the runtime helpers still installed esbuild, ESLint and the rest of the tooling with them. Now the runtime (`@mnaoumov/obsidian-lib`) goes in `dependencies` and the tooling (`@mnaoumov/obsidian-dev-toolkit`) goes in `devDependencies`.
3. **Test helpers could end up in a shipped plugin.** Helpers such as `strictProxy` and the async-operation tracking are for tests only. As a separate package that you install as a dev dependency, they cannot be imported into production code by mistake.

Keeping `obsidian-dev-utils` as a thin package that re-exports the new ones was considered and dropped: it would have kept the old, misleading name alive and hidden the runtime/tooling split. So the last release, `107.5.0`, re-exports nothing. Existing plugins keep working on the version they pin. To move, follow the import map below.

Nothing was lost in the move: the code, its history and its tests continue in the new repositories.

## Packages

| Package | What it holds |
| --- | --- |
| [`@mnaoumov/obsidian-lib`](https://www.npmjs.com/package/@mnaoumov/obsidian-lib) | The Obsidian plugin runtime library: plugin base classes, components, settings, modals, vault and metadata helpers. |
| [`@mnaoumov/obsidian-dev-toolkit`](https://www.npmjs.com/package/@mnaoumov/obsidian-dev-toolkit) | Obsidian plugin tooling: the esbuild plugin builder, shared ESLint and Vitest configs, demo vaults, the plugin release script. |
| [`@mnaoumov/typescript-lib`](https://www.npmjs.com/package/@mnaoumov/typescript-lib) | Generic TypeScript utilities for any project: async helpers, errors, disposables, strings, paths, debug logging. |
| [`@mnaoumov/typescript-test-toolkit`](https://www.npmjs.com/package/@mnaoumov/typescript-test-toolkit) | Generic test support: Vitest/Jest setup, async-operation tracking, `strictProxy`, mock helpers. |
| [`@mnaoumov/typescript-dev-toolkit`](https://www.npmjs.com/package/@mnaoumov/typescript-dev-toolkit) | Generic project tooling: build, lint, format, spellcheck, test, gate and release scripts. |

## Import map

| `obsidian-dev-utils` import | New import |
| --- | --- |
| `obsidian-dev-utils/obsidian/<x>` | `@mnaoumov/obsidian-lib/<x>` (the `obsidian/` segment is gone) |
| `obsidian-dev-utils/script-utils/<x>` | `@mnaoumov/obsidian-dev-toolkit/<x>` for the Obsidian-specific tooling (the esbuild plugin builder, demo vaults, the plugin release), otherwise `@mnaoumov/typescript-dev-toolkit/<x>` |
| `obsidian-dev-utils/<x>` (generic runtime: `async`, `error`, `path`, `string`, ...) | `@mnaoumov/typescript-lib/<x>` |
| `obsidian-dev-utils/setup`, `vitest-setup`, `jest-setup`, `strict-proxy` | `@mnaoumov/typescript-test-toolkit/<x>`, or `@mnaoumov/obsidian-dev-toolkit/vitest-setup` in an Obsidian plugin |
| `waitForAllAsyncOperations` and the other async-operation tracking functions | `@mnaoumov/typescript-test-toolkit/async-operation-tracking` |

The in-house ESLint rules moved too: `obsidian-dev-utils/<rule>` is now `typescript-dev-toolkit/<rule>` or `obsidian-dev-toolkit/<rule>`, so `eslint-disable` comments naming the old namespace need rewriting.

## What is Obsidian?

[Obsidian](https://obsidian.md/) is a powerful knowledge base that works on top of a local folder of plain text Markdown files. It's a tool that lets you take notes and organize them, and it supports a rich plugin ecosystem that allows for extensive customization.

## Installation

Do not install `obsidian-dev-utils`. Install only the successor package you need. For Obsidian runtime helpers:

```bash
npm install @mnaoumov/obsidian-lib
```

Build, lint, test and release tooling is optional and can be adopted separately:

```bash
npm install --save-dev @mnaoumov/obsidian-dev-toolkit @mnaoumov/typescript-dev-toolkit
```

Declare `@mnaoumov/typescript-lib` and `@mnaoumov/typescript-test-toolkit` too when the plugin imports them directly.

## Adopt one helper first

You can use a single helper without adopting a new plugin base class, settings system or build pipeline. Both runtime packages expose individual modules. Import from the module you need, such as `@mnaoumov/typescript-lib/string` or `@mnaoumov/obsidian-lib/vault`, instead of the package root. These entry points still include their own dependencies; a focused import does not mean a dependency-free bundle.

For a first change with no Obsidian API requirements, install the generic runtime library:

```bash
npm install @mnaoumov/typescript-lib
```

Suppose your plugin normalizes generated text before saving it:

```ts
const normalized = text.replace(/\r\n/g, '\n');
```

Replace just that operation:

```ts
import { ensureLfEndings } from '@mnaoumov/typescript-lib/string';

const normalized = ensureLfEndings(text);
```

The helper also normalizes lone carriage returns, so check whether that broader behavior suits your input. Keep the rest of the plugin unchanged. Run your existing typecheck, tests and build, then exercise the affected command in a development vault. Check text containing Windows line endings, Unix line endings, lone carriage returns and no newline before committing this small change. You can stop here; no other package or migration step is required.

For an Obsidian-specific example, install `@mnaoumov/obsidian-lib` and use `createFolderSafe` in an existing plugin command. Check the chosen release's peer dependencies and API requirements first: installing a runtime library does not make its APIs available on older Obsidian versions. The plugin's `minAppVersion` must cover the APIs it actually uses.

```ts
import { createFolderSafe } from '@mnaoumov/obsidian-lib/vault';
import { Plugin } from 'obsidian';

export default class ExamplePlugin extends Plugin {
  override onload(): void {
    this.addCommand({
      id: 'create-example-folder',
      name: 'Create example folder',
      callback: async () => {
        await createFolderSafe(this.app, 'Example');
      }
    });
  }
}
```

In your plugin, add the import and callback to your existing class rather than replacing it with this example. Choose a path that is not occupied by a file: this helper skips creation when the adapter reports an existing path. Run the command twice in a development vault: the first run creates `Example`, and the second succeeds with the existing folder. This helper does not require the library's plugin base class or its tooling.

## Migrate an existing ODU plugin in stages

Each stage should leave a working plugin. Keep your current `obsidian-dev-utils` version pinned while it still supplies imports or scripts; do not upgrade it to the empty retirement release as a migration step.

1. **Record a working baseline.** Commit or back up the plugin, run its existing checks, and load it in a development vault. Search source, tests, configs and scripts for `obsidian-dev-utils`, including `eslint-disable` comments. Sort the matches using the import map above: generic runtime, Obsidian runtime, tests and tooling.
2. **Move one generic runtime import.** Install `@mnaoumov/typescript-lib` as a direct dependency and change one import, for example `obsidian-dev-utils/string` to `@mnaoumov/typescript-lib/string`. Check the current function signature rather than assuming the package move preserved every API. Run the same checks and exercise that behavior, then commit. Repeat for the remaining generic helpers when ready.
3. **Move one Obsidian runtime import.** Check the selected `@mnaoumov/obsidian-lib` release's peers against your supported Obsidian versions, then install it as a direct dependency. For example, change `obsidian-dev-utils/obsidian/vault` to `@mnaoumov/obsidian-lib/vault`. Rebuild and test the affected feature in Obsidian, including a supported older version if applicable, then commit. Helpers can be adopted independently; migrating a library base class is a separate change only if your plugin already uses one or needs its features.
4. **Move test support separately.** Install `@mnaoumov/typescript-test-toolkit` as a dev dependency for generic test helpers, or `@mnaoumov/obsidian-dev-toolkit` for its Obsidian test setup. Update the test imports and setup config together, following the import map. Run the tests before committing. Keep test setup out of production entry points.
5. **Choose whether to migrate tooling.** Your existing esbuild, ESLint and release setup can remain in place if it does not import ODU. Where it does, move the Obsidian-specific scripts/configs to `@mnaoumov/obsidian-dev-toolkit` and generic tooling to `@mnaoumov/typescript-dev-toolkit`, both as dev dependencies. Use the successor documentation below for the current configuration and command APIs; this is more than a blanket import-prefix replacement. Update old ESLint rule namespaces too. Validate one config or command at a time and inspect the resulting plugin bundle before committing.
6. **Remove ODU last.** Search again for `obsidian-dev-utils` in source, tests, configs and scripts. Once no active references remain, run `npm uninstall obsidian-dev-utils`, rebuild, run the full existing checks and reload the plugin in the development vault. Inspect the lockfile for unexpected remaining dependencies and verify that test helpers or Node-only tooling have not entered the shipped plugin. Commit the removal separately so each earlier stage remains easy to review or revert.

If a stage fails, revert that stage's source and dependency/lockfile changes together, then return to the last working checkpoint. An unconverted import may stay on the pinned old package while you migrate others. The old package receives no fixes, so that coexistence is a transition rather than an ongoing upgrade strategy.

## Usage

The documentation moved to one site per package. Every page the old site at [mnaoumov.dev/obsidian-dev-utils](https://mnaoumov.dev/obsidian-dev-utils/) served now redirects to the page that replaced it.

- [`@mnaoumov/obsidian-lib`](https://mnaoumov.dev/obsidian-lib/) — plugin helpers, modals, popovers, setting components, styling, debugging, cross-plugin APIs and the plugin API protocol.
- [`@mnaoumov/obsidian-dev-toolkit`](https://mnaoumov.dev/obsidian-dev-toolkit/) — getting started, commands, the demo vault and testing a plugin.
- [`@mnaoumov/typescript-lib`](https://mnaoumov.dev/typescript-lib/) — the generic helper functions.
- [`@mnaoumov/typescript-test-toolkit`](https://mnaoumov.dev/typescript-test-toolkit/) — the generic test setup.
- [`@mnaoumov/typescript-dev-toolkit`](https://mnaoumov.dev/typescript-dev-toolkit/) — the generic build, lint and release tooling.

## See also

[My other Obsidian resources](https://mnaoumov.dev/obsidian/)

| Library | Features | How `obsidian-dev-utils` differs |
| --- | --- | --- |
| [`@javalent/utilities`](https://github.com/javalent/utilities) | File and folder suggesters; settings helpers | Broader: adds plugin base classes, modals, vault and metadata helpers, and build, lint, test and release tooling; omits ready-made file and folder suggesters |
| [`@polyipseity/obsidian-plugin-library`](https://github.com/polyipseity/obsidian-plugin-library) | Plugin context; settings managers and settings-tab widgets; i18n; modals; status bar; icons; patching helpers | Same goal: a runtime library for plugins; adds build, lint, test and release tooling and test helpers in the same package |
| [`@vrtmrz/obsidian-plugin-kit`](https://github.com/vrtmrz/fancy-kit/tree/main/packages/obsidian-plugin-kit) | Prompt, selection and confirmation dialogs; keyed and progress notices; vault and command helpers; App-free test harness; secret and local-storage adapters | Overlaps on dialogs, notices and vault helpers; adds plugin base classes, settings, and build, lint and release tooling; omits secret and local-storage adapters |
| [`obsidian-community-lib`](https://github.com/community-archive/obsidian-community-lib) | Note creation and opening; link resolution checks; hover preview; rendered-Markdown modal; icons | Same goal: commonly used plugin functions; adds plugin base classes, settings, and build, lint, test and release tooling |
| [`obsidian-extra`](https://github.com/eth-p/obsidian-extra) | Version-agnostic wrappers for undocumented APIs: installed and enabled plugins, themes, CSS snippets, view registry | Covers part of its plugin-internals ground; adds vault, metadata, settings and modal helpers and tooling; omits theme and CSS-snippet helpers |
| [`obsidian-tools`](https://github.com/obsidian-tools/obsidian-tools) | Project scaffolder; plugin development CLI; installed and registry plugin information; release automation | Overlaps on build and release tooling; adds the plugin runtime library and test helpers; omits a project scaffolder |

Last searched for similar libraries on 2026-11-04.

## Support

<!-- markdownlint-disable MD033 -->

<a href="https://www.buymeacoffee.com/mnaoumov" target="_blank"><img src="https://cdn.buymeacoffee.com/buttons/v2/default-yellow.png" alt="Buy Me A Coffee" height="60" width="217"></a>

<!-- markdownlint-enable MD033 -->

## License

© [Michael Naumov](https://github.com/mnaoumov/)
