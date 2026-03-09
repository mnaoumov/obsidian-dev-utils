import { buildStatic } from 'obsidian-dev-utils/script-utils/build';
import { wrapCliTask } from 'obsidian-dev-utils/script-utils/cli-utils';

await wrapCliTask(() => buildStatic());
