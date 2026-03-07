/**
 * @packageDocumentation
 *
 * Build clean script.
 */

import {
  basename,
  join
} from '../src/path.ts';
import { buildClean } from '../src/script-utils/build.ts';
import { wrapCliTask } from '../src/script-utils/cli-utils.ts';
import { readdirPosix } from '../src/script-utils/fs.ts';
import { rm } from '../src/script-utils/node-modules.ts';
import { ObsidianDevUtilsRepoPaths } from '../src/script-utils/obsidian-dev-utils-repo-paths.ts';

await wrapCliTask(async () => {
  await buildClean();
  for (const file of await readdirPosix(ObsidianDevUtilsRepoPaths.Src, { recursive: true })) {
    if (basename(file) === ObsidianDevUtilsRepoPaths.IndexTs as string) {
      await rm(join(ObsidianDevUtilsRepoPaths.Src, file));
    }

    if (file.endsWith(ObsidianDevUtilsRepoPaths.DtsExtension) && !file.split('/').includes(ObsidianDevUtilsRepoPaths.Types)) {
      await rm(join(ObsidianDevUtilsRepoPaths.Src, file));
    }
  }

  for (const file of await readdirPosix(ObsidianDevUtilsRepoPaths.CurrentFolder, { recursive: true })) {
    if (basename(file) !== ObsidianDevUtilsRepoPaths.PackageJson as string) {
      continue;
    }

    if (file === ObsidianDevUtilsRepoPaths.PackageJson as string) {
      continue;
    }

    if (file.startsWith(ObsidianDevUtilsRepoPaths.NodeModules)) {
      continue;
    }

    await rm(file);
  }
});
