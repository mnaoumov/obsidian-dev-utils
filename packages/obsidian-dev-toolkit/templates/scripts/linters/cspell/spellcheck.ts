import process from 'node:process';

import { wrapCliTask } from '@mnaoumov/typescript-dev-toolkit/cli-utils';
import { spellcheck } from '@mnaoumov/typescript-dev-toolkit/linters/cspell';

const [, , ...paths] = process.argv;

await wrapCliTask(() => spellcheck({ paths }));
