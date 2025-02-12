import type { PackageJson } from '../src/ScriptUtils/Npm.ts';

import { deepEqual } from '../src/Object.ts';
import {
  basename,
  dirname,
  join,
  normalizeIfRelative,
  relative
} from '../src/Path.ts';
import {
  CliTaskResult,
  wrapCliTask
} from '../src/ScriptUtils/CliUtils.ts';
import { readdirPosix } from '../src/ScriptUtils/Fs.ts';
import { writeJson } from '../src/ScriptUtils/JSON.ts';
import {
  existsSync,
  mkdir
} from '../src/ScriptUtils/NodeModules.ts';
import { editPackageJson } from '../src/ScriptUtils/Npm.ts';
import { ObsidianDevUtilsRepoPaths } from '../src/ScriptUtils/ObsidianDevUtilsRepoPaths.ts';
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

  await editPackageJson(async (packageJson) => {
    const oldExports = packageJson.exports;
    packageJson.exports = {};
    for (const libDir of libDirs) {
      const importPath = replaceAll(libDir, ObsidianDevUtilsRepoPaths.DistLib, '.');
      await setExport(packageJson.exports, importPath, libDir, ObsidianDevUtilsRepoPaths.IndexDts);
      await setExport(packageJson.exports, normalizeIfRelative(join(importPath, ObsidianDevUtilsRepoPaths.Any)), libDir, ObsidianDevUtilsRepoPaths.AnyDts);
    }

    isChanged = !deepEqual(oldExports, packageJson.exports);
  });

  // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
  if (isChanged) {
    console.error('Package exports have changed. Please review the changes and commit them.');
  }

  return CliTaskResult.Success(!isChanged);
});

async function setExport(exports: PackageJson.ExportConditions, importPath: string, libDir: string, dtsPath: string): Promise<void> {
  const dmtsPath = dtsPath.replace(ObsidianDevUtilsRepoPaths.DtsExtension, ObsidianDevUtilsRepoPaths.DmtsExtension);
  const dctsPath = dtsPath.replace(ObsidianDevUtilsRepoPaths.DtsExtension, ObsidianDevUtilsRepoPaths.DctsExtension);

  const isWildcard = importPath.endsWith(ObsidianDevUtilsRepoPaths.Any);

  if (!isWildcard && !existsSync(join(libDir, dctsPath))) {
    return;
  }

  const types = {
    import: normalizeIfRelative(join(libDir, dmtsPath)),
    require: normalizeIfRelative(join(libDir, dctsPath))
  };

  if (libDir.includes(ObsidianDevUtilsRepoPaths.Types)) {
    exports[importPath] = {
      types
    };

    if (importPath !== '.') {
      if (isWildcard) {
        const files = await readdirPosix(libDir);
        for (const file of files) {
          if (!file.endsWith(ObsidianDevUtilsRepoPaths.DctsExtension)) {
            continue;
          }
          const name = basename(file, ObsidianDevUtilsRepoPaths.DctsExtension);
          const packageJsonPath = join(importPath.replace(ObsidianDevUtilsRepoPaths.Any, name), ObsidianDevUtilsRepoPaths.PackageJson);
          const packageJson: PackageJson = {
            type: 'module',
            types: relative(importPath, join(libDir, dctsPath.replace(ObsidianDevUtilsRepoPaths.Any, name)))
          };
          await mkdir(dirname(packageJsonPath), { recursive: true });
          await writeJson(packageJsonPath, packageJson);
        }
      } else {
        const packageJsonPath = join(importPath, ObsidianDevUtilsRepoPaths.PackageJson);
        const packageJson: PackageJson = {
          type: 'module',
          types: relative(importPath, join(libDir, dctsPath))
        };
        await mkdir(dirname(packageJsonPath), { recursive: true });
        await writeJson(packageJsonPath, packageJson);
      }
    }

    return;
  }

  const mjsPath = dtsPath.replace(ObsidianDevUtilsRepoPaths.DtsExtension, ObsidianDevUtilsRepoPaths.MjsExtension);
  const cjsPath = dtsPath.replace(ObsidianDevUtilsRepoPaths.DtsExtension, ObsidianDevUtilsRepoPaths.CjsExtension);

  exports[importPath] = {
    /* eslint-disable perfectionist/sort-objects */
    types,
    import: normalizeIfRelative(join(libDir, mjsPath)),
    require: normalizeIfRelative(join(libDir, cjsPath))
    /* eslint-enable perfectionist/sort-objects */
  };

  if (importPath !== '.') {
    if (isWildcard) {
      const files = await readdirPosix(libDir);
      for (const file of files) {
        if (!file.endsWith(ObsidianDevUtilsRepoPaths.DctsExtension)) {
          continue;
        }
        const name = basename(file, ObsidianDevUtilsRepoPaths.DctsExtension);
        const packageJsonPath = join(importPath.replace(ObsidianDevUtilsRepoPaths.Any, name), ObsidianDevUtilsRepoPaths.PackageJson);
        const packageJson: PackageJson = {
          main: relative(importPath, join(libDir, cjsPath.replace(ObsidianDevUtilsRepoPaths.Any, name))),
          module: relative(importPath, join(libDir, mjsPath.replace(ObsidianDevUtilsRepoPaths.Any, name))),
          type: 'module',
          types: relative(importPath, join(libDir, dctsPath.replace(ObsidianDevUtilsRepoPaths.Any, name)))
        };
        await mkdir(dirname(packageJsonPath), { recursive: true });
        await writeJson(packageJsonPath, packageJson);
      }
    } else {
      const packageJsonPath = join(importPath, ObsidianDevUtilsRepoPaths.PackageJson);
      const packageJson: PackageJson = {
        main: relative(importPath, join(libDir, cjsPath)),
        module: relative(importPath, join(libDir, mjsPath)),
        type: 'module',
        types: relative(importPath, join(libDir, dctsPath))
      };
      await mkdir(dirname(packageJsonPath), { recursive: true });
      await writeJson(packageJsonPath, packageJson);
    }
  }
}
