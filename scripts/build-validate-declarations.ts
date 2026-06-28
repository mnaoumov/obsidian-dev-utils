import process from 'node:process';
import { parseArgs } from 'node:util';

import {
  CliTaskResult,
  wrapCliTask
} from '../src/script-utils/cli-utils.ts';
import { validateDeclarations } from '../src/script-utils/validate-declarations.ts';

const [, , ...args] = process.argv;

const { values } = parseArgs({
  args,
  options: {
    verbose: { type: 'boolean' }
  }
});

const isVerbose = values.verbose ?? false;

await wrapCliTask(() => CliTaskResult.Success(validateDeclarations({ isVerbose })));
