import {
  mkdir,
  readFile,
  writeFile
} from 'node:fs/promises';

import {
  basename,
  dirname,
  join
} from '../src/path.ts';
import { wrapCliTask } from '../src/script-utils/cli-utils.ts';
import { readdirPosix } from '../src/script-utils/fs.ts';
import { ObsidianDevUtilsRepoPaths } from '../src/script-utils/obsidian-dev-utils-repo-paths.ts';
import { execFromRoot } from '../src/script-utils/root.ts';
import { replaceAll } from '../src/string.ts';

await wrapCliTask(async () => {
  await execFromRoot('tsc --project ./tsconfig.types.json');
  const IMPORT_REG_EXP = /from '(?<ImportPath>.+?)\.ts';/gm;

  for (const file of await readdirPosix(ObsidianDevUtilsRepoPaths.Src, { recursive: true })) {
    if (!file.endsWith(ObsidianDevUtilsRepoPaths.DtsExtension)) {
      continue;
    }

    const folder = dirname(file);
    const name = basename(file, ObsidianDevUtilsRepoPaths.DtsExtension);
    const fullSourcePath = join(ObsidianDevUtilsRepoPaths.Src, file);
    const content = await readFile(fullSourcePath, 'utf-8');

    const ctsPath = join(ObsidianDevUtilsRepoPaths.DistLib, ObsidianDevUtilsRepoPaths.Cjs, folder, name + ObsidianDevUtilsRepoPaths.DctsExtension);
    const mtsPath = join(ObsidianDevUtilsRepoPaths.DistLib, ObsidianDevUtilsRepoPaths.Esm, folder, name + ObsidianDevUtilsRepoPaths.DmtsExtension);

    await mkdir(dirname(ctsPath), { recursive: true });
    await mkdir(dirname(mtsPath), { recursive: true });
    const ctsContent = replaceAll(content, IMPORT_REG_EXP, 'from \'$<ImportPath>.cjs\';');
    const mtsContent = replaceAll(content, IMPORT_REG_EXP, 'from \'$<ImportPath>.mjs\';');
    await writeFile(ctsPath, ctsContent);
    await writeFile(mtsPath, mtsContent);
  }
});
