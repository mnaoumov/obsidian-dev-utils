import { wrapCliTask } from '@mnaoumov/typescript-dev-toolkit/cli-utils';
import {
  gate,
  parseGateArguments
} from '@mnaoumov/typescript-dev-toolkit/gate';
import process from 'node:process';

const [, , ...$arguments] = process.argv;

await wrapCliTask(async () => {
  const options = parseGateArguments($arguments);
  await gate(options);
});
