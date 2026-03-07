/**
 * @packageDocumentation
 *
 * CLI command to check if code compiles.
 */

import { buildCompile } from '../build.ts';
import { CliCommand } from '../CliCommand.ts';

/**
 * Checks if the code compiles.
 */
export class BuildCompileCommand extends CliCommand {
  /**
   *
   */
  public readonly description = 'Check if code compiles';
  /**
   *
   */
  public readonly name = 'build:compile';

  /**
   * Executes the build compile command.
   *
   * @returns A {@link Promise} that resolves when the compilation check is complete.
   */
  public execute(): Promise<void> {
    return buildCompile();
  }
}
