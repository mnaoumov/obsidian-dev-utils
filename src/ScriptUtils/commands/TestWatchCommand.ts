/**
 * @packageDocumentation
 *
 * CLI command to run tests in watch mode.
 */

import { CliCommand } from '../CliCommand.ts';
import { testWatch } from '../test.ts';

/**
 * Runs the test suite in watch mode.
 */
export class TestWatchCommand extends CliCommand {
  /**
   *
   */
  public readonly description = 'Run tests in watch mode';
  /**
   *
   */
  public readonly name = 'test:watch';

  /**
   * Executes the test watch command.
   *
   * @returns A {@link Promise} that resolves when the tests have completed.
   */
  public execute(): Promise<void> {
    return testWatch();
  }
}
