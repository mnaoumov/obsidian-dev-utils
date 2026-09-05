import process from 'node:process';

import { wrapCliTask } from '../src/script-utils/cli-utils.ts';
import {
  gate,
  parseGateArguments
} from '../src/script-utils/gate.ts';

const [, , ...$arguments] = process.argv;

await wrapCliTask(async () => {
  const options = parseGateArguments($arguments);
  await gate(options);
});
