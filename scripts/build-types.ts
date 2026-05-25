import { readFileSync } from 'node:fs';
import {
  mkdir,
  readFile,
  writeFile
} from 'node:fs/promises';
import { relative } from 'node:path';

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

interface TsconfigCompilerOptions {
  readonly lib?: string[];
  readonly types?: string[];
}

interface TsconfigJson {
  compilerOptions?: TsconfigCompilerOptions;
}

const REFERENCE_LIB_REG_EXP = /\/\/\/ <reference lib="(?<Lib>[^"]+)" \/>/gm;
const DECLARATION_REFERENCE_TYPES = new Set(['node']);
const LIBRARY_FILE_NAME = 'library';

await wrapCliTask(async () => {
  await execFromRoot('tsc --project ./tsconfig.types.json');
  const STATIC_IMPORT_REG_EXP = /from '(?<ImportPath>.+?)\.ts';/gm;
  const DYNAMIC_IMPORT_REG_EXP = /import\("(?<ImportPath>.+?)\.ts"\)/gm;

  const allLibs = await collectAllLibs();
  const allTypes = await collectAllTypes();

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

    const ctsPath = join(ObsidianDevUtilsRepoPaths.DistLib, ObsidianDevUtilsRepoPaths.Cjs, folder, name + ObsidianDevUtilsRepoPaths.DctsExtension);
    const mtsPath = join(ObsidianDevUtilsRepoPaths.DistLib, ObsidianDevUtilsRepoPaths.Esm, folder, name + ObsidianDevUtilsRepoPaths.DmtsExtension);

    await mkdir(dirname(ctsPath), { recursive: true });
    await mkdir(dirname(mtsPath), { recursive: true });

    const isLibraryFile = name === LIBRARY_FILE_NAME && folder === '.';

    let ctsContent = replaceAll(content, STATIC_IMPORT_REG_EXP, 'from \'$<ImportPath>.cjs\';');
    ctsContent = replaceAll(ctsContent, DYNAMIC_IMPORT_REG_EXP, 'import("$<ImportPath>.cjs")');

    let mtsContent = replaceAll(content, STATIC_IMPORT_REG_EXP, 'from \'$<ImportPath>.mjs\';');
    mtsContent = replaceAll(mtsContent, DYNAMIC_IMPORT_REG_EXP, 'import("$<ImportPath>.mjs")');

    if (isLibraryFile) {
      const libDirectives = buildAllReferenceLibDirectives(allLibs);
      const typesDirectives = buildAllReferenceTypesDirectives(allTypes);
      ctsContent = libDirectives + typesDirectives + ctsContent;
      mtsContent = libDirectives + typesDirectives + mtsContent;
    } else {
      const ctsLibRef = buildReferencePathDirective(ctsPath, ObsidianDevUtilsRepoPaths.Cjs, ObsidianDevUtilsRepoPaths.DctsExtension);
      ctsContent = ctsLibRef + ctsContent;

      const mtsLibRef = buildReferencePathDirective(mtsPath, ObsidianDevUtilsRepoPaths.Esm, ObsidianDevUtilsRepoPaths.DmtsExtension);
      mtsContent = mtsLibRef + mtsContent;
    }

    await writeFile(ctsPath, ctsContent);
    await writeFile(mtsPath, mtsContent);
  }

  async function collectAllLibs(): Promise<string[]> {
    const tsconfigContent = await readFile('tsconfig.json', 'utf-8');
    const tsconfig = JSON.parse(tsconfigContent) as TsconfigJson;
    const libs = new Set((tsconfig.compilerOptions?.lib ?? []).map((lib) => lib.toLowerCase()));

    for (const file of await readdirPosix(ObsidianDevUtilsRepoPaths.Src, { recursive: true })) {
      const sourceFilePath = join(ObsidianDevUtilsRepoPaths.Src, file);
      if (!file.endsWith('.ts')) {
        continue;
      }

      const sourceContent = readFileSync(sourceFilePath, 'utf-8');
      for (const match of sourceContent.matchAll(REFERENCE_LIB_REG_EXP)) {
        libs.add((match.groups?.['Lib'] ?? '').toLowerCase());
      }
    }

    return [...libs].sort();
  }

  async function collectAllTypes(): Promise<string[]> {
    const tsconfigContent = await readFile('tsconfig.json', 'utf-8');
    const tsconfig = JSON.parse(tsconfigContent) as TsconfigJson;
    return (tsconfig.compilerOptions?.types ?? [])
      .filter((type) => DECLARATION_REFERENCE_TYPES.has(type))
      .sort();
  }

  function buildAllReferenceLibDirectives(libs: string[]): string {
    return `${
      libs
        .map((lib) => `/// <reference lib="${lib}" />`)
        .join('\n')
    }\n`;
  }

  function buildAllReferenceTypesDirectives(types: string[]): string {
    if (types.length === 0) {
      return '';
    }
    return `${
      types
        .map((type) => `/// <reference types="${type}" />`)
        .join('\n')
    }\n`;
  }

  function buildReferencePathDirective(declarationFilePath: string, moduleDir: string, extension: string): string {
    const libraryFilePath = join(ObsidianDevUtilsRepoPaths.DistLib, moduleDir, LIBRARY_FILE_NAME + extension);
    let relativePath = relative(dirname(declarationFilePath), libraryFilePath).replaceAll('\\', '/');
    if (!relativePath.startsWith('.')) {
      relativePath = `./${relativePath}`;
    }
    return `/// <reference path="${relativePath}" />\n`;
  }
});
