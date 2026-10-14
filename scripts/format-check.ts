import { wrapCliTask } from '@mnaoumov/typescript-dev-toolkit/cli-utils';
import { format } from '@mnaoumov/typescript-dev-toolkit/formatters/dprint';
import process from 'node:process';

const [, , ...paths] = process.argv;

await wrapCliTask(async () => {
  await format({ paths, rewrite: false });
});
