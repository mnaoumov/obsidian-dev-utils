import {
  BuildMode,
  buildObsidianPlugin
} from 'obsidian-dev-utils/script-utils/bundlers/esbuild/obsidian-plugin-builder';
import type { CliTaskResult } from 'obsidian-dev-utils/script-utils/cli-utils';

export async function invoke(): Promise<CliTaskResult> {
  console.log('Building plugin in development mode...');
  return await buildObsidianPlugin({ mode: BuildMode.Development });
}
