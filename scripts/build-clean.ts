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
    if (basename(file) === ObsidianDevUtilsRepoPaths.IndexTs as string) {
      await rm(join(ObsidianDevUtilsRepoPaths.Src, file));
    }

    if (file.endsWith(ObsidianDevUtilsRepoPaths.DtsExtension) && !file.split('/').includes(ObsidianDevUtilsRepoPaths.Types)) {
      await rm(join(ObsidianDevUtilsRepoPaths.Src, file));
    }
  }

  await rm(ObsidianDevUtilsRepoPaths.SrcDependenciesTs, { force: true });

  for (const file of await readdirPosix('.', { recursive: true })) {
    if (
      basename(file) === ObsidianDevUtilsRepoPaths.PackageJson as string && file !== ObsidianDevUtilsRepoPaths.PackageJson
      && !file.startsWith(ObsidianDevUtilsRepoPaths.NodeModules)
    ) {
      await rm(file);
    }
  }
});
