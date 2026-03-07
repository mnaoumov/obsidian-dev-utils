/**
 * @packageDocumentation
 *
 * CLI command to lint the source code.
 */

import { CliCommand } from '../CliCommand.ts';
import { lint } from '../ESLint/ESLint.ts';

/**
 * Lints the source code.
 */
export class LintCommand extends CliCommand {
  /**
   *
   */
  public readonly description = 'Lint the source code';
  /**
   *
   */
  public readonly name = 'lint';

  /**
   * Executes the lint command.
   *
   * @returns A {@link Promise} that resolves when linting is complete.
   */
  public execute(): Promise<void> {
    return lint();
  }
}
