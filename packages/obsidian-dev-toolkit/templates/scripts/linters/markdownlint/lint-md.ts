import process from 'node:process';

import { lint } from '@mnaoumov/obsidian-dev-toolkit/linters/markdownlint';
import { wrapCliTask } from '@mnaoumov/typescript-dev-toolkit/cli-utils';

const [, , ...paths] = process.argv;

await wrapCliTask(() => lint({ paths }));
