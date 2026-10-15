/**
 * @file
 *
 * Builds ONE generic workspace package's `dist/lib` with the generic preprocess plugin, so its CommonJS output runs
 * under plain Node. The Obsidian packages use `build-lib-obsidian.ts` instead.
 */

import { wrapCliTask } from '@mnaoumov/typescript-dev-toolkit/cli-utils';
import { buildLibrary } from '@mnaoumov/typescript-dev-toolkit/library-build';

await wrapCliTask(async () => {
  await buildLibrary();
});
