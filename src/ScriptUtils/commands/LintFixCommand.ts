/**
 * @packageDocumentation
 *
 * CLI command to lint the source code and apply automatic fixes.
 */

import { CliCommand } from '../CliCommand.ts';
import { lint } from '../ESLint/ESLint.ts';

/**
 * Lints the source code and applies automatic fixes.
 */
export class LintFixCommand extends CliCommand {
  /**
   *
   */
  public readonly description = 'Lint the source code and apply automatic fixes';
  /**
   *
   */
  public readonly name = 'lint:fix';

  /**
   * Executes the lint fix command.
   *
   * @returns A {@link Promise} that resolves when linting and fixing is complete.
   */
  public execute(): Promise<void> {
    return lint(true);
  }
}
