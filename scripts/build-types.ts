import {
  dirname,
  join
} from '../src/Path.ts';
import { wrapCliTask } from '../src/ScriptUtils/CliUtils.ts';
import { readdirPosix } from '../src/ScriptUtils/Fs.ts';
import {
  mkdir,
  readFile,
  writeFile
} from '../src/ScriptUtils/NodeModules.ts';
import { ObsidianDevUtilsRepoPaths } from '../src/ScriptUtils/ObsidianDevUtilsRepoPaths.ts';
import { execFromRoot } from '../src/ScriptUtils/Root.ts';
import {
  replaceAll,
  trimEnd
} from '../src/String.ts';

await wrapCliTask(async () => {
  await execFromRoot('tsc --project ./tsconfig.types.json');

  for (const file of await readdirPosix(ObsidianDevUtilsRepoPaths.Src, { recursive: true })) {
    if (!file.endsWith(ObsidianDevUtilsRepoPaths.DtsExtension)) {
      continue;
    }

    const fullSourcePath = join(ObsidianDevUtilsRepoPaths.Src, file);
    const content = await readFile(fullSourcePath, 'utf-8');

    const fullTargetBasePath = join(ObsidianDevUtilsRepoPaths.DistLib, trimEnd(file, ObsidianDevUtilsRepoPaths.DtsExtension));
    const parentDir = dirname(fullTargetBasePath);
    await mkdir(parentDir, { recursive: true });
    await writeFile(fullTargetBasePath + ObsidianDevUtilsRepoPaths.DctsExtension, replaceAll(content, '.ts\'', '.cjs\''));
    await writeFile(fullTargetBasePath + ObsidianDevUtilsRepoPaths.DmtsExtension, replaceAll(content, '.ts\'', '.mjs\''));
  }
});
