import type { Dirent } from 'node:fs';

import { wrapCliTask } from '@mnaoumov/typescript-dev-toolkit/cli-utils';
import { generate } from '@mnaoumov/typescript-dev-toolkit/code-generator';
import { readdirPosix } from '@mnaoumov/typescript-dev-toolkit/fs';
import { RepoPaths } from '@mnaoumov/typescript-dev-toolkit/repo-paths';
import { asyncMap } from '@mnaoumov/typescript-lib/async';
import {
  basename,
  extname,
  join,
  normalizeIfRelative
} from '@mnaoumov/typescript-lib/path';

enum GenerateIndexResult {
  Skipped = 'skipped',
  Success = 'success'
}

await wrapCliTask(async () => {
  await generateIndex(RepoPaths.Src);
});

async function generateIndex(folder: string): Promise<GenerateIndexResult> {
  const dirents = await readdirPosix(folder, { withFileTypes: true });
  const maybeLines = await asyncMap(dirents, (dirent) => handleDirent(folder, dirent));
  const lines = maybeLines.filter((line) => line !== undefined);

  if (lines.length === 0) {
    return GenerateIndexResult.Skipped;
  }

  await generate(join(folder, RepoPaths.IndexTs), lines);
  return GenerateIndexResult.Success;
}

async function handleDirent(folder: string, dirent: Dirent): Promise<string | undefined> {
  if ((dirent.name === RepoPaths.IndexTs as string) || dirent.name.endsWith(RepoPaths.DtsExtension) || dirent.name === RepoPaths.Types as string || folder.split('/').includes(RepoPaths.Types) || (dirent.name === RepoPaths.Styles as string) || (dirent.name === RepoPaths.TestHelpers as string) || (dirent.isFile() && !dirent.name.endsWith(RepoPaths.TsExtension)) || (dirent.isFile() && dirent.name.endsWith('.test.ts')) || (dirent.isFile() && (dirent.name === 'setup.ts' || dirent.name.endsWith('-setup.ts')))) {
    return;
  }

  let sourceFile: string;
  let name: string;
  if (dirent.isDirectory()) {
    const result = await generateIndex(join(folder, dirent.name));
    if (result !== GenerateIndexResult.Success) {
      return;
    }
    sourceFile = normalizeIfRelative(join(dirent.name, RepoPaths.IndexTs));
    name = dirent.name;
  } else {
    const extension = extname(dirent.name);
    name = basename(dirent.name, extension);
    sourceFile = normalizeIfRelative(dirent.name);
  }

  return `export * as '${name}' from '${sourceFile}';`;
}
