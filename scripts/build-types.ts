import {
  basename,
  dirname,
  join,
  relative
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
import { replaceAll } from '../src/String.ts';

await wrapCliTask(async () => {
  await execFromRoot('tsc --project ./tsconfig.types.json');

  for (const file of await readdirPosix(ObsidianDevUtilsRepoPaths.Src, { recursive: true })) {
    if (!file.endsWith(ObsidianDevUtilsRepoPaths.DtsExtension)) {
      continue;
    }

    const dir = dirname(file);
    const name = basename(file, ObsidianDevUtilsRepoPaths.DtsExtension);
    const fullSourcePath = join(ObsidianDevUtilsRepoPaths.Src, file);
    const content = await readFile(fullSourcePath, 'utf-8');

    const ctsPath = join(ObsidianDevUtilsRepoPaths.DistLib, ObsidianDevUtilsRepoPaths.Cjs, dir, name + ObsidianDevUtilsRepoPaths.DctsExtension);
    const mtsPath = join(ObsidianDevUtilsRepoPaths.DistLib, ObsidianDevUtilsRepoPaths.Esm, dir, name + ObsidianDevUtilsRepoPaths.DmtsExtension);

    await mkdir(dirname(ctsPath), { recursive: true });
    await mkdir(dirname(mtsPath), { recursive: true });
    await writeFile(ctsPath, replaceAll(content, '.ts\'', '.cts\''));
    const relativeCjsPath = join(relative(dirname(mtsPath), dirname(mtsPath)), name + ObsidianDevUtilsRepoPaths.CjsExtension);
    await writeFile(mtsPath, `export * from '${relativeCjsPath}';\n`);
  }
});
