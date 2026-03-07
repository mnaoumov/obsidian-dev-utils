/**
 * @packageDocumentation
 *
 * CLI command to format the source code.
 */

import { CliCommand } from '../CliCommand.ts';
import { format } from '../format.ts';

/**
 * Formats the source code.
 */
export class FormatCommand extends CliCommand {
  /**
   *
   */
  public readonly description = 'Format the source code';
  /**
   *
   */
  public readonly name = 'format';

  /**
   * Executes the format command.
   *
   * @returns A {@link Promise} that resolves when formatting is complete.
   */
  public execute(): Promise<void> {
    return format();
  }
}
