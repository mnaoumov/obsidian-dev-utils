/**
 * @packageDocumentation
 *
 * CLI command to lint the markdown documentation.
 */

import { CliCommand } from '../CliCommand.ts';
import { lintMarkdown } from '../markdownlint/markdownlint.ts';

/**
 * Lints the markdown documentation.
 */
export class LintMarkdownCommand extends CliCommand {
  /**
   *
   */
  public readonly description = 'Lint the markdown documentation';
  /**
   *
   */
  public readonly name = 'lint:md';

  /**
   * Executes the markdown lint command.
   *
   * @returns A {@link Promise} that resolves when linting is complete.
   */
  public execute(): Promise<void> {
    return lintMarkdown();
  }
}
