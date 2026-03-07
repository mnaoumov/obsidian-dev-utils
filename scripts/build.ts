/**
 * @packageDocumentation
 *
 * Build script.
 */

import { wrapCliTask } from '../src/script-utils/cli-utils.ts';
import { execFromRoot } from '../src/script-utils/root.ts';

const BUILD_STEPS = [
  'build:clean',
  'build:compile:typescript',
  'build:generate-index',
  'build:types',
  'build:lib',
  'build:generate-exports',
  'build:static',
  'build:styles'
];

await wrapCliTask(async () => {
  for (const step of BUILD_STEPS) {
    await execFromRoot(['npm', 'run', step]);
  }
});
