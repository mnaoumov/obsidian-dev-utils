import {
  rm
} from "node:fs/promises";
import {
  basename,
  join
} from "../src/Path.ts";
import { readdirPosix } from "../src/Fs.ts";
import { wrapCliTask } from "../src/bin/cli.ts";
import { ObsidianDevUtilsRepoPaths } from "../src/bin/esbuild/ObsidianDevUtilsPaths.ts";

await wrapCliTask(async () => {
  await rm(ObsidianDevUtilsRepoPaths.Dist, { recursive: true, force: true });

  for (const file of await readdirPosix(ObsidianDevUtilsRepoPaths.Src, { recursive: true })) {
    if (basename(file) !== ObsidianDevUtilsRepoPaths.IndexTs as string) {
      continue;
    }

    await rm(join(ObsidianDevUtilsRepoPaths.Src, file));
  }

  await rm(ObsidianDevUtilsRepoPaths.SrcDependenciesTs, { force: true });
});
