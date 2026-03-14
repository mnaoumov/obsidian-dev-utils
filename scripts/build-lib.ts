import type { BuildOptions } from 'esbuild';

import { context } from 'esbuild';

import {
  join,
  normalizeIfRelative
} from '../src/path.ts';
import { changeExtensionPlugin } from '../src/script-utils/bundlers/esbuild-impl/changeExtensionPlugin.ts';
import { fixEsmPlugin } from '../src/script-utils/bundlers/esbuild-impl/fixEsmPlugin.ts';
import {
  banner,
  invokeEsbuild
} from '../src/script-utils/bundlers/esbuild-impl/obsidian-plugin-builder.ts';
import { preprocessPlugin } from '../src/script-utils/bundlers/esbuild-impl/preprocessPlugin.ts';
import { wrapCliTask } from '../src/script-utils/cli-utils.ts';
import { readdirPosix } from '../src/script-utils/fs.ts';
import { ObsidianDevUtilsRepoPaths } from '../src/script-utils/obsidian-dev-utils-repo-paths.ts';

await wrapCliTask(async () => {
  const libFiles = await getLibFiles();
  await build(libFiles, 'cjs');
  await build(libFiles, 'esm');
});

async function build(libFiles: string[], format: 'cjs' | 'esm'): Promise<void> {
  const extension = format === 'cjs' ? ObsidianDevUtilsRepoPaths.CjsExtension : ObsidianDevUtilsRepoPaths.MjsExtension;
  const buildOptions: BuildOptions = {
    banner: {
      js: banner
    },
    bundle: false,
    entryPoints: libFiles,
    format,
    logLevel: 'info',
    outdir: join(ObsidianDevUtilsRepoPaths.DistLib, format),
    platform: 'node',
    plugins: [
      preprocessPlugin(format === 'esm'),
      fixEsmPlugin(),
      changeExtensionPlugin(extension)
    ],
    sourcemap: 'inline',
    target: 'ESNext',
    treeShaking: true,
    write: false
  };

  const buildContext = await context(buildOptions);
  await invokeEsbuild(buildContext, true);
}

async function getLibFiles(): Promise<string[]> {
  let files = await readdirPosix(ObsidianDevUtilsRepoPaths.Src, { recursive: true });
  files = files.map((file) => normalizeIfRelative(join(ObsidianDevUtilsRepoPaths.Src, file)));
  files = files.filter((file) =>
    file.endsWith(ObsidianDevUtilsRepoPaths.TsExtension) && !file.endsWith(ObsidianDevUtilsRepoPaths.DtsExtension) && !file.endsWith('.test.ts')
    && !file.endsWith('/test-helpers.ts')
  );
  return files;
}
