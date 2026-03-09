import { wrapCliTask } from 'obsidian-dev-utils/script-utils/cli-utils';
import { format } from 'obsidian-dev-utils/script-utils/formatters/dprint';

await wrapCliTask(() => format(false));
