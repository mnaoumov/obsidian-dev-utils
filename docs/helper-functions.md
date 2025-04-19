# Helper Functions

`Obsidian Dev Utils` provides a range of general-purpose and Obsidian-specific helper functions.

The functions are grouped by files and folders and you have multiple ways to import them:

```typescript
import { prompt } from 'obsidian-dev-utils/obsidian/Modal/Prompt';
await prompt({
  app,
  title: 'Enter your name'
});

import { Prompt } from 'obsidian-dev-utils/obsidian/Modal';
await Prompt.prompt({
  app,
  title: 'Enter your name'
});

import { Modal } from 'obsidian-dev-utils/obsidian';
await Modal.Prompt.prompt({
  app,
  title: 'Enter your name'
});

import { obsidian } from 'obsidian-dev-utils';
await obsidian.Modal.Prompt.prompt({
  app,
  title: 'Enter your name'
});

import * as obsidianDevUtils from 'obsidian-dev-utils';
await obsidianDevUtils.obsidian.Modal.Prompt.prompt({
  app,
  title: 'Enter your name'
});
```
