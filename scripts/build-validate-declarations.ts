import {
  CliTaskResult,
  wrapCliTask
} from '@mnaoumov/typescript-dev-toolkit/cli-utils';
import { validateDeclarations } from '@mnaoumov/typescript-dev-toolkit/validate-declarations';
import process from 'node:process';
import { parseArgs } from 'node:util';

const [, , ...$arguments] = process.argv;

const { values } = parseArgs({
  // eslint-disable-next-line unicorn/name-replacements -- `args` is the option name Node's `parseArgs` reads.
  args: $arguments,
  options: {
    verbose: { type: 'boolean' }
  }
});

const isVerbose = values.verbose ?? false;

await wrapCliTask(() => CliTaskResult.Success(validateDeclarations({ isVerbose })));
