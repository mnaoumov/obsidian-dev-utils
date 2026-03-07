/**
 * @packageDocumentation
 *
 * CLI command to spellcheck the source code.
 */

import { CliCommand } from '../CliCommand.ts';
import { spellcheck } from '../spellcheck.ts';

/**
 * Spellchecks the source code.
 */
export class SpellcheckCommand extends CliCommand {
  /**
   *
   */
  public readonly description = 'Spellcheck the source code';
  /**
   *
   */
  public readonly name = 'spellcheck';

  /**
   * Executes the spellcheck command.
   *
   * @returns A {@link Promise} that resolves when spellchecking is complete.
   */
  public execute(): Promise<void> {
    return spellcheck();
  }
}
