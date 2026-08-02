import process from 'node:process';
import { parseArgs } from 'node:util';

import {
  CliTaskResult,
  wrapCliTask
} from '../src/script-utils/cli-utils.ts';
import { validateDeclarations } from '../src/script-utils/validate-declarations.ts';

const [, , ...$arguments] = process.argv;

const { values } = parseArgs({
  args: $arguments,
  options: {
    verbose: { type: 'boolean' }
  }
});

const isVerbose = values.verbose ?? false;

await wrapCliTask(() => CliTaskResult.Success(validateDeclarations({ isVerbose })));
