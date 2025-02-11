import type { PackageJson } from '../src/scripts/Npm.ts';

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

    if (dirent.name === ObsidianDevUtilsRepoPaths.Styles as string) {
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

      packageJson.exports[importPath] = getExport(libDir, ObsidianDevUtilsRepoPaths.IndexDts);
      packageJson.exports[normalizeIfRelative(join(importPath, ObsidianDevUtilsRepoPaths.Any))] = getExport(libDir, ObsidianDevUtilsRepoPaths.AnyDts);
    }

    isChanged = !deepEqual(oldExports, packageJson.exports);
  });

  // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
  if (isChanged) {
    console.error('Package exports have changed. Please review the changes and commit them.');
  }

  return CliTaskResult.Success(!isChanged);
});

function getExport(libDir: string, dtsPath: string): PackageJson.Exports {
  const dmtsPath = dtsPath.replace(ObsidianDevUtilsRepoPaths.DtsExtension, ObsidianDevUtilsRepoPaths.DmtsExtension);
  const dctsPath = dtsPath.replace(ObsidianDevUtilsRepoPaths.DtsExtension, ObsidianDevUtilsRepoPaths.DctsExtension);

  const types = {
    import: normalizeIfRelative(join(libDir, dmtsPath)),
    require: normalizeIfRelative(join(libDir, dctsPath))
  };

  if (libDir.includes(ObsidianDevUtilsRepoPaths.Types)) {
    if (libDir.includes(ObsidianDevUtilsRepoPaths.Types)) {
      return {
        types
      };
    }
  }

  const mjsPath = dtsPath.replace(ObsidianDevUtilsRepoPaths.DtsExtension, ObsidianDevUtilsRepoPaths.MjsExtension);
  const cjsPath = dtsPath.replace(ObsidianDevUtilsRepoPaths.DtsExtension, ObsidianDevUtilsRepoPaths.CjsExtension);

  return {
    /* eslint-disable perfectionist/sort-objects */
    types,
    import: normalizeIfRelative(join(libDir, mjsPath)),
    require: normalizeIfRelative(join(libDir, cjsPath))
    /* eslint-enable perfectionist/sort-objects */
  };
}
