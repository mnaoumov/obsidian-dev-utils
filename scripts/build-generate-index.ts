import {
  basename,
  extname,
  join,
  normalizeIfRelative
} from "../src/Path.ts";
import { readdirPosix } from "../src/scripts/Fs.ts";
import { makeValidVariableName } from "../src/String.ts";
import { wrapCliTask } from "../src/scripts/CliUtils.ts";
import { asyncMap } from "../src/Async.ts";
import { generate } from "../src/scripts/CodeGenerator.ts";
import { ObsidianDevUtilsRepoPaths } from "../src/scripts/ObsidianDevUtilsRepoPaths.ts";

await wrapCliTask(async () => {
  await generateIndex(ObsidianDevUtilsRepoPaths.Src);
});

async function generateIndex(dir: string): Promise<void> {
  const dirents = await readdirPosix(dir, { withFileTypes: true });
  const lines = (await asyncMap(dirents, async (dirent) => {
    if (dirent.name === ObsidianDevUtilsRepoPaths.IndexTs as string || dirent.name === ObsidianDevUtilsRepoPaths.Types as string || dirent.name.endsWith(ObsidianDevUtilsRepoPaths.DtsExtension)) {
      return;
    }
    let sourceFile: string;
    let name: string;
    if (dirent.isDirectory()) {
      await generateIndex(join(dir, dirent.name));
      sourceFile = normalizeIfRelative(join(dirent.name, ObsidianDevUtilsRepoPaths.IndexTs));
      name = dirent.name;
    } else {
      const extension = extname(dirent.name);
      name = basename(dirent.name, extension);
      sourceFile = normalizeIfRelative(dirent.name);
    }

    return `export * as ${makeValidVariableName(name)} from "${sourceFile}";`;
  })).filter((line) => line !== undefined);

  await generate(join(dir, ObsidianDevUtilsRepoPaths.IndexTs), lines);
}
