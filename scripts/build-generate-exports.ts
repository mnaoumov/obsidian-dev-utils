import type { PackageJson } from '@mnaoumov/typescript-dev-toolkit/npm';

import {
  CliTaskResult,
  wrapCliTask
} from '@mnaoumov/typescript-dev-toolkit/cli-utils';
import { readdirPosix } from '@mnaoumov/typescript-dev-toolkit/fs';
import { writeJson } from '@mnaoumov/typescript-dev-toolkit/json';
import { editPackageJson } from '@mnaoumov/typescript-dev-toolkit/npm';
import { RepoPaths } from '@mnaoumov/typescript-dev-toolkit/repo-paths';
import { isDeepEqual } from '@mnaoumov/typescript-lib/object-utils';
import {
  basename,
  dirname,
  join,
  normalizeIfRelative,
  relative
} from '@mnaoumov/typescript-lib/path';
import { replaceAll } from '@mnaoumov/typescript-lib/string';
import { existsSync } from 'node:fs';
import { mkdir } from 'node:fs/promises';

/**
 * The export condition that maps every subpath onto its TypeScript source, so a package can import a sibling
 * package's source before anything is built. Set by `.npmrc` (`node-options`), `tsconfig.base.json`
 * (`customConditions`) and every vitest config (`resolve.conditions`).
 */
const SOURCE_CONDITION = '@mnaoumov/source';

await wrapCliTask(async () => {
  const srcFolders: string[] = [RepoPaths.Src];

  for (const dirent of await readdirPosix(RepoPaths.Src, { recursive: true, withFileTypes: true })) {
    if (!dirent.isDirectory()) {
      continue;
    }

    const path = join(dirent.parentPath, dirent.name);

    if (path.includes(RepoPaths.Styles) || path.includes(RepoPaths.TestHelpers)) {
      continue;
    }

    srcFolders.push(path);
  }

  srcFolders.sort();

  let isChanged = false;

  await editPackageJson(async (packageJson) => {
    const oldExports = packageJson.exports;
    packageJson.exports = {};
    for (const srcFolder of srcFolders) {
      await setExport(packageJson.exports, srcFolder, false);
      await setExport(packageJson.exports, srcFolder, true);
    }

    isChanged = !isDeepEqual(oldExports, packageJson.exports);
  });

  // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition -- It changed in the `editPackageJson`, ESLint mistakenly does not recognize it.
  if (isChanged) {
    throw new Error('Package exports have changed. Please review the changes and commit them.');
  }

  return CliTaskResult.Success();
});

async function setExport(exportConditions: PackageJson.ExportConditions, srcFolder: string, isWildcard: boolean): Promise<void> {
  const importPath = replaceAll({
    $string: srcFolder,
    replacer: RepoPaths.CurrentFolder,
    searchValue: RepoPaths.Src
  });
  const conditionPath = isWildcard ? `${importPath}/${RepoPaths.Any}` : importPath;
  const dmtsPath = normalizeIfRelative(
    join(
      RepoPaths.DistLib,
      RepoPaths.Esm,
      importPath,
      isWildcard ? RepoPaths.AnyDmts : RepoPaths.IndexDmts
    )
  );
  const dctsPath = normalizeIfRelative(
    join(
      RepoPaths.DistLib,
      RepoPaths.Cjs,
      importPath,
      isWildcard ? RepoPaths.AnyDcts : RepoPaths.IndexDcts
    )
  );
  const dmtsFolderPath = dirname(dmtsPath);
  const dctsFolderPath = dirname(dctsPath);

  if (!isWildcard && !existsSync(dctsPath)) {
    return;
  }

  if (importPath.includes(RepoPaths.Types)) {
    exportConditions[conditionPath] = {
      import: {
        types: dmtsPath
      },
      require: {
        types: dctsPath
      }
    };

    if (importPath !== RepoPaths.CurrentFolder as string) {
      if (isWildcard) {
        const files = await readdirPosix(dctsFolderPath);
        for (const file of files) {
          if (!file.endsWith(RepoPaths.DctsExtension)) {
            continue;
          }
          const name = basename(file, RepoPaths.DctsExtension);
          const packageJsonFolderPath = join(importPath, name);
          const packageJson: PackageJson = {
            type: 'module',
            types: relative(packageJsonFolderPath, join(dctsFolderPath, name + RepoPaths.DctsExtension))
          };
          await mkdir(packageJsonFolderPath, { recursive: true });
          await writeJson(join(packageJsonFolderPath, RepoPaths.PackageJson), packageJson);
        }
      } else {
        const packageJson: PackageJson = {
          type: 'module',
          types: relative(importPath, dctsPath)
        };
        await mkdir(importPath, { recursive: true });
        await writeJson(join(importPath, RepoPaths.PackageJson), packageJson);
      }
    }

    return;
  }

  const mjsPath = normalizeIfRelative(
    join(
      RepoPaths.DistLib,
      RepoPaths.Esm,
      importPath,
      isWildcard ? RepoPaths.AnyMjs : RepoPaths.IndexMjs
    )
  );
  const cjsPath = normalizeIfRelative(
    join(
      RepoPaths.DistLib,
      RepoPaths.Cjs,
      importPath,
      isWildcard ? RepoPaths.AnyCjs : RepoPaths.IndexCjs
    )
  );

  const sourcePath = normalizeIfRelative(join(RepoPaths.Src, importPath, isWildcard ? RepoPaths.AnyTs : RepoPaths.IndexTs));

  exportConditions[conditionPath] = {
    /* eslint-disable perfectionist/sort-objects -- Order matters once it is written to `package.json`. */
    // First, so it wins wherever it is set: inside this repository, before anything is built. See `.npmrc`.
    [SOURCE_CONDITION]: sourcePath,
    import: {
      types: dmtsPath,
      default: mjsPath
    },
    require: {
      types: dctsPath,
      default: cjsPath
    }
    /* eslint-enable perfectionist/sort-objects -- Order matters once it is written to `package.json`. */
  };

  if (importPath !== RepoPaths.CurrentFolder as string) {
    if (isWildcard) {
      const files = await readdirPosix(dctsFolderPath);
      for (const file of files) {
        if (!file.endsWith(RepoPaths.DctsExtension)) {
          continue;
        }
        const name = basename(file, RepoPaths.DctsExtension);
        const packageJsonFolderPath = join(importPath, name);
        const packageJson: PackageJson = {
          main: relative(packageJsonFolderPath, join(dctsFolderPath, name + RepoPaths.CjsExtension)),
          module: relative(packageJsonFolderPath, join(dmtsFolderPath, name + RepoPaths.MjsExtension)),
          type: 'module',
          types: relative(packageJsonFolderPath, join(dctsFolderPath, name + RepoPaths.DctsExtension))
        };
        await mkdir(packageJsonFolderPath, { recursive: true });
        await writeJson(join(packageJsonFolderPath, RepoPaths.PackageJson), packageJson);
      }
    } else {
      const packageJson: PackageJson = {
        main: relative(importPath, cjsPath),
        module: relative(importPath, mjsPath),
        type: 'module',
        types: relative(importPath, dctsPath)
      };
      await mkdir(importPath, { recursive: true });
      await writeJson(join(importPath, RepoPaths.PackageJson), packageJson);
    }
  }
}
