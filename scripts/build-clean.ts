import { buildClean } from '@mnaoumov/typescript-dev-toolkit/build';
import { wrapCliTask } from '@mnaoumov/typescript-dev-toolkit/cli-utils';
import { readdirPosix } from '@mnaoumov/typescript-dev-toolkit/fs';
import { RepoPaths } from '@mnaoumov/typescript-dev-toolkit/repo-paths';
import {
  basename,
  join
} from '@mnaoumov/typescript-lib/path';
import { rm } from 'node:fs/promises';

await wrapCliTask(async () => {
  await buildClean();
  for (const file of await readdirPosix(RepoPaths.Src, { recursive: true })) {
    if (basename(file) === RepoPaths.IndexTs as string) {
      await rm(join(RepoPaths.Src, file));
    }

    if (file.endsWith(RepoPaths.DtsExtension) && !file.split('/').includes(RepoPaths.Types)) {
      await rm(join(RepoPaths.Src, file));
    }
  }

  for (const file of await readdirPosix(RepoPaths.CurrentFolder, { recursive: true })) {
    if ((basename(file) !== RepoPaths.PackageJson as string) || (file === RepoPaths.PackageJson as string) || file.startsWith(RepoPaths.NodeModules)) {
      continue;
    }

    await rm(file);
  }
});
