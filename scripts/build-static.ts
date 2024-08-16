import { cp } from "node:fs/promises";
import { join } from "../src/Path.ts";
import { readdirPosix } from "../src/Fs.ts";
import { trimStart } from "../src/String.ts";
import { wrapCliTask } from "../src/bin/cli.ts";
import { ObsidianDevUtilsRepoPaths } from "../src/bin/esbuild/ObsidianDevUtilsPaths.ts";

await wrapCliTask(async () => {
  for (const dirent of await readdirPosix(ObsidianDevUtilsRepoPaths.Static, { withFileTypes: true, recursive: true })) {
    if (!dirent.isFile()) {
      continue;
    }

    const path = trimStart(join(dirent.parentPath, dirent.name), ObsidianDevUtilsRepoPaths.Static + "/");
    await cp(join(ObsidianDevUtilsRepoPaths.Static, path), join(ObsidianDevUtilsRepoPaths.Dist, path));
  }
});
