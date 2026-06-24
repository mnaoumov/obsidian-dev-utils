# Commands

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

Checks if Svelte code compiles.

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

Compiles the development version of your plugin into the `dist/dev` folder. The `OBSIDIAN_CONFIG_FOLDER` can be set either as an environment variable or specified in a `.env` file (e.g., `path/to/my/vault/.obsidian`). The command automatically copies the compiled plugin to the specified Obsidian configuration folder and triggers the [Hot Reload] plugin, if it is enabled. If the [Hot Reload] plugin is not installed, it will be installed automatically, and you will need to enable it manually.

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

### Publish

```typescript
import { publish } from 'obsidian-dev-utils/script-utils/npm-publish';
```

Publishes the package to NPM. Usually not applicable for plugins.

To bypass manual verification, consider setting `NPM_TOKEN` to the environment variable or in your `.env` file.

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

#### Flags

The version script accepts the following optional flags (pass them after the version update type). Each behavior is enabled by default; the corresponding `--no-*` flag turns it off. When invoking via `npm run`, separate the flags with `--`, e.g. `npm run version -- patch --no-release`:

| Flag                       | Effect                                                                                                                                                                 |
|----------------------------|------------------------------------------------------------------------------------------------------------------------------------------------------------------------|
| `--no-build`               | Skips the build step. Use only when the build output is already known to match the current code; otherwise the release would publish stale artifacts.                  |
| `--no-changelog-editing`   | Generates the changelog from commit messages but skips opening it for manual review.                                                                                   |
| `--no-checks`              | Skips the clean-repo check, formatting, spellcheck, lint, over-exposure analysis, and tests. The build still runs. Useful when resuming a release whose code is green. |
| `--no-commit-verification` | Passes `--no-verify` to the release commit, skipping the pre-commit hook.                                                                                              |
| `--no-release`             | Runs all local steps (version bump, changelog, commit, tag) but skips the push and the GitHub release.                                                                 |

If the release commit fails (for example, the pre-commit hook rejects a new word in the freshly generated changelog) and you are running in an interactive terminal, the script prints the error and prompts you to fix the issue (for example, add the missing word to `cspell.json`) and press Enter to retry. The retry re-stages all files and re-commits, so the fix is picked up without restarting the whole release lifecycle and without bumping the version again.

In a non-interactive environment (no TTY, such as CI), the script does not prompt — it re-throws the commit error and fails fast instead of hanging. For automated releases, use `--no-commit-verification` to skip the pre-commit hook so the commit cannot fail on it in the first place.

## Simplified Usage

To use these commands in your `package.json`, create script entry points using [jiti](https://github.com/unjs/jiti):

```json
{
  "scripts": {
    "build": "jiti scripts/build.ts",
    "build:clean": "jiti scripts/build-clean.ts",
    "build:compile:typescript": "jiti scripts/build-compile-typescript.ts",
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

The `commitlint-config`, `markdownlint-cli2-config`, and `nano-staged-config` templates work as-is; `eslint-config` and `vitest-config` are baselines you adapt to your plugin.

## Skipping pre-commit checks

The shared nano-staged configuration runs file-based lint, format, and spellcheck on staged files via the husky pre-commit hook. To skip these checks for a single developer or machine — without exporting a shell-specific environment variable — set `NANO_STAGED` to an off value (`0`, `false`, `off`, or `no`) in a gitignored `.env` file at the project root:

```dotenv
NANO_STAGED=0
```

The `.env` file is read by Node itself, so this works the same on every platform and shell. It mirrors husky's own `HUSKY=0`, but scoped to the nano-staged step — the commit-message (commitlint) hook still runs. Remove the line (or set any other value) to re-enable the checks.

[Hot Reload]: https://github.com/pjeby/hot-reload
