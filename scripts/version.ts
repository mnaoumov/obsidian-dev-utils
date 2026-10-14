/**
 * @file
 *
 * The release entry point of this repository. It refuses for now: the workspace packages are released TOGETHER,
 * one version for all five, and that release (and the NPM publish behind it) is not wired up yet. The single-
 * package release this script used to run would bump only the private workspace root.
 */

import { wrapCliTask } from '@mnaoumov/typescript-dev-toolkit/cli-utils';

await wrapCliTask(() => {
  throw new Error('Releasing the workspace packages is not wired up yet: they are released together, which is a change of its own.');
});
