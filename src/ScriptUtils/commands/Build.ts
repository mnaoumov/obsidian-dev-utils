/**
 * @packageDocumentation
 *
 * Build the plugin in production mode.
 */

import type { CliTaskResult } from '../CliUtils.ts';

import {
  BuildMode,
  buildObsidianPlugin
} from '../esbuild/ObsidianPluginBuilder.ts';

/**
 * Builds the plugin in production mode.
 *
 * @returns A {@link Promise} that resolves to a {@link CliTaskResult}.
 */
export async function build(): Promise<CliTaskResult> {
  return buildObsidianPlugin({ mode: BuildMode.Production });
}
