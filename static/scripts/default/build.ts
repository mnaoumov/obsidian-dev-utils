import type { CliTaskResult } from 'obsidian-dev-utils/script-utils/cli-utils';
import {
  BuildMode,
  buildObsidianPlugin
} from 'obsidian-dev-utils/script-utils/bundlers/esbuild/obsidian-plugin-builder';

export async function invoke(): Promise<CliTaskResult> {
  return await buildObsidianPlugin({ mode: BuildMode.Production });
}
