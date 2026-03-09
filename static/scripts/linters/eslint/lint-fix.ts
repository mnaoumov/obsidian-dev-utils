import { wrapCliTask } from 'obsidian-dev-utils/script-utils/cli-utils';
import { lint } from 'obsidian-dev-utils/script-utils/linters/eslint';

await wrapCliTask(() => lint(true));
