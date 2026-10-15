/**
 * @file
 *
 * Builds ONE workspace package: run from the package's own folder (its `build` script points here), it runs every
 * step of the pipeline below that the package defines a script for, in order.
 */

import { wrapCliTask } from '@mnaoumov/typescript-dev-toolkit/cli-utils';
import { runBuildSteps } from '@mnaoumov/typescript-dev-toolkit/library-build';

const BUILD_STEPS = [
  'build:clean',
  'build:generate-merged',
  'build:generate-index',
  // The orchestrator, not the `build:compile:typescript` leaf it fans out to.
  // Naming a leaf here is exactly the mis-wire swept out of this repo and its sibling plugin repos:
  // It silently skips the sibling svelte pass. Both leaf scripts survive as the targets it npm-runs.
  'build:compile',
  'build:types',
  'build:validate-declarations',
  'build:lib',
  'build:generate-exports',
  'build:templates',
  // Type-checks `templates/` against the `dist/lib/esm` declarations, so it must sit after they are built.
  // A rename a template still spells the old way then fails the build instead of shipping.
  'build:validate-templates',
  'build:styles',
  // Must sit after the stylesheet it reads and before the two bundling steps below.
  // Those steps would otherwise inline the placeholders instead of the stamped values.
  'build:stamp-generated',
  'build:demo-vault-helper',
  'build:integration-test-plugin'
];

await wrapCliTask(async () => {
  await runBuildSteps(BUILD_STEPS);
});
