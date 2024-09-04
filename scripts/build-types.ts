import { cp } from "node:fs/promises";
import { wrapCliTask } from "../src/scripts/CliUtils.ts";
import { execFromRoot } from "../src/scripts/Root.ts";
import { readdirPosix } from "../src/Fs.ts";
import { ObsidianDevUtilsRepoPaths } from "../src/scripts/ObsidianDevUtilsRepoPaths.ts";
import { join } from "../src/Path.ts";

await wrapCliTask(async () => {
  await execFromRoot("tsc --project ./tsconfig.types.json");
  for (const file of await readdirPosix("src", { recursive: true })) {
    if (file.endsWith(".d.ts")) {
      await cp(join(ObsidianDevUtilsRepoPaths.Src, file), join(ObsidianDevUtilsRepoPaths.DistLib, file));
    }
  }
});
