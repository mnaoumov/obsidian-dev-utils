import { deepEqual } from '../src/Object.ts';
import {
  join,
  normalizeIfRelative
} from '../src/Path.ts';
import {
  CliTaskResult,
  wrapCliTask
} from '../src/scripts/CliUtils.ts';
import { readdirPosix } from '../src/scripts/Fs.ts';
import { editNpmPackage } from '../src/scripts/Npm.ts';
import { ObsidianDevUtilsRepoPaths } from '../src/scripts/ObsidianDevUtilsRepoPaths.ts';

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
        types: normalizeIfRelative(join(libDir, ObsidianDevUtilsRepoPaths.IndexDts)),
        default: normalizeIfRelative(join(libDir, ObsidianDevUtilsRepoPaths.IndexCjs))
      };
      npmPackage.exports[normalizeIfRelative(join(importPath, ObsidianDevUtilsRepoPaths.Any))] = {
        types: normalizeIfRelative(join(libDir, ObsidianDevUtilsRepoPaths.AnyDts)),
        default: normalizeIfRelative(join(libDir, ObsidianDevUtilsRepoPaths.AnyCjs))
      };
    }

    isChanged = !deepEqual(oldExports, npmPackage.exports);
  });

  return CliTaskResult.Success(!isChanged);
});
