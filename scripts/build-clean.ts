import {
  basename,
  join
} from '../src/Path.ts';
import { buildClean } from '../src/scripts/build.ts';
import { wrapCliTask } from '../src/scripts/CliUtils.ts';
import { readdirPosix } from '../src/scripts/Fs.ts';
import { rm } from '../src/scripts/NodeModules.ts';
import { ObsidianDevUtilsRepoPaths } from '../src/scripts/ObsidianDevUtilsRepoPaths.ts';

await wrapCliTask(async () => {
  await buildClean();
  for (const file of await readdirPosix(ObsidianDevUtilsRepoPaths.Src, { recursive: true })) {
    if (basename(file) !== ObsidianDevUtilsRepoPaths.IndexTs as string) {
      continue;
    }

    await rm(join(ObsidianDevUtilsRepoPaths.Src, file));
  }

  await rm(ObsidianDevUtilsRepoPaths.SrcDependenciesTs, { force: true });
});
