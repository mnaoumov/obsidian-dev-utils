/**
 * @packageDocumentation
 *
 * CLI command to copy static content to dist.
 */

import { buildStatic } from '../build.ts';
import { CliCommand } from '../CliCommand.ts';

/**
 * Copies static content to the dist folder.
 */
export class BuildStaticCommand extends CliCommand {
  /**
   *
   */
  public readonly description = 'Copy static content to dist';
  /**
   *
   */
  public readonly name = 'build:static';

  /**
   * Executes the build static command.
   *
   * @returns A {@link Promise} that resolves when the static files have been copied.
   */
  public execute(): Promise<void> {
    return buildStatic();
  }
}
