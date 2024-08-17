import {
  join,
  normalizeIfRelative
} from "../src/Path.ts";
import { readdirPosix } from "../src/Fs.ts";
import { editNpmPackage } from "../src/Npm.ts";
import { ObsidianDevUtilsRepoPaths } from "../src/bin/esbuild/ObsidianDevUtilsRepoPaths.ts";
import { wrapCliTask } from "../src/bin/cli.ts";

await wrapCliTask(async () => {
  const libDirs: string[] = [ObsidianDevUtilsRepoPaths.DistLib];

  for (const dirent of await readdirPosix(ObsidianDevUtilsRepoPaths.DistLib, { withFileTypes: true, recursive: true })) {
    if (!dirent.isDirectory()) {
      continue;
    }

    const path = join(dirent.parentPath, dirent.name);
    libDirs.push(path);
  }

  libDirs.sort();

  await editNpmPackage((npmPackage) => {
    npmPackage.exports = {};
    for (const libDir of libDirs) {
      const importPath = libDir.replace(ObsidianDevUtilsRepoPaths.DistLib, ".");
      npmPackage.exports[importPath] = {
        default: normalizeIfRelative(join(libDir, ObsidianDevUtilsRepoPaths.IndexCjs)),
        types: normalizeIfRelative(join(libDir, ObsidianDevUtilsRepoPaths.IndexDts))
      };
      npmPackage.exports[normalizeIfRelative(join(importPath, ObsidianDevUtilsRepoPaths.Any))] = {
        default: normalizeIfRelative(join(libDir, ObsidianDevUtilsRepoPaths.AnyCjs)),
        types: normalizeIfRelative(join(libDir, ObsidianDevUtilsRepoPaths.AnyDts)),
      };
    }
  });
});
