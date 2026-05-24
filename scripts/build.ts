import {
  CliTaskResult,
  wrapCliTask
} from '../src/script-utils/cli-utils.ts';
import { execFromRoot } from '../src/script-utils/root.ts';

const BUILD_STEPS = [
  'build:clean',
  'build:generate-index',
  'build:compile:typescript',
  'build:types',
  'build:validate-declarations',
  'build:lib',
  'build:generate-exports',
  'build:static',
  'build:styles'
];

await wrapCliTask(async () => {
  for (const step of BUILD_STEPS) {
    await wrapCliTask(async () => {
      await execFromRoot(['npm', 'run', step]);
      return CliTaskResult.DoNotExit();
    });
  }
});
