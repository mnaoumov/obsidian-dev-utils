import type { BuildOptions } from 'esbuild';

import {
  banner,
  invokeEsbuild
} from '@mnaoumov/obsidian-dev-toolkit/bundlers/esbuild-impl/obsidian-plugin-builder';
import { preprocessPlugin } from '@mnaoumov/obsidian-dev-toolkit/bundlers/esbuild-impl/preprocess-plugin';
import { changeExtensionPlugin } from '@mnaoumov/typescript-dev-toolkit/bundlers/esbuild-impl/change-extension-plugin';
import { fixEsmPlugin } from '@mnaoumov/typescript-dev-toolkit/bundlers/esbuild-impl/fix-esm-plugin';
import { wrapCliTask } from '@mnaoumov/typescript-dev-toolkit/cli-utils';
import { readdirPosix } from '@mnaoumov/typescript-dev-toolkit/fs';
import { RepoPaths } from '@mnaoumov/typescript-dev-toolkit/repo-paths';
import {
  join,
  normalizeIfRelative
} from '@mnaoumov/typescript-lib/path';
import { context } from 'esbuild';

await wrapCliTask(async () => {
  const libFiles = await getLibFiles();
  await build(libFiles, 'cjs');
  await build(libFiles, 'esm');
});

async function build(libFiles: string[], format: 'cjs' | 'esm'): Promise<void> {
  const extension = format === 'cjs' ? RepoPaths.CjsExtension : RepoPaths.MjsExtension;
  const buildOptions: BuildOptions = {
    banner: {
      js: banner
    },
    bundle: false,
    entryPoints: libFiles,
    format,
    logLevel: 'info',
    outdir: join(RepoPaths.DistLib, format),
    platform: 'node',
    plugins: [
      preprocessPlugin(format === 'esm'),
      fixEsmPlugin(),
      changeExtensionPlugin(extension)
    ],
    sourcemap: 'inline',
    target: 'ES2022',
    treeShaking: true,
    write: false
  };

  const buildContext = await context(buildOptions);
  await invokeEsbuild(buildContext, true);
}

async function getLibFiles(): Promise<string[]> {
  let files = await readdirPosix(RepoPaths.Src, { recursive: true });
  files = files.map((file) => normalizeIfRelative(join(RepoPaths.Src, file)));
  files = files.filter((file) =>
    file.endsWith(RepoPaths.TsExtension) && !file.endsWith(RepoPaths.DtsExtension) && !file.endsWith('.test.ts')
    && !file.includes(`/${RepoPaths.TestHelpers}/`)
  );
  return files;
}
