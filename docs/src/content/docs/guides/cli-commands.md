---
title: Commands
description: Build, lint, test, format, spellcheck, and release commands, callable from a script or the CLI.
---

`Obsidian Dev Utils` exposes command functions from tool-specific modules. Each tool is identified by its import path. You can import and call them directly:

```typescript
import { build } from 'obsidian-dev-utils/script-utils/bundlers/esbuild/obsidian-plugin-builder';

await build();
```

## Available Commands

### Build Production Version

```typescript
import { build } from 'obsidian-dev-utils/script-utils/bundlers/esbuild/obsidian-plugin-builder';
```

Compiles the production version of your plugin into the `dist/build` folder.

### Clean build folder

```typescript
import { buildClean } from 'obsidian-dev-utils/script-utils/build';
```

Cleans `dist` folder.

### Compile code

```typescript
import { buildCompile } from 'obsidian-dev-utils/script-utils/build';
```

Checks if code compiles.

### Compile Svelte code

```typescript
import { buildCompileSvelte } from 'obsidian-dev-utils/script-utils/build';
```

Checks if Svelte code compiles, by running `svelte-check`.

The project is scanned for `.svelte`, `.svelte.js` and `.svelte.ts` files (ignoring `node_modules`, `dist`,
and whatever the `tsconfig.json` `exclude` lists). When there are none, the step is skipped. When there are
some, the project must declare `svelte-check` as a dependency — otherwise the step fails with an error
naming it, rather than silently skipping the check or pulling the tool from the registry mid-build.

### Compile TypeScript code

```typescript
import { buildCompileTypeScript } from 'obsidian-dev-utils/script-utils/build';
```

Checks if TypeScript code compiles.

### Build templates

```typescript
import { buildTemplates } from 'obsidian-dev-utils/script-utils/build';
```

Copies the `templates` folder to the `dist/templates` folder, stripping a trailing `.template` from
each file name (e.g. `eslint.config.mts.template` is copied as `eslint.config.mts`).

### Build Development Version

```typescript
import { dev } from 'obsidian-dev-utils/script-utils/bundlers/esbuild/obsidian-plugin-builder';
```

Compiles the development version of your plugin into the `dist/dev` folder. The `OBSIDIAN_CONFIG_FOLDER` can be set either as an environment variable or specified in a `.env` file (e.g., `path/to/my/vault/.obsidian`). The command automatically copies the compiled plugin to the specified Obsidian configuration folder. It then launches a dedicated Obsidian instance and, through it, installs the [Hot Reload] plugin from the official community store if it is not already installed, enables it if it is disabled, and enables your plugin — so [Hot Reload] automatically refreshes your plugin on every rebuild.

### Format Code

```typescript
import { format } from 'obsidian-dev-utils/script-utils/formatters/dprint/dprint';
```

Formats your code using [dprint](https://dprint.dev/).

### Check Code Formatting

```typescript
import { format } from 'obsidian-dev-utils/script-utils/formatters/dprint/dprint';

await format(false);
```

Checks formatting of your code using [dprint](https://dprint.dev/).

### Lint Code

```typescript
import { lint } from 'obsidian-dev-utils/script-utils/linters/eslint/eslint';
```

Lints your code, enforcing a code convention to minimize common errors.

This command is looking for `ESLint` config file in the root of your project and if it's not found, it creates it referencing the default configuration.

### Lint and Fix Code

```typescript
import { lint } from 'obsidian-dev-utils/script-utils/linters/eslint/eslint';

await lint(true);
```

Lints your code and automatically applies fixes where possible.

This command is looking for `ESLint` config file in the root of your project and if it's not found, it creates it referencing the default configuration.

### Lint Markdown

```typescript
import { lint } from 'obsidian-dev-utils/script-utils/linters/markdownlint/markdownlint';
```

Lints your markdown documentation.

This command is looking for existing `markdownlint-cli2` config file in the root of your project and if it's not found, it creates it referencing the default configuration.

### Lint and Fix Markdown

```typescript
import { lint } from 'obsidian-dev-utils/script-utils/linters/markdownlint/markdownlint';

await lint(true);
```

Lints your markdown documentation and automatically applies fixes where possible.

This command is looking for existing `markdownlint-cli2` config file in the root of your project and if it's not found, it creates it referencing the default configuration.

### Find Over-Exposed Declarations

```typescript
import { findOverExposure } from 'obsidian-dev-utils/script-utils/linters/over-exposure';
```

Reports declarations that are exposed more broadly than their references require, so the exposure can be tightened: an `export`ed symbol referenced only within its own file (the `export` can be dropped), or a `public`/`protected` class member referenced only inside its own class (it can be `private`) or its subclasses (it can be `protected`). The analysis is whole-program and type-aware, so it cannot run per-file — like the unit tests, it parses the entire project.

The command exits with a non-zero code when any over-exposure is found, so it can gate a release. A class member that carries a TSDoc (`/** … */`) documentation comment is treated as intentional public API and is never reported; lifecycle, `override`, and `static` members are likewise excluded, and a member kept wide only because of references from test files is flagged separately. When a `find-overexposed` npm script is defined, [Version Management](#version-management) runs it automatically as part of its preflight checks.

### Find and Fix Over-Exposed Declarations

```typescript
import { findOverExposure } from 'obsidian-dev-utils/script-utils/linters/over-exposure';

findOverExposure({ projectFolder: process.cwd(), shouldFix: true });
```

Tightens every safely-fixable over-exposure in place (drops the `export` keyword, or inserts/replaces a `private`/`protected` modifier). Findings that cannot be safely automated — exposed only for tests, decorated, or sharing an `export` with a still-exported sibling — are reported and left untouched. The command exits with a non-zero code if any such unfixable finding remains.

Pass `shouldForce: true` (or the `--force` flag on the `find-overexposed:fix` script, e.g. `npm run find-overexposed:fix -- --force`) to additionally tighten the declarations held wide purely by test references. This performs the production half of the test-only migration — the member becomes `private` / the `export` is dropped — leaving only the test to switch to a cast-based access (after which it no longer references the now-tightened symbol). Decorated members and exports shared with a still-exported sibling stay skipped even under `--force`, because no edit can be applied safely.

### Publish

```typescript
import { publish } from 'obsidian-dev-utils/script-utils/npm-publish';
```

Publishes the package to NPM. Usually not applicable for plugins.

The command carries no credentials of its own. Run it from a CI job registered as a [trusted publisher](https://docs.npmjs.com/trusted-publishers) for the package on npmjs.com: there the npm CLI exchanges the job's short-lived OIDC token for a publish grant, so no NPM token has to exist on any machine, and the published package gets provenance for free. It requires npm `11.5.1` or later. This library publishes itself that way from `.github/workflows/publish-npm.yml`, triggered by the GitHub release that [Version Management](#version-management) creates.

### Spellcheck Code

```typescript
import { spellcheck } from 'obsidian-dev-utils/script-utils/linters/cspell/cspell';
```

Checks your code for spelling errors.

### Test

```typescript
import { test } from 'obsidian-dev-utils/script-utils/test-runners/vitest/vitest';
```

Runs the test suite using Vitest.

### Test with Coverage

```typescript
import { testCoverage } from 'obsidian-dev-utils/script-utils/test-runners/vitest/vitest';
```

Runs the test suite with v8 coverage reporting.

### Test Watch Mode

```typescript
import { testWatch } from 'obsidian-dev-utils/script-utils/test-runners/vitest/vitest';
```

Runs the test suite in watch mode.

### Version Management

```typescript
import { updateVersion } from 'obsidian-dev-utils/script-utils/version';
```

Runs preflight checks before updating the version and releases if all checks pass. The checks are the clean-repo check, formatting, spellcheck, lint, over-exposure analysis (when a `find-overexposed` script is defined), and tests. The build always runs as well — it is a publishing prerequisite, not a verification check, so even a fast release ships artifacts that match the current code (use `--no-build` only when the build output is already known to be current).

If you use `beta` as version update type for your Obsidian plugin, the plugin will be deployed compatible to install with [BRAT](https://community.obsidian.md/plugins/obsidian42-brat).

Additionally, the script fetches the latest stable Obsidian version, which is used to update the `minAppVersion` in `manifest.json` and to add a new entry to `versions.json`.

For the script to be able to publish releases in your repository, you need to ensure your `GitHub` token has `Read and write permissions` in `Settings > Actions > General`.

The script stops at the GitHub release — it does not publish to NPM. An NPM package publishes itself from CI instead, so the publish can authenticate as a [trusted publisher](#publish) rather than with a long-lived token; a workflow triggered by the GitHub release runs [Publish](#publish).

#### Flags

The version script accepts the following optional flags (pass them after the version update type). Most behaviors are enabled by default and the corresponding `--no-*` flag turns them off; `--changelog-file` and `--min-app-version` take a value instead and have no default. When invoking via `npm run`, separate the flags with `--`, e.g. `npm run version -- patch --no-release`:

| Flag                        | Effect                                                                                                                                                                 |
|-----------------------------|------------------------------------------------------------------------------------------------------------------------------------------------------------------------|
| `--changelog-file=<path>`   | Uses that file's contents as the new version's changelog section instead of the commit-derived bullets, and skips the interactive review entirely.                     |
| `--min-app-version=<x.y.z>` | Writes this `minAppVersion` into the plugin's `manifest.json` and its new `versions.json` entry instead of tracking the latest Obsidian desktop version.               |
| `--no-build`                | Skips the build step. Use only when the build output is already known to match the current code; otherwise the release would publish stale artifacts.                  |
| `--no-changelog-editing`    | Generates the changelog from commit messages but skips opening it for manual review.                                                                                   |
| `--no-checks`               | Skips the clean-repo check, formatting, spellcheck, lint, over-exposure analysis, and tests. The build still runs. Useful when resuming a release whose code is green. |
| `--no-commit-verification`  | Passes `--no-verify` to the release commit, skipping the pre-commit hook.                                                                                              |
| `--no-release`              | Runs all local steps (version bump, changelog, commit, tag) but skips the push and the GitHub release.                                                                 |

#### The changelog step

By default the script generates the changelog from the commit messages and opens it for review — in Visual Studio Code when `code` is on your `PATH`, otherwise by waiting at the console. Two things make that safe to interrupt and safe to automate:

- **The review runs on a scratch copy in the temporary folder, and the version bump waits for it.** The repository's `CHANGELOG.md`, `package.json`, `manifest.json` and `versions.json` are all written only after the review is over, so interrupting the review leaves your working tree exactly as it was and the whole release can simply be re-run. (Previously the bump happened first, so an interrupt stranded a half-bumped tree that the clean-repo check then refused to release.)
- **A run without an interactive terminal refuses immediately rather than blocking.** Because the review can only be answered by a human, `updateVersion` checks for a TTY in its preflight — before the checks and the build — and fails within seconds with a message naming the two ways out. For an automated release, pass `--changelog-file=<path>` to supply prepared release notes, or `--no-changelog-editing` to accept the generated changelog as is.

If the release commit fails (for example, the pre-commit hook rejects a new word in the freshly generated changelog) and you are running in an interactive terminal, the script prints the error and prompts you to fix the issue (for example, add the missing word to `cspell.json`) and press Enter to retry. The retry re-stages all files and re-commits, so the fix is picked up without restarting the whole release lifecycle and without bumping the version again.

In a non-interactive environment (no TTY, such as CI), the script does not prompt — it re-throws the commit error and fails fast instead of hanging. For automated releases, use `--no-commit-verification` to skip the pre-commit hook so the commit cannot fail on it in the first place.

## Simplified Usage

To use these commands in your `package.json`, create script entry points using [jiti](https://github.com/unjs/jiti):

```json
{
  "scripts": {
    "build": "jiti scripts/build.ts",
    "build:clean": "jiti scripts/build-clean.ts",
    "build:compile": "jiti scripts/build-compile.ts",
    "build:templates": "jiti scripts/build-templates.ts",
    "dev": "jiti scripts/dev.ts",
    "find-overexposed": "jiti scripts/find-overexposed.ts",
    "find-overexposed:fix": "jiti scripts/find-overexposed-fix.ts",
    "format": "jiti scripts/format.ts",
    "format:check": "jiti scripts/format-check.ts",
    "lint": "jiti scripts/lint.ts",
    "lint:fix": "jiti scripts/lint-fix.ts",
    "spellcheck": "jiti scripts/spellcheck.ts",
    "test": "jiti scripts/test.ts",
    "version": "jiti scripts/version.ts"
  },
  "...": "..."
}
```

Each script file follows this pattern:

```typescript
import { build } from 'obsidian-dev-utils/script-utils/bundlers/esbuild/obsidian-plugin-builder';

await build();
```

This setup allows you to run the commands using `npm run`, like `npm run build`.

### Copying the bundled templates

You do not have to write these script and config files by hand. Ready-made templates ship inside the installed package, so after `npm install obsidian-dev-utils` you can copy them out of `node_modules/obsidian-dev-utils/dist/templates`:

- `dist/templates/scripts/` — the script entry points. The per-tool scripts are grouped by the module they use (`build/`, `bundlers/`, `formatters/`, `linters/`, `test-runners/`, `version/`), and the shared config logic files sit at the top level (`commitlint-config.ts`, `eslint-config.ts`, `vitest-config.ts`, `markdownlint-cli2-config.ts`, `nano-staged-config.ts`). Copy the files you need into your project's `scripts/` folder, naming each one to match the `package.json` script that runs it.
- `dist/templates/` (top level) — the thin root config files a project keeps at its root: `commitlint.config.ts`, `eslint.config.mts`, `vitest.config.ts`, `dprint.json`, `.markdownlint-cli2.mjs`, and `.nano-staged.mjs`. Each one re-exports its matching `scripts/*-config.ts`, so copy both halves together.

The `commitlint-config`, `markdownlint-cli2-config`, `nano-staged-config`, and `vitest-config` templates work as-is; `eslint-config` is a baseline you adapt to your plugin.

## Skipping pre-commit checks

The shared nano-staged configuration runs file-based lint, format, and spellcheck on staged files via the husky pre-commit hook. To skip these checks for a single developer or machine — without exporting a shell-specific environment variable — set `NANO_STAGED` to an off value (`0`, `false`, `off`, or `no`) in a gitignored `.env` file at the project root:

```dotenv
NANO_STAGED=0
```

The `.env` file is read by Node itself, so this works the same on every platform and shell. It mirrors husky's own `HUSKY=0`, but scoped to the nano-staged step — the commit-message (commitlint) hook still runs. Remove the line (or set any other value) to re-enable the checks.

## Skipping an individual command

Every command above can be switched off the same way. The rule is mechanical, so it covers **every** npm script — the ones below, and any project-specific script you add: take the script's own name, uppercase it, and replace every non-alphanumeric character with `_`.

| Script                     | Switch                       |
|----------------------------|------------------------------|
| `build`                    | `BUILD=0`                    |
| `build:clean`              | `BUILD_CLEAN=0`              |
| `build:compile`            | `BUILD_COMPILE=0`            |
| `build:compile:svelte`     | `BUILD_COMPILE_SVELTE=0`     |
| `build:compile:typescript` | `BUILD_COMPILE_TYPESCRIPT=0` |
| `build:templates`          | `BUILD_TEMPLATES=0`          |
| `commit`                   | `COMMIT=0`                   |
| `dev`                      | `DEV=0`                      |
| `find-overexposed`         | `FIND_OVEREXPOSED=0`         |
| `find-overexposed:fix`     | `FIND_OVEREXPOSED_FIX=0`     |
| `format`                   | `FORMAT=0`                   |
| `format:check`             | `FORMAT_CHECK=0`             |
| `lint`                     | `LINT=0`                     |
| `lint:fix`                 | `LINT_FIX=0`                 |
| `lint:md`                  | `LINT_MD=0`                  |
| `lint:md:fix`              | `LINT_MD_FIX=0`              |
| `prepare`                  | `PREPARE=0`                  |
| `publish`                  | `PUBLISH=0`                  |
| `spellcheck`               | `SPELLCHECK=0`               |
| `test`                     | `TEST=0`                     |
| `test:coverage`            | `TEST_COVERAGE=0`            |
| `test:watch`               | `TEST_WATCH=0`               |
| `version`                  | `VERSION=0`                  |

Set it for one invocation, or park it in the gitignored `.env` file to keep it off:

```shell
LINT_MD=0 npm run lint:md
```

The command prints `Skipped (LINT_MD is off).` and exits successfully, so a composite script or a CI step that runs it does not fail. The same off values apply (`0`, `false`, `off`, `no`); anything else — including leaving the variable unset — runs the command normally.

Because each step of a composite script is itself an `npm run`, the switches nest: `BUILD=0` skips the whole build, while `BUILD_CLEAN=0` skips only that one step of it. Running a script directly (`jiti scripts/lint.ts`) bypasses npm, so nothing is skipped.

## Ignored paths follow `.gitignore`

The commands that walk the whole project — `lint`, `lint:md`, `format`, `spellcheck` — skip whatever `.gitignore` skips, rather than each keeping its own list of folders to avoid. A generated or build folder is therefore excluded from every check the moment it is gitignored, and nested `node_modules` under test fixtures are never walked.

This is wired per tool: ESLint reads `.gitignore` through its ignore-file config, dprint respects it natively, `markdownlint-cli2` uses `gitignore: true`, and cspell is invoked with `--gitignore`. Only paths git does **not** ignore — a checked-in folder you nonetheless want a given tool to skip — still need an explicit entry in that tool's own config.

[Hot Reload]: https://community.obsidian.md/plugins/hot-reload
