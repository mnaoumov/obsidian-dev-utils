import type { CliTaskResult } from 'obsidian-dev-utils/ScriptUtils/CliUtils';
import {
  BuildMode,
  buildObsidianPlugin
} from 'obsidian-dev-utils/ScriptUtils/esbuild/ObsidianPluginBuilder';

export async function invoke(): Promise<CliTaskResult> {
  return await buildWithSvelteConditions();
}

export async function buildWithSvelteConditions(): Promise<CliTaskResult> {
  return await buildObsidianPlugin({
    mode: BuildMode.Production,
    customEsbuildOptions: {
      conditions: ['svelte']
    }
  });
}
