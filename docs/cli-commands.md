# Commands

`Obsidian Dev Utils` exposes all command functions as named exports from `obsidian-dev-utils/ScriptUtils/Commands`. Each command handles error catching, process exit codes, and watch-mode lifecycle internally. You can import and call them directly:

```typescript
import { build } from 'obsidian-dev-utils/ScriptUtils/Commands';

await build();
```

## Available Commands

### Build Production Version

```typescript
import { build } from 'obsidian-dev-utils/ScriptUtils/Commands';
```

Compiles the production version of your plugin into the `dist/build` folder.

### Clean build folder

```typescript
import { buildClean } from 'obsidian-dev-utils/ScriptUtils/Commands';
```

Cleans `dist` folder.

### Compile code

```typescript
import { buildCompile } from 'obsidian-dev-utils/ScriptUtils/Commands';
```

Checks if code compiles.

### Compile Svelte code

```typescript
import { buildCompileSvelte } from 'obsidian-dev-utils/ScriptUtils/Commands';
```

Checks if Svelte code compiles.

### Compile TypeScript code

```typescript
import { buildCompileTypeScript } from 'obsidian-dev-utils/ScriptUtils/Commands';
```

Checks if TypeScript code compiles.

### Build static assets

```typescript
import { buildStatic } from 'obsidian-dev-utils/ScriptUtils/Commands';
```

Copies `static` folder to `dist` folder.

### Build Development Version

```typescript
import { dev } from 'obsidian-dev-utils/ScriptUtils/Commands';
```

Compiles the development version of your plugin into the `dist/dev` folder. The `OBSIDIAN_CONFIG_FOLDER` can be set either as an environment variable or specified in a `.env` file (e.g., `path/to/my/vault/.obsidian`). The command automatically copies the compiled plugin to the specified Obsidian configuration folder and triggers the [Hot Reload] plugin, if it is enabled. If the [Hot Reload] plugin is not installed, it will be installed automatically, and you will need to enable it manually.

### Format Code

```typescript
import { format } from 'obsidian-dev-utils/ScriptUtils/Commands';
```

Formats your code using [dprint](https://dprint.dev/).

### Check Code Formatting

```typescript
import { formatCheck } from 'obsidian-dev-utils/ScriptUtils/Commands';
```

Checks formatting of your code using [dprint](https://dprint.dev/).

### Lint Code

```typescript
import { lint } from 'obsidian-dev-utils/ScriptUtils/Commands';
```

Lints your code, enforcing a code convention to minimize common errors.

This command is looking for `ESLint` config file in the root of your project and if it's not found, it creates it referencing the default configuration.

### Lint and Fix Code

```typescript
import { lintFix } from 'obsidian-dev-utils/ScriptUtils/Commands';
```

Lints your code and automatically applies fixes where possible.

This command is looking for `ESLint` config file in the root of your project and if it's not found, it creates it referencing the default configuration.

### Lint Markdown

```typescript
import { lintMarkdown } from 'obsidian-dev-utils/ScriptUtils/Commands';
```

Lints your markdown documentation.

This command is looking for existing `markdownlint-cli2` config file in the root of your project and if it's not found, it creates it referencing the default configuration.

### Lint and Fix Markdown

```typescript
import { lintMarkdownFix } from 'obsidian-dev-utils/ScriptUtils/Commands';
```

Lints your markdown documentation and automatically applies fixes where possible.

This command is looking for existing `markdownlint-cli2` config file in the root of your project and if it's not found, it creates it referencing the default configuration.

### Publish

```typescript
import { publish } from 'obsidian-dev-utils/ScriptUtils/Commands';
```

Publishes the package to NPM. Usually not applicable for plugins.

To bypass manual verification, consider setting `NPM_TOKEN` to the environment variable or in your `.env` file.

### Spellcheck Code

```typescript
import { spellcheck } from 'obsidian-dev-utils/ScriptUtils/Commands';
```

Checks your code for spelling errors.

### Test

```typescript
import { test } from 'obsidian-dev-utils/ScriptUtils/Commands';
```

Runs the test suite using Vitest.

### Test with Coverage

```typescript
import { testCoverage } from 'obsidian-dev-utils/ScriptUtils/Commands';
```

Runs the test suite with v8 coverage reporting.

### Test Watch Mode

```typescript
import { testWatch } from 'obsidian-dev-utils/ScriptUtils/Commands';
```

Runs the test suite in watch mode.

### Version Management

```typescript
import { updateVersion } from 'obsidian-dev-utils/ScriptUtils/Commands';
```

Runs build checks before updating the version and releases if all checks pass.

If you use `beta` as version update type for your Obsidian plugin, the plugin will be deployed compatible to install with [BRAT](https://obsidian.md/plugins?id=obsidian42-brat).

Additionally, the script fetches the latest stable Obsidian version, which is used to update the `minAppVersion` in `manifest.json` and to add a new entry to `versions.json`.

For the script to be able to publish releases in your repository, you need to ensure your `GitHub` token has `Read and write permissions` in `Settings > Actions > General`.

## Simplified Usage

To use these commands in your `package.json`, create script entry points using [jiti](https://github.com/unjs/jiti):

```json
{
  "scripts": {
    "build": "jiti scripts/build.ts",
    "build:clean": "jiti scripts/build-clean.ts",
    "build:compile:typescript": "jiti scripts/build-compile-typescript.ts",
    "build:static": "jiti scripts/build-static.ts",
    "dev": "jiti scripts/dev.ts",
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
import { build } from 'obsidian-dev-utils/ScriptUtils/Commands';

await build();
```

This setup allows you to run the commands using `npm run`, like `npm run build`.

[Hot Reload]: https://github.com/pjeby/hot-reload
