/**
 * @packageDocumentation
 *
 * Build the plugin in development mode.
 */

import type { CliTaskResult } from '../CliUtils.ts';

import {
  BuildMode,
  buildObsidianPlugin
} from '../esbuild/ObsidianPluginBuilder.ts';

/**
 * Builds the plugin in development mode.
 *
 * @returns A {@link Promise} that resolves to a {@link CliTaskResult}.
 */
export async function dev(): Promise<CliTaskResult> {
  return buildObsidianPlugin({ mode: BuildMode.Development });
}
