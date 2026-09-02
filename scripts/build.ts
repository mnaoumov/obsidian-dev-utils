import {
  CliTaskResult,
  wrapCliTask
} from '../src/script-utils/cli-utils.ts';
import { execFromRoot } from '../src/script-utils/root.ts';

const BUILD_STEPS = [
  'build:clean',
  'build:generate-merged',
  'build:generate-index',
  // The orchestrator, not the `build:compile:typescript` leaf it fans out to.
  // Naming a leaf here is exactly the mis-wire T804 swept out of the fleet and T816 out of this repo:
  // It silently skips the sibling svelte pass. Both leaf scripts survive as the targets it npm-runs.
  'build:compile',
  'build:types',
  'build:validate-declarations',
  'build:lib',
  'build:generate-exports',
  'build:templates',
  // Type-checks `templates/` against the `dist/lib/esm` declarations, so it must sit after they are built.
  // A rename a template still spells the old way then fails the build instead of shipping (T754).
  'build:validate-templates',
  'build:styles',
  // Must sit after the stylesheet it reads and before the two bundling steps below.
  // Those steps would otherwise inline the placeholders instead of the stamped values.
  'build:stamp-generated',
  'build:demo-vault-helper',
  'build:integration-test-plugin'
];

await wrapCliTask(async () => {
  for (const step of BUILD_STEPS) {
    await wrapCliTask(async () => {
      await execFromRoot(['npm', 'run', step]);
      return CliTaskResult.DoNotExit();
    });
  }
});
