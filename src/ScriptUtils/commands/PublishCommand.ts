/**
 * @packageDocumentation
 *
 * CLI command to publish to NPM.
 */

import { CliCommand } from '../CliCommand.ts';
import { publish } from '../NpmPublish.ts';

/**
 * Publishes the package to NPM.
 */
export class PublishCommand extends CliCommand {
  /**
   *
   */
  public override readonly arguments = [{ description: 'Publish to NPM beta', name: '[isBeta]' }];
  /**
   *
   */
  public readonly description = 'Publish to NPM';
  /**
   *
   */
  public readonly name = 'publish';

  /**
   * Executes the publish command.
   *
   * @param isBeta - Whether to publish as a beta release.
   * @returns A {@link Promise} that resolves when publishing is complete.
   */
  public execute(isBeta: boolean): Promise<void> {
    return publish(isBeta);
  }
}
