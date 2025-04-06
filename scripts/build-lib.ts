/**
 * @packageDocumentation
 *
 * Build lib script.
 */

import type { BuildOptions } from 'esbuild';

import { context } from 'esbuild';

import {
  join,
  normalizeIfRelative
} from '../src/Path.ts';
import { wrapCliTask } from '../src/ScriptUtils/CliUtils.ts';
import { changeExtensionPlugin } from '../src/ScriptUtils/esbuild/changeExtensionPlugin.ts';
import { fixEsmPlugin } from '../src/ScriptUtils/esbuild/fixEsmPlugin.ts';
import {
  banner,
  invokeEsbuild
} from '../src/ScriptUtils/esbuild/ObsidianPluginBuilder.ts';
import { preprocessPlugin } from '../src/ScriptUtils/esbuild/preprocessPlugin.ts';
import { readdirPosix } from '../src/ScriptUtils/Fs.ts';
import { ObsidianDevUtilsRepoPaths } from '../src/ScriptUtils/ObsidianDevUtilsRepoPaths.ts';

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
  files = files.filter((file) => file.endsWith(ObsidianDevUtilsRepoPaths.TsExtension) && !file.endsWith(ObsidianDevUtilsRepoPaths.DtsExtension));
  return files;
}
