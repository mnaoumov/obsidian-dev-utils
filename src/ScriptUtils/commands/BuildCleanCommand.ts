/**
 * @packageDocumentation
 *
 * CLI command to clean the dist folder.
 */

import { buildClean } from '../build.ts';
import { CliCommand } from '../CliCommand.ts';

/**
 * Cleans the dist folder.
 */
export class BuildCleanCommand extends CliCommand {
  /**
   *
   */
  public readonly description = 'Clean the dist folder';
  /**
   *
   */
  public readonly name = 'build:clean';

  /**
   * Executes the build clean command.
   *
   * @returns A {@link Promise} that resolves when the dist folder has been removed.
   */
  public execute(): Promise<void> {
    return buildClean();
  }
}
