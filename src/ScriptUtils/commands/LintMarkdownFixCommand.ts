/**
 * @packageDocumentation
 *
 * CLI command to lint the markdown documentation and apply automatic fixes.
 */

import { CliCommand } from '../CliCommand.ts';
import { lintMarkdown } from '../markdownlint/markdownlint.ts';

/**
 * Lints the markdown documentation and applies automatic fixes.
 */
export class LintMarkdownFixCommand extends CliCommand {
  /**
   *
   */
  public readonly description = 'Lint the markdown documentation and apply automatic fixes';
  /**
   *
   */
  public readonly name = 'lint:md:fix';

  /**
   * Executes the markdown lint fix command.
   *
   * @returns A {@link Promise} that resolves when linting and fixing is complete.
   */
  public execute(): Promise<void> {
    return lintMarkdown(true);
  }
}
