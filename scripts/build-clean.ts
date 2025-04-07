/**
 * @packageDocumentation
 *
 * Build clean script.
 */

import {
  basename,
  join
} from '../src/Path.ts';
import { buildClean } from '../src/ScriptUtils/build.ts';
import { wrapCliTask } from '../src/ScriptUtils/CliUtils.ts';
import { readdirPosix } from '../src/ScriptUtils/Fs.ts';
import { rm } from '../src/ScriptUtils/NodeModules.ts';
import { ObsidianDevUtilsRepoPaths } from '../src/ScriptUtils/ObsidianDevUtilsRepoPaths.ts';

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
