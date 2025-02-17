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
  const srcDirs: string[] = [ObsidianDevUtilsRepoPaths.Src];

  for (const dirent of await readdirPosix(ObsidianDevUtilsRepoPaths.Src, { recursive: true, withFileTypes: true })) {
    if (!dirent.isDirectory()) {
      continue;
    }

    if (dirent.name === ObsidianDevUtilsRepoPaths.Styles as string) {
      continue;
    }

    const path = join(dirent.parentPath, dirent.name);
    srcDirs.push(path);
  }

  srcDirs.sort();

  let isChanged = false;

  await editPackageJson(async (packageJson) => {
    const oldExports = packageJson.exports;
    packageJson.exports = {};
    for (const srcDir of srcDirs) {
      await setExport(packageJson.exports, srcDir, false);
      await setExport(packageJson.exports, srcDir, true);
    }

    isChanged = !deepEqual(oldExports, packageJson.exports);
  });

  // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
  if (isChanged) {
    console.error('Package exports have changed. Please review the changes and commit them.');
  }

  return CliTaskResult.Success(!isChanged);
});

async function setExport(exportConditions: PackageJson.ExportConditions, srcDir: string, isWildcard: boolean): Promise<void> {
  const importPath = replaceAll(srcDir, ObsidianDevUtilsRepoPaths.Src, ObsidianDevUtilsRepoPaths.CurrentDir);
  const conditionPath = isWildcard ? `${importPath}/${ObsidianDevUtilsRepoPaths.Any}` : importPath;
  const dmtsPath = normalizeIfRelative(
    join(
      ObsidianDevUtilsRepoPaths.DistLib,
      ObsidianDevUtilsRepoPaths.Esm,
      importPath,
      isWildcard ? ObsidianDevUtilsRepoPaths.AnyDmts : ObsidianDevUtilsRepoPaths.IndexDmts
    )
  );
  const dctsPath = normalizeIfRelative(
    join(
      ObsidianDevUtilsRepoPaths.DistLib,
      ObsidianDevUtilsRepoPaths.Cjs,
      importPath,
      isWildcard ? ObsidianDevUtilsRepoPaths.AnyDmts : ObsidianDevUtilsRepoPaths.IndexDcts
    )
  );
  const dmtsDirPath = dirname(dmtsPath);
  const dctsDirPath = dirname(dctsPath);

  if (!isWildcard && !existsSync(dctsPath)) {
    return;
  }

  if (importPath.includes(ObsidianDevUtilsRepoPaths.Types)) {
    exportConditions[conditionPath] = {
      import: {
        types: dmtsPath
      },
      require: {
        types: dctsPath
      }
    };

    if (importPath !== ObsidianDevUtilsRepoPaths.CurrentDir as string) {
      if (isWildcard) {
        const files = await readdirPosix(dctsDirPath);
        for (const file of files) {
          if (!file.endsWith(ObsidianDevUtilsRepoPaths.DctsExtension)) {
            continue;
          }
          const name = basename(file, ObsidianDevUtilsRepoPaths.DctsExtension);
          const packageJsonDirPath = join(importPath, name);
          const packageJson: PackageJson = {
            type: 'module',
            types: relative(packageJsonDirPath, join(dctsDirPath, name + ObsidianDevUtilsRepoPaths.DctsExtension))
          };
          await mkdir(packageJsonDirPath, { recursive: true });
          await writeJson(join(packageJsonDirPath, ObsidianDevUtilsRepoPaths.PackageJson), packageJson);
        }
      } else {
        const packageJson: PackageJson = {
          type: 'module',
          types: relative(importPath, dctsPath)
        };
        await mkdir(dirname(importPath), { recursive: true });
        await writeJson(join(importPath, ObsidianDevUtilsRepoPaths.PackageJson), packageJson);
      }
    }

    return;
  }

  const mjsPath = normalizeIfRelative(
    join(
      ObsidianDevUtilsRepoPaths.DistLib,
      ObsidianDevUtilsRepoPaths.Esm,
      importPath,
      isWildcard ? ObsidianDevUtilsRepoPaths.AnyMjs : ObsidianDevUtilsRepoPaths.IndexMjs
    )
  );
  const cjsPath = normalizeIfRelative(
    join(
      ObsidianDevUtilsRepoPaths.DistLib,
      ObsidianDevUtilsRepoPaths.Cjs,
      importPath,
      isWildcard ? ObsidianDevUtilsRepoPaths.AnyCjs : ObsidianDevUtilsRepoPaths.IndexCjs
    )
  );

  exportConditions[conditionPath] = {
    /* eslint-disable perfectionist/sort-objects */
    import: {
      types: dmtsPath,
      default: mjsPath
    },
    require: {
      types: dctsPath,
      default: cjsPath
    }
    /* eslint-enable perfectionist/sort-objects */
  };

  if (importPath !== ObsidianDevUtilsRepoPaths.CurrentDir as string) {
    if (isWildcard) {
      const files = await readdirPosix(dctsDirPath);
      for (const file of files) {
        if (!file.endsWith(ObsidianDevUtilsRepoPaths.DctsExtension)) {
          continue;
        }
        const name = basename(file, ObsidianDevUtilsRepoPaths.DctsExtension);
        const packageJsonDirPath = join(importPath, name);
        const packageJson: PackageJson = {
          main: relative(packageJsonDirPath, join(dctsDirPath, name + ObsidianDevUtilsRepoPaths.CjsExtension)),
          module: relative(packageJsonDirPath, join(dmtsDirPath, name + ObsidianDevUtilsRepoPaths.MjsExtension)),
          type: 'module',
          types: relative(packageJsonDirPath, join(dctsDirPath, name + ObsidianDevUtilsRepoPaths.DctsExtension))
        };
        await mkdir(packageJsonDirPath, { recursive: true });
        await writeJson(join(packageJsonDirPath, ObsidianDevUtilsRepoPaths.PackageJson), packageJson);
      }
    } else {
      const packageJson: PackageJson = {
        main: relative(importPath, cjsPath),
        module: relative(importPath, mjsPath),
        type: 'module',
        types: relative(importPath, dctsPath)
      };
      await mkdir(importPath, { recursive: true });
      await writeJson(join(importPath, ObsidianDevUtilsRepoPaths.PackageJson), packageJson);
    }
  }
}
