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
import { editPackageJson } from '../src/scripts/Npm.ts';
import { ObsidianDevUtilsRepoPaths } from '../src/scripts/ObsidianDevUtilsRepoPaths.ts';
import { replaceAll } from '../src/String.ts';

await wrapCliTask(async () => {
  const libDirs: string[] = [ObsidianDevUtilsRepoPaths.DistLib];

  for (const dirent of await readdirPosix(ObsidianDevUtilsRepoPaths.DistLib, { recursive: true, withFileTypes: true })) {
    if (!dirent.isDirectory()) {
      continue;
    }

    const path = join(dirent.parentPath, dirent.name);
    libDirs.push(path);
  }

  libDirs.sort();

  let isChanged = false;

  await editPackageJson((packageJson) => {
    const oldExports = packageJson.exports;
    packageJson.exports = {};
    for (const libDir of libDirs) {
      const importPath = replaceAll(libDir, ObsidianDevUtilsRepoPaths.DistLib, '.');
      /* eslint-disable perfectionist/sort-objects */
      packageJson.exports[importPath] = {
        types: normalizeIfRelative(join(libDir, ObsidianDevUtilsRepoPaths.IndexDts)),
        import: normalizeIfRelative(join(libDir, ObsidianDevUtilsRepoPaths.IndexMjs)),
        require: normalizeIfRelative(join(libDir, ObsidianDevUtilsRepoPaths.IndexCjs))
      };
      packageJson.exports[normalizeIfRelative(join(importPath, ObsidianDevUtilsRepoPaths.Any))] = {
        types: normalizeIfRelative(join(libDir, ObsidianDevUtilsRepoPaths.AnyDts)),
        import: normalizeIfRelative(join(libDir, ObsidianDevUtilsRepoPaths.AnyMjs)),
        require: normalizeIfRelative(join(libDir, ObsidianDevUtilsRepoPaths.AnyCjs))
      };
      packageJson.exports[normalizeIfRelative(join(ObsidianDevUtilsRepoPaths.DistLib, importPath))] = {
        types: normalizeIfRelative(join(libDir, ObsidianDevUtilsRepoPaths.IndexDts)),
        import: normalizeIfRelative(join(libDir, ObsidianDevUtilsRepoPaths.IndexMjs)),
        require: normalizeIfRelative(join(libDir, ObsidianDevUtilsRepoPaths.IndexCjs))
      };
      packageJson.exports[normalizeIfRelative(join(ObsidianDevUtilsRepoPaths.DistLib, importPath, ObsidianDevUtilsRepoPaths.Any))] = {
        types: normalizeIfRelative(join(libDir, ObsidianDevUtilsRepoPaths.AnyDts)),
        import: normalizeIfRelative(join(libDir, ObsidianDevUtilsRepoPaths.AnyMjs)),
        require: normalizeIfRelative(join(libDir, ObsidianDevUtilsRepoPaths.AnyCjs))
      };
      /* eslint-enable perfectionist/sort-objects */
    }

    isChanged = !deepEqual(oldExports, packageJson.exports);
  });

  return CliTaskResult.Success(!isChanged);
});
