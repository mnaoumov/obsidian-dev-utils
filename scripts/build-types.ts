import { join } from '../src/Path.ts';
import { wrapCliTask } from '../src/scripts/CliUtils.ts';
import { readdirPosix } from '../src/scripts/Fs.ts';
import { cp } from '../src/scripts/NodeModules.ts';
import { ObsidianDevUtilsRepoPaths } from '../src/scripts/ObsidianDevUtilsRepoPaths.ts';
import { execFromRoot } from '../src/scripts/Root.ts';

await wrapCliTask(async () => {
  await execFromRoot('tsc --project ./tsconfig.types.json');
  for (const file of await readdirPosix(ObsidianDevUtilsRepoPaths.Src, { recursive: true })) {
    if (!file.endsWith(ObsidianDevUtilsRepoPaths.DtsExtension)) {
      continue;
    }

    const fullSourcePath = join(ObsidianDevUtilsRepoPaths.Src, file);
    const fullTargetBasePath = join(ObsidianDevUtilsRepoPaths.DistLib, file);

    await cp(fullSourcePath, fullTargetBasePath + ObsidianDevUtilsRepoPaths.DctsExtension);
    await cp(fullSourcePath, fullTargetBasePath + ObsidianDevUtilsRepoPaths.DmtsExtension);
  }
});
