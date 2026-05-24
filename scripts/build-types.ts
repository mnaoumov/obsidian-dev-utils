import {
  existsSync,
  readFileSync
} from 'node:fs';
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

const REFERENCE_LIB_REG_EXP = /\/\/\/ <reference lib="(?<Lib>[^"]+)" \/>/gm;

await wrapCliTask(async () => {
  await execFromRoot('tsc --project ./tsconfig.types.json');
  const STATIC_IMPORT_REG_EXP = /from '(?<ImportPath>.+?)\.ts';/gm;
  const DYNAMIC_IMPORT_REG_EXP = /import\("(?<ImportPath>.+?)\.ts"\)/gm;

  for (const file of await readdirPosix(ObsidianDevUtilsRepoPaths.Src, { recursive: true })) {
    if (!file.endsWith(ObsidianDevUtilsRepoPaths.DtsExtension)) {
      continue;
    }

    if (file.startsWith(ObsidianDevUtilsRepoPaths.TestHelpers)) {
      continue;
    }

    const folder = dirname(file);
    const name = basename(file, ObsidianDevUtilsRepoPaths.DtsExtension);
    const fullSourcePath = join(ObsidianDevUtilsRepoPaths.Src, file);
    const content = await readFile(fullSourcePath, 'utf-8');
    const sourceFilePath = join(ObsidianDevUtilsRepoPaths.Src, folder, `${name}.ts`);
    const referenceLibDirectives = collectReferenceLibDirectives(sourceFilePath, content);

    const ctsPath = join(ObsidianDevUtilsRepoPaths.DistLib, ObsidianDevUtilsRepoPaths.Cjs, folder, name + ObsidianDevUtilsRepoPaths.DctsExtension);
    const mtsPath = join(ObsidianDevUtilsRepoPaths.DistLib, ObsidianDevUtilsRepoPaths.Esm, folder, name + ObsidianDevUtilsRepoPaths.DmtsExtension);

    await mkdir(dirname(ctsPath), { recursive: true });
    await mkdir(dirname(mtsPath), { recursive: true });
    let ctsContent = replaceAll(content, STATIC_IMPORT_REG_EXP, 'from \'$<ImportPath>.cjs\';');
    ctsContent = replaceAll(ctsContent, DYNAMIC_IMPORT_REG_EXP, 'import("$<ImportPath>.cjs")');
    let mtsContent = replaceAll(content, STATIC_IMPORT_REG_EXP, 'from \'$<ImportPath>.mjs\';');
    mtsContent = replaceAll(mtsContent, DYNAMIC_IMPORT_REG_EXP, 'import("$<ImportPath>.mjs")');
    ctsContent = referenceLibDirectives + ctsContent;
    mtsContent = referenceLibDirectives + mtsContent;
    await writeFile(ctsPath, ctsContent);
    await writeFile(mtsPath, mtsContent);
  }

  function collectReferenceLibDirectives(sourceFilePath: string, dtsContent: string): string {
    const sourceContent = existsSync(sourceFilePath)
      ? readFileSync(sourceFilePath, 'utf-8')
      : dtsContent;
    const matches = sourceContent.matchAll(REFERENCE_LIB_REG_EXP);
    const directives = [...matches].map((match) => match[0]);
    if (directives.length === 0) {
      return '';
    }
    return `${directives.join('\n')}\n`;
  }
});
