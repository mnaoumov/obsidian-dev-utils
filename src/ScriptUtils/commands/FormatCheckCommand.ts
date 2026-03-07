/**
 * @packageDocumentation
 *
 * CLI command to check if the source code is formatted.
 */

import { CliCommand } from '../CliCommand.ts';
import { format } from '../format.ts';

/**
 * Checks if the source code is formatted.
 */
export class FormatCheckCommand extends CliCommand {
  /**
   *
   */
  public readonly description = 'Check if the source code is formatted';
  /**
   *
   */
  public readonly name = 'format:check';

  /**
   * Executes the format check command.
   *
   * @returns A {@link Promise} that resolves when the check is complete.
   */
  public execute(): Promise<void> {
    return format(false);
  }
}
