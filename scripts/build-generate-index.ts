import type { Dirent } from 'node:fs';

import { asyncMap } from '../src/async.ts';
import {
  basename,
  extname,
  join,
  normalizeIfRelative
} from '../src/path.ts';
import { wrapCliTask } from '../src/script-utils/cli-utils.ts';
import { generate } from '../src/script-utils/code-generator.ts';
import { readdirPosix } from '../src/script-utils/fs.ts';
import { ObsidianDevUtilsRepoPaths } from '../src/script-utils/obsidian-dev-utils-repo-paths.ts';
import { makeValidVariableName } from '../src/string.ts';

await wrapCliTask(async () => {
  await generateIndex(ObsidianDevUtilsRepoPaths.Src);
});

async function generateIndex(folder: string): Promise<boolean> {
  const dirents = await readdirPosix(folder, { withFileTypes: true });
  const lines = (await asyncMap(dirents, (dirent) => handleDirent(folder, dirent)))
    .filter((line) => line !== undefined);

  if (lines.length === 0) {
    return false;
  }

  await generate(join(folder, ObsidianDevUtilsRepoPaths.IndexTs), lines);
  return true;
}

async function handleDirent(folder: string, dirent: Dirent): Promise<string | undefined> {
  if (dirent.name === ObsidianDevUtilsRepoPaths.IndexTs as string) {
    return;
  }

  if (dirent.name.endsWith(ObsidianDevUtilsRepoPaths.DtsExtension)) {
    return;
  }

  if (dirent.name === ObsidianDevUtilsRepoPaths.Types as string || folder.split('/').includes(ObsidianDevUtilsRepoPaths.Types)) {
    return;
  }

  if (dirent.name === ObsidianDevUtilsRepoPaths.Styles as string) {
    return;
  }

  if (dirent.isFile() && !dirent.name.endsWith(ObsidianDevUtilsRepoPaths.TsExtension)) {
    return;
  }

  if (dirent.isFile() && (dirent.name.endsWith('.test.ts') || dirent.name === 'test-helpers.ts')) {
    return;
  }

  let sourceFile: string;
  let name: string;
  if (dirent.isDirectory()) {
    const hasExports = await generateIndex(join(folder, dirent.name));
    if (!hasExports) {
      return;
    }
    sourceFile = normalizeIfRelative(join(dirent.name, ObsidianDevUtilsRepoPaths.IndexTs));
    name = dirent.name;
  } else {
    const extension = extname(dirent.name);
    name = basename(dirent.name, extension);
    sourceFile = normalizeIfRelative(dirent.name);
  }

  if (name === ObsidianDevUtilsRepoPaths.ScriptUtils as string) {
    return;
  }

  return `export * as ${makeValidVariableName(name)} from '${sourceFile}';`;
}
