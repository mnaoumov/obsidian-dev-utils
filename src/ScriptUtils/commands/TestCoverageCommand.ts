/**
 * @packageDocumentation
 *
 * CLI command to run tests with coverage.
 */

import { CliCommand } from '../CliCommand.ts';
import { testCoverage } from '../test.ts';

/**
 * Runs the test suite with coverage.
 */
export class TestCoverageCommand extends CliCommand {
  /**
   *
   */
  public readonly description = 'Run tests with coverage';
  /**
   *
   */
  public readonly name = 'test:coverage';

  /**
   * Executes the test coverage command.
   *
   * @returns A {@link Promise} that resolves when the tests have completed.
   */
  public execute(): Promise<void> {
    return testCoverage();
  }
}
