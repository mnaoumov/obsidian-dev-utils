import type { BuildOptions } from 'esbuild';

import { context } from 'esbuild';

import {
  join,
  normalizeIfRelative
} from '../src/Path.ts';
import { wrapCliTask } from '../src/scripts/CliUtils.ts';
import {
  banner,
  invokeEsbuild
} from '../src/scripts/esbuild/ObsidianPluginBuilder.ts';
import { preprocessPlugin } from '../src/scripts/esbuild/preprocessPlugin.ts';
import { renameToCjsPlugin } from '../src/scripts/esbuild/renameToCjsPlugin.ts';
import { readdirPosix } from '../src/scripts/Fs.ts';
import { ObsidianDevUtilsRepoPaths } from '../src/scripts/ObsidianDevUtilsRepoPaths.ts';

await wrapCliTask(async () => {
  const buildOptions: BuildOptions = {
    banner: {
      js: banner
    },
    bundle: false,
    entryPoints: await getLibFiles(),
    format: 'cjs',
    logLevel: 'info',
    outdir: ObsidianDevUtilsRepoPaths.DistLib,
    platform: 'node',
    plugins: [
      preprocessPlugin(),
      renameToCjsPlugin()
    ],
    sourcemap: 'inline',
    target: 'ESNext',
    treeShaking: true,
    write: false
  };

  const buildContext = await context(buildOptions);
  await invokeEsbuild(buildContext, true);
});

async function getLibFiles(): Promise<string[]> {
  let files = await readdirPosix(ObsidianDevUtilsRepoPaths.Src, { recursive: true });
  files = files.map((file) => normalizeIfRelative(join(ObsidianDevUtilsRepoPaths.Src, file)));
  files = files.filter((file) => file.endsWith('.ts') && !file.endsWith('.d.ts'));
  files = files.filter((file) => file !== ObsidianDevUtilsRepoPaths.SrcDependenciesTs as string);
  return files;
}
