/**
 * @packageDocumentation
 *
 * CLI command to run tests.
 */

import { CliCommand } from '../CliCommand.ts';
import { test } from '../test.ts';

/**
 * Runs the test suite.
 */
export class TestCommand extends CliCommand {
  /**
   *
   */
  public readonly description = 'Run tests';
  /**
   *
   */
  public readonly name = 'test';

  /**
   * Executes the test command.
   *
   * @returns A {@link Promise} that resolves when the tests have completed.
   */
  public execute(): Promise<void> {
    return test();
  }
}
