/**
 * @file
 *
 * Builds ONE Obsidian workspace package's `dist/lib` with the Obsidian preprocess plugin, whose CommonJS banner
 * patches `require` for Obsidian's built-in modules.
 */

import { preprocessPlugin } from '@mnaoumov/obsidian-dev-toolkit/bundlers/esbuild-impl/preprocess-plugin';
import { wrapCliTask } from '@mnaoumov/typescript-dev-toolkit/cli-utils';
import { buildLibrary } from '@mnaoumov/typescript-dev-toolkit/library-build';

await wrapCliTask(async () => {
  await buildLibrary({ preprocessPluginFactory: preprocessPlugin });
});
