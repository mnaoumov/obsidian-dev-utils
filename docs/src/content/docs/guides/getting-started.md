---
title: Getting started
sidebar:
    order: 0
---

`Obsidian Dev Utils` is a collection of essential functions, helpers, and build tooling that streamline
Obsidian plugin development. This guide gets you from an empty project to your first call.

## Installation

Install the package from npm:

```bash
npm install obsidian-dev-utils
```

If you are starting a brand-new plugin, the
[Obsidian Plugin Yeoman Generator](https://github.com/mnaoumov/generator-obsidian-plugin) scaffolds a
project that already wires up this library and its scripts for you.

## Your first helper call

Everything the library exposes for use inside a running plugin is a normal import. For example, show a
prompt modal without writing any modal boilerplate:

```typescript
import { prompt } from 'obsidian-dev-utils/obsidian/modal/prompt';

const name = await prompt({
  app,
  title: 'Enter your name'
});
```

Helpers are grouped by file and folder, and each group is reachable through several import styles (deep
path, namespace, or a single flat barrel). See [Helper Functions](./helper-functions/) for the full set
of import styles, including the flat [`__merged`](./helper-functions/#flat-imports-via-__merged) barrel.

## Your first build script

The library also ships the build, lint, format, spellcheck, and test tooling most plugins need, exposed
as functions you wrap in your own `scripts/`:

```typescript
// scripts/build.ts
import { wrapCliTask } from 'obsidian-dev-utils/script-utils/cli-utils';
import { build } from 'obsidian-dev-utils/script-utils/bundlers/esbuild';

await wrapCliTask(() => build());
```

Then wire it into `package.json`:

```json
{
  "scripts": {
    "build": "jiti scripts/build.ts"
  }
}
```

See [Commands](./cli-commands/) for the complete list of build and tooling entry points.

## Where to go next

- [Helper Functions](./helper-functions/) — general-purpose and Obsidian-specific helpers, and the ways to import them.
- [Setting Components](./setting-components/) — ready-made settings-tab controls.
- [Modals](./modals/) — alert, confirm, prompt, and select modals with an async API.
- [Plugin Helpers](./plugin-helpers/) — building blocks to simplify your own plugin class.
- [Commands](./cli-commands/) — the build, lint, format, and test tooling.
- [API reference](../api/) — the complete, searchable API generated from the library's TSDoc.
