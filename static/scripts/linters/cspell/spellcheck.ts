import { wrapCliTask } from 'obsidian-dev-utils/script-utils/cli-utils';
import { spellcheck } from 'obsidian-dev-utils/script-utils/linters/cspell';

await wrapCliTask(() => spellcheck());
