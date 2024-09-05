import {
  type BuildOptions,
  context } from 'esbuild';

import { wrapCliTask } from '../src/scripts/CliUtils.ts';
import { getDependenciesToSkip } from '../src/scripts/esbuild/Dependency.ts';
import {
  banner,
  invokeEsbuild
} from '../src/scripts/esbuild/ObsidianPluginBuilder.ts';
import { preprocessPlugin } from '../src/scripts/esbuild/preprocessPlugin.ts';
import { ObsidianDevUtilsRepoPaths } from '../src/scripts/ObsidianDevUtilsRepoPaths.ts';

await wrapCliTask(async () => {
  const dependenciesToSkip = await getDependenciesToSkip();

  const buildOptions: BuildOptions = {
    banner: {
      js: banner
    },
    bundle: true,
    entryPoints: [ObsidianDevUtilsRepoPaths.SrcDependenciesTs],
    external: Array.from(dependenciesToSkip),
    format: 'cjs',
    logLevel: 'info',
    outfile: ObsidianDevUtilsRepoPaths.DistLibDependenciesCjs,
    platform: 'node',
    plugins: [
      preprocessPlugin()
    ],
    sourcemap: 'inline',
    target: 'ESNext',
    treeShaking: true
  };

  const buildContext = await context(buildOptions);
  await invokeEsbuild(buildContext, true);
});
