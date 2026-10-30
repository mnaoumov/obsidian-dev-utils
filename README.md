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

Do not install `obsidian-dev-utils`. A plugin installs the new packages instead:

```bash
npm install @mnaoumov/obsidian-lib
npm install --save-dev @mnaoumov/obsidian-dev-toolkit @mnaoumov/typescript-dev-toolkit
```

Declare `@mnaoumov/typescript-lib` and `@mnaoumov/typescript-test-toolkit` too when the plugin imports them directly.

## Usage

The documentation moved to one site per package. Every page the old site at [mnaoumov.dev/obsidian-dev-utils](https://mnaoumov.dev/obsidian-dev-utils/) served now redirects to the page that replaced it.

- [`@mnaoumov/obsidian-lib`](https://mnaoumov.dev/obsidian-lib/) — plugin helpers, modals, popovers, setting components, styling, debugging, cross-plugin APIs and the plugin API protocol.
- [`@mnaoumov/obsidian-dev-toolkit`](https://mnaoumov.dev/obsidian-dev-toolkit/) — getting started, commands, the demo vault and testing a plugin.
- [`@mnaoumov/typescript-lib`](https://mnaoumov.dev/typescript-lib/) — the generic helper functions.
- [`@mnaoumov/typescript-test-toolkit`](https://mnaoumov.dev/typescript-test-toolkit/) — the generic test setup.
- [`@mnaoumov/typescript-dev-toolkit`](https://mnaoumov.dev/typescript-dev-toolkit/) — the generic build, lint and release tooling.

## Support

<!-- markdownlint-disable MD033 -->

<a href="https://www.buymeacoffee.com/mnaoumov" target="_blank"><img src="https://cdn.buymeacoffee.com/buttons/v2/default-yellow.png" alt="Buy Me A Coffee" height="60" width="217"></a>

<!-- markdownlint-enable MD033 -->

## My other Obsidian resources

[See my other Obsidian resources](https://github.com/mnaoumov/obsidian-resources).

## License

© [Michael Naumov](https://github.com/mnaoumov/)
