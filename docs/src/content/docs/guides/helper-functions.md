---
title: Helper Functions
---

`Obsidian Dev Utils` provides a range of general-purpose and Obsidian-specific helper functions.

The functions are grouped by files and folders and you have multiple ways to import them:

```typescript
import { prompt } from 'obsidian-dev-utils/obsidian/modal/prompt';
await prompt({
  app,
  title: 'Enter your name'
});

import { prompt } from 'obsidian-dev-utils/obsidian/modal';
await prompt.prompt({
  app,
  title: 'Enter your name'
});

import { modal } from 'obsidian-dev-utils/obsidian';
await modal.prompt.prompt({
  app,
  title: 'Enter your name'
});

import { obsidian } from 'obsidian-dev-utils';
await obsidian.modal.prompt.prompt({
  app,
  title: 'Enter your name'
});

import * as obsidianDevUtils from 'obsidian-dev-utils';
await obsidianDevUtils.obsidian.modal.prompt.prompt({
  app,
  title: 'Enter your name'
});
```

For files/folders that use `kebab-case` names, namespace-style imports require bracket notation because kebab-case names are not valid JavaScript identifiers:

```typescript
import * as obsidian from 'obsidian-dev-utils/obsidian';
await obsidian['file-manager'].addAlias(app, file, 'new-alias');

import { obsidian } from 'obsidian-dev-utils';
await obsidian['file-manager'].addAlias(app, file, 'new-alias');

import * as obsidianDevUtils from 'obsidian-dev-utils';
await obsidianDevUtils.obsidian['file-manager'].addAlias(app, file, 'new-alias');
```

## Flat imports via `__merged`

If you would rather not remember which file a helper lives in, `__merged` gives you every value export
of the library flattened into a single namespace — no deep paths, no nesting. It is a generated barrel of
every renderer-safe value export, deduplicated so each name is unique.

Import the names directly from the `obsidian-dev-utils/__merged` subpath:

```typescript
import {
  invokeAsyncSafely,
  prompt,
  unique
} from 'obsidian-dev-utils/__merged';

const ids = unique([1, 1, 2]);

await prompt({
  app,
  title: 'Enter your name'
});
```

Or pull the whole flat barrel as a single namespace from the main entry:

```typescript
import { __merged } from 'obsidian-dev-utils';

const ids = __merged.unique([1, 1, 2]);

await __merged.prompt({
  app,
  title: 'Enter your name'
});
```

`__merged` only contains **value** exports (functions, classes, constants) that are safe to load in the
Obsidian renderer — it deliberately omits type-only exports and any modules that touch Node-only APIs. It
is the same flat surface that backs the `lib` bag inside `evalInObsidian` integration-test closures.

