import process from 'node:process';

import { format } from '@mnaoumov/obsidian-dev-toolkit/formatters/dprint';
import { wrapCliTask } from '@mnaoumov/typescript-dev-toolkit/cli-utils';

const [, , ...paths] = process.argv;

await wrapCliTask(() => format({ paths }));
