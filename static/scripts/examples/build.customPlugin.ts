import type {
  OnLoadResult,
  Plugin
} from 'esbuild';
import type { CliTaskResult } from 'obsidian-dev-utils/ScriptUtils/CliUtils';
import {
  BuildMode,
  buildObsidianPlugin
} from 'obsidian-dev-utils/ScriptUtils/esbuild/ObsidianPluginBuilder';
import { readFile } from 'obsidian-dev-utils/ScriptUtils/NodeModules';

export async function invoke(): Promise<CliTaskResult> {
  return await buildWithCustomPlugin();
}

export async function buildWithCustomPlugin(): Promise<CliTaskResult> {
  return await buildObsidianPlugin({
    mode: BuildMode.Production,
    customEsbuildPlugins: [
      customPlugin()
    ]
  });
}

function customPlugin(): Plugin {
  return {
    name: 'custom-plugin',
    setup(build): void {
      build.onLoad({ filter: /\.png$/ }, async (args): Promise<OnLoadResult> => {
        const contents = await readFile(args.path);
        return {
          loader: 'dataurl',
          contents
        };
      });
    }
  };
}
