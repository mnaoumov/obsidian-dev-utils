# CLI Commands

`Obsidian Dev Utils` offers several CLI commands to facilitate common development tasks:

## Build Production Version

```bash
npx obsidian-dev-utils build
```

Compiles the production version of your plugin into the `dist/build` folder.

## Clean build folder

```bash
npx obsidian-dev-utils build:clean
```

Cleans `dist` folder.

## Compile code

```bash
npx obsidian-dev-utils build:compile
```

Checks if code compiles.

## Compile Svelte code

```bash
npx obsidian-dev-utils build:compile:svelte
```

Checks if Svelte code compiles.

## Compile TypeScript code

```bash
npx obsidian-dev-utils build:compile:typescript
```

Checks if TypeScript code compiles.

## Build static assets

```bash
npx obsidian-dev-utils build:static
```

Copies `static` folder to `dist` folder.

## Build Development Version

```bash
npx obsidian-dev-utils dev
```

Compiles the development version of your plugin into the `dist/dev` folder. The `OBSIDIAN_CONFIG_FOLDER` can be set either as an environment variable or specified in a `.env` file (e.g., `path/to/my/vault/.obsidian`). The command automatically copies the compiled plugin to the specified Obsidian configuration folder and triggers the [Hot Reload] plugin, if it is enabled. If the [Hot Reload] plugin is not installed, it will be installed automatically, and you will need to enable it manually.

## Format Code

```bash
npx obsidian-dev-utils format
```

Formats your code using [dprint](https://dprint.dev/).

## Check Code Formatting

```bash
npx obsidian-dev-utils format:check
```

Checks formatting of your code using [dprint](https://dprint.dev/).

## Lint Code

```bash
npx obsidian-dev-utils lint
```

Lints your code, enforcing a code convention to minimize common errors.

This command is looking for `ESLint` config file in the root of your project and if it's not found, it creates it referencing the default configuration.

## Lint and Fix Code

```bash
npx obsidian-dev-utils lint:fix
```

Lints your code and automatically applies fixes where possible.

This command is looking for `ESLint` config file in the root of your project and if it's not found, it creates it referencing the default configuration.

## Lint Markdown

```bash
npx obsidian-dev-utils lint:md
```

Lints your markdown documentation.

This command is looking for existing `markdownlint-cli2` config file in the root of your project and if it's not found, it creates it referencing the default configuration.

## Lint and Fix Markdown

```bash
npx obsidian-dev-utils lint:md:fix
```

Lints your markdown documentation and automatically applies fixes where possible.

This command is looking for existing `markdownlint-cli2` config file in the root of your project and if it's not found, it creates it referencing the default configuration.

## Publish

```bash
npx obsidian-dev-utils publish
```

Publishes the package to NPM. Usually not applicable for plugins.

To bypass manual verification, consider setting `NPM_TOKEN` to the environment variable or in your `.env` file.

## Spellcheck Code

```bash
npx obsidian-dev-utils spellcheck
```

Checks your code for spelling errors.

## Version Management

```bash
npx obsidian-dev-utils version <versionUpdateType>
```

Runs build checks before updating the version and releases if all checks pass. The `<versionUpdateType>` can be `major`, `minor`, `patch`, `beta`, or a specific version like `x.y.z[-suffix]`.

If you use `beta` as `<versionUpdateType>` for your Obsidian plugin, the plugin will be deployed compatible to install with [BRAT](https://obsidian.md/plugins?id=obsidian42-brat).

Additionally, the script fetches the latest stable Obsidian version, which is used to update the `minAppVersion` in `manifest.json` and to add a new entry to `versions.json`.

For the script to be able to publish releases in your repository, you need to ensure your `GitHub` token has `Read and write permissions` in `Settings > Actions > General`.

## Simplified Usage

To simplify the usage of these commands, you can add them to your `package.json`:

```json
{
  "scripts": {
    "build": "obsidian-dev-utils build",
    "build:compile": "obsidian-dev-utils build:compile",
    "build:compile:svelte": "obsidian-dev-utils build:compile:svelte",
    "build:compile:typescript": "obsidian-dev-utils build:compile:typescript",
    "build:clean": "obsidian-dev-utils build:clean",
    "build:static": "obsidian-dev-utils build:static",
    "dev": "obsidian-dev-utils dev",
    "format": "obsidian-dev-utils format",
    "format:check": "obsidian-dev-utils format:check",
    "lint": "obsidian-dev-utils lint",
    "lint:fix": "obsidian-dev-utils lint:fix",
    "publish": "obsidian-dev-utils publish",
    "spellcheck": "obsidian-dev-utils spellcheck",
    "version": "obsidian-dev-utils version"
  },
  "...": "..."
}
```

This setup allows you to run the commands using `npm run`, like `npm run build`.

## Customizing CLI commands

If you want to alter the way provided CLI commands work, you have two ways

### Make your own scripts and replace the CLI command in `package.json`

```json
{
  "scripts": {
    "build": "node my-build.mjs",
    "build:compile:typescript": "tsx my-build-compile-typescript.ts"
  },
  "...": "..."
}
```

### Add hook scripts into `scripts` folder (recommended)

Hook scripts follow naming conventions:

1. They are put in `scripts` folder.
2. They are named as the CLI command.
3. If CLI command name contains `:`, it is replaced with `-`.

E.g., `scripts/build.ts`, `scripts/build-compile-typescript.ts`.

[See the example of such hook scripts](https://github.com/mnaoumov/obsidian-dev-utils/tree/main/static/scripts). You can copy them into your `scripts` folder and modify according to your needs.

[Hot Reload]: https://github.com/pjeby/hot-reload
