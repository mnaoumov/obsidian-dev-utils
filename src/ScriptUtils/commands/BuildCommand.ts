/**
 * @packageDocumentation
 *
 * CLI command to build the plugin.
 */

import type { CliTaskResult } from '../CliUtils.ts';

import { CliCommand } from '../CliCommand.ts';
import {
  BuildMode,
  buildObsidianPlugin
} from '../esbuild/ObsidianPluginBuilder.ts';

/**
 * Builds the plugin in production mode.
 */
export class BuildCommand extends CliCommand {
  /**
   *
   */
  public readonly description = 'Build the plugin';
  /**
   *
   */
  public readonly name = 'build';

  /**
   * Executes the build command.
   *
   * @returns A {@link Promise} that resolves to a {@link CliTaskResult}.
   */
  public execute(): Promise<CliTaskResult> {
    return buildObsidianPlugin({ mode: BuildMode.Production });
  }
}
