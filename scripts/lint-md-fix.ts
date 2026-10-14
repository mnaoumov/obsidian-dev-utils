import { wrapCliTask } from '@mnaoumov/typescript-dev-toolkit/cli-utils';
import { lint } from '@mnaoumov/typescript-dev-toolkit/linters/markdownlint';
import process from 'node:process';

const [, , ...paths] = process.argv;

await wrapCliTask(async () => {
  await lint({ paths, shouldFix: true });
});
