# Helper Functions

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
