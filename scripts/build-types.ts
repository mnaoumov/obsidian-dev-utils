import { parseTsConfig } from '@mnaoumov/typescript-dev-toolkit/check-project-types';
import { wrapCliTask } from '@mnaoumov/typescript-dev-toolkit/cli-utils';
import { readdirPosix } from '@mnaoumov/typescript-dev-toolkit/fs';
import { RepoPaths } from '@mnaoumov/typescript-dev-toolkit/repo-paths';
import { execFromRoot } from '@mnaoumov/typescript-dev-toolkit/root';
import {
  basename,
  dirname,
  join
} from '@mnaoumov/typescript-lib/path';
import { replaceAll } from '@mnaoumov/typescript-lib/string';
import {
  existsSync,
  readFileSync
} from 'node:fs';
import {
  mkdir,
  readFile,
  writeFile
} from 'node:fs/promises';
import { relative } from 'node:path';

const REFERENCE_LIB_REG_EXP = /\/\/\/ <reference lib="(?<Lib>[^"]+)" \/>/gm;
const DECLARATION_REFERENCE_TYPES = new Set(['node']);
// The declaration every other one references for the package's `lib` and `types` directives: `library` where the
// package has one, otherwise the generated `index`, which every package has.
const LIBRARY_FILE_NAME = existsSync(join(RepoPaths.Src, 'library.ts')) ? 'library' : 'index';

// A bare-specifier (non-relative) type-only import, e.g. `import type { Promisable } from 'type-fest';`.
const BARE_TYPE_IMPORT_REG_EXP = /^import type (?<Clause>.+?) from '(?<Specifier>[^.'][^']*)';$/gm;

// A bare-specifier (non-relative) inline import type node, e.g. `import("type-fest").Promisable`.
const BARE_INLINE_IMPORT_TYPE_REG_EXP = /import\("(?<Specifier>[^."][^"]*)"\)/g;

await wrapCliTask(async () => {
  await execFromRoot('tsc --project ./tsconfig.types.json');
  const STATIC_IMPORT_REG_EXP = /from '(?<ImportPath>.+?)\.ts';/gm;
  // Inline import-type nodes (`typeof import('./foo.ts')`) preserve the source quote style.
  // Hand-authored `.d.ts` files emit single quotes; tsc-generated declarations emit double quotes.
  // Capture the quote and reuse it in the replacement so both styles are rewritten.
  const DYNAMIC_IMPORT_REG_EXP = /import\((?<Quote>['"])(?<ImportPath>.+?)\.ts\k<Quote>\)/gm;

  const allLibs = await collectAllLibs();
  const allTypes = collectAllTypes();

  for (const file of await readdirPosix(RepoPaths.Src, { recursive: true })) {
    if (!file.endsWith(RepoPaths.DtsExtension) || file.startsWith(RepoPaths.TestHelpers)) {
      continue;
    }

    const folder = dirname(file);
    const name = basename(file, RepoPaths.DtsExtension);
    const fullSourcePath = join(RepoPaths.Src, file);
    const content = await readFile(fullSourcePath, 'utf-8');

    const ctsPath = join(RepoPaths.DistLib, RepoPaths.Cjs, folder, name + RepoPaths.DctsExtension);
    const mtsPath = join(RepoPaths.DistLib, RepoPaths.Esm, folder, name + RepoPaths.DmtsExtension);

    await mkdir(dirname(ctsPath), { recursive: true });
    await mkdir(dirname(mtsPath), { recursive: true });

    const isLibraryFile = name === LIBRARY_FILE_NAME && folder === '.';

    let ctsContent = replaceAll({
      $string: content,
      replacer: 'from \'$<ImportPath>.cjs\';',
      searchValue: STATIC_IMPORT_REG_EXP
    });
    ctsContent = replaceAll({
      $string: ctsContent,
      replacer: 'import($<Quote>$<ImportPath>.cjs$<Quote>)',
      searchValue: DYNAMIC_IMPORT_REG_EXP
    });

    // A `.d.cts` file is a CommonJS module. Type-only imports of a bare specifier resolving to an
    // ESM-only package need a `resolution-mode` attribute, else `tsc` reports TS1541 / TS1542.
    // Passing `'import'` is valid for CommonJS targets too, so every bare specifier receives it.
    // The ESM `.d.mts` needs no such attribute, so this transform runs on CommonJS content only.
    ctsContent = replaceAll({
      $string: ctsContent,
      replacer: 'import type $<Clause> from \'$<Specifier>\' with { \'resolution-mode\': \'import\' };',
      searchValue: BARE_TYPE_IMPORT_REG_EXP
    });
    ctsContent = replaceAll({
      $string: ctsContent,
      replacer: 'import("$<Specifier>", { with: { \'resolution-mode\': \'import\' } })',
      searchValue: BARE_INLINE_IMPORT_TYPE_REG_EXP
    });

    let mtsContent = replaceAll({
      $string: content,
      replacer: 'from \'$<ImportPath>.mjs\';',
      searchValue: STATIC_IMPORT_REG_EXP
    });
    mtsContent = replaceAll({
      $string: mtsContent,
      replacer: 'import($<Quote>$<ImportPath>.mjs$<Quote>)',
      searchValue: DYNAMIC_IMPORT_REG_EXP
    });

    if (isLibraryFile) {
      const libDirectives = buildAllReferenceLibDirectives(allLibs);
      const typesDirectives = buildAllReferenceTypesDirectives(allTypes);
      ctsContent = libDirectives + typesDirectives + ctsContent;
      mtsContent = libDirectives + typesDirectives + mtsContent;
    } else {
      const ctsLibRef = buildReferencePathDirective(ctsPath, RepoPaths.Cjs, RepoPaths.DctsExtension);
      ctsContent = ctsLibRef + ctsContent;

      const mtsLibRef = buildReferencePathDirective(mtsPath, RepoPaths.Esm, RepoPaths.DmtsExtension);
      mtsContent = mtsLibRef + mtsContent;
    }

    await writeFile(ctsPath, ctsContent);
    await writeFile(mtsPath, mtsContent);
  }
});

function buildAllReferenceLibDirectives(libs: string[]): string {
  return `${
    libs
      .map((lib) => `/// <reference lib="${lib}" />`)
      .join('\n')
  }\n`;
}

function buildAllReferenceTypesDirectives(types: string[]): string {
  return types.length === 0
    ? ''
    : `${
      types
        .map((type) => `/// <reference types="${type}" />`)
        .join('\n')
    }\n`;
}

function buildReferencePathDirective(declarationFilePath: string, moduleDirectory: string, extension: string): string {
  const libraryFilePath = join(RepoPaths.DistLib, moduleDirectory, LIBRARY_FILE_NAME + extension);
  let relativePath = relative(dirname(declarationFilePath), libraryFilePath).replaceAll('\\', '/');
  if (!relativePath.startsWith('.')) {
    relativePath = `./${relativePath}`;
  }
  return `/// <reference path="${relativePath}" />\n`;
}

async function collectAllLibs(): Promise<string[]> {
  // The RESOLVED options, because a package's `tsconfig.json` inherits `lib` from the shared base. The resolved
  // names are file names (`lib.dom.iterable.d.ts`), so they are mapped back onto the names a directive takes.
  const { options } = parseTsConfig(RepoPaths.TsConfigJson);
  const libs = new Set((options.lib ?? []).map((lib) => lib.toLowerCase().replace(/^lib\./, '').replace(/\.d\.ts$/, '')));

  for (const file of await readdirPosix(RepoPaths.Src, { recursive: true })) {
    const sourceFilePath = join(RepoPaths.Src, file);
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

function collectAllTypes(): string[] {
  const { options } = parseTsConfig(RepoPaths.TsConfigJson);
  return (options.types ?? [])
    .filter((type) => DECLARATION_REFERENCE_TYPES.has(type))
    .sort();
}
