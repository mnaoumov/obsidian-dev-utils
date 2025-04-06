/**
 * @packageDocumentation
 *
 * Build generate index script.
 */

import type { Dirent } from '../src/ScriptUtils/NodeModules.ts';

import { asyncMap } from '../src/Async.ts';
import {
  basename,
  extname,
  join,
  normalizeIfRelative
} from '../src/Path.ts';
import { wrapCliTask } from '../src/ScriptUtils/CliUtils.ts';
import { generate } from '../src/ScriptUtils/CodeGenerator.ts';
import { readdirPosix } from '../src/ScriptUtils/Fs.ts';
import { ObsidianDevUtilsRepoPaths } from '../src/ScriptUtils/ObsidianDevUtilsRepoPaths.ts';
import { makeValidVariableName } from '../src/String.ts';

await wrapCliTask(async () => {
  await generateIndex(ObsidianDevUtilsRepoPaths.Src);
});

async function generateIndex(dir: string): Promise<void> {
  const dirents = await readdirPosix(dir, { withFileTypes: true });
  const lines = (await asyncMap(dirents, (dirent) => handleDirent(dir, dirent)))
    .filter((line) => line !== undefined);

  if (lines.length > 0) {
    await generate(join(dir, ObsidianDevUtilsRepoPaths.IndexTs), lines);
  }
}

async function handleDirent(dir: string, dirent: Dirent): Promise<string | undefined> {
  if (dirent.name === ObsidianDevUtilsRepoPaths.IndexTs as string) {
    return;
  }

  if (dirent.name.endsWith(ObsidianDevUtilsRepoPaths.DtsExtension)) {
    return;
  }

  if (dirent.name === ObsidianDevUtilsRepoPaths.Types as string || dir.split('/').includes(ObsidianDevUtilsRepoPaths.Types)) {
    return;
  }

  if (dirent.name === ObsidianDevUtilsRepoPaths.Styles as string) {
    return;
  }

  if (dirent.isFile() && !dirent.name.endsWith(ObsidianDevUtilsRepoPaths.TsExtension)) {
    return;
  }

  let sourceFile: string;
  let name: string;
  if (dirent.isDirectory()) {
    await generateIndex(join(dir, dirent.name));
    sourceFile = normalizeIfRelative(join(dirent.name, ObsidianDevUtilsRepoPaths.IndexTs));
    name = dirent.name;
  } else {
    const extension = extname(dirent.name);
    name = basename(dirent.name, extension);
    sourceFile = normalizeIfRelative(dirent.name);
  }

  return `export * as ${makeValidVariableName(name)} from '${sourceFile}';`;
}
