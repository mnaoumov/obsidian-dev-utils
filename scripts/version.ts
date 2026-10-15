/**
 * @file
 *
 * The release entry point of this repository, retired: `npm run version` refuses to run.
 *
 * The five packages restarted at `1.0.0` and each one is released from its own repository. This workspace
 * publishes `1.0.0` exactly once, by dispatching `.github/workflows/publish-npm.yml`, because each package's tooling
 * depends on siblings that are not on npm yet. A joint release from here would set every package back onto the
 * workspace root's `107.x` line, so it is refused rather than left to run.
 */

import { wrapCliTask } from '@mnaoumov/typescript-dev-toolkit/cli-utils';

await wrapCliTask(() => {
  throw new Error(
    'The joint workspace release is retired. Release each @mnaoumov package from its own repository; the one-off 1.0.0 publish runs by dispatching publish-npm.yml.'
  );
});
