/**
 * @packageDocumentation
 *
 * CLI command to build the plugin in development mode.
 */

import type { CliTaskResult } from '../CliUtils.ts';

import { CliCommand } from '../CliCommand.ts';
import {
  BuildMode,
  buildObsidianPlugin
} from '../esbuild/ObsidianPluginBuilder.ts';

/**
 * Builds the plugin in development mode.
 */
export class DevCommand extends CliCommand {
  /**
   *
   */
  public readonly description = 'Build the plugin in development mode';
  /**
   *
   */
  public readonly name = 'dev';

  /**
   * Executes the dev command.
   *
   * @returns A {@link Promise} that resolves to a {@link CliTaskResult}.
   */
  public execute(): Promise<CliTaskResult> {
    return buildObsidianPlugin({ mode: BuildMode.Development });
  }
}
