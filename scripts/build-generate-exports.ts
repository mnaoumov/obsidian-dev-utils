import {
  join,
  normalizeIfRelative
} from '../src/Path.ts';
import { readdirPosix } from '../src/scripts/Fs.ts';
import { editNpmPackage } from '../src/scripts/Npm.ts';
import { ObsidianDevUtilsRepoPaths } from '../src/scripts/ObsidianDevUtilsRepoPaths.ts';
import { wrapCliTask } from '../src/scripts/CliUtils.ts';
import { deepEqual } from '../src/Object.ts';
import { CliTaskResult } from '../src/scripts/CliUtils.ts';

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

  let isChanged = false;

  await editNpmPackage((npmPackage) => {
    const oldExports = npmPackage.exports;
    npmPackage.exports = {};
    for (const libDir of libDirs) {
      const importPath = libDir.replace(ObsidianDevUtilsRepoPaths.DistLib, '.');
      npmPackage.exports[importPath] = {
        default: normalizeIfRelative(join(libDir, ObsidianDevUtilsRepoPaths.IndexCjs)),
        types: normalizeIfRelative(join(libDir, ObsidianDevUtilsRepoPaths.IndexDts))
      };
      npmPackage.exports[normalizeIfRelative(join(importPath, ObsidianDevUtilsRepoPaths.Any))] = {
        default: normalizeIfRelative(join(libDir, ObsidianDevUtilsRepoPaths.AnyCjs)),
        types: normalizeIfRelative(join(libDir, ObsidianDevUtilsRepoPaths.AnyDts)),
      };
    }

    isChanged = !deepEqual(oldExports, npmPackage.exports);
  });

  return CliTaskResult.Success(!isChanged);
});
