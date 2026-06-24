import { buildTemplates } from 'obsidian-dev-utils/script-utils/build';
import { wrapCliTask } from 'obsidian-dev-utils/script-utils/cli-utils';

await wrapCliTask(() => buildTemplates());
