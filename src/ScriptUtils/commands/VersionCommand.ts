/**
 * @packageDocumentation
 *
 * CLI command to release a new version.
 */

import { CliCommand } from '../CliCommand.ts';
import { updateVersion } from '../version.ts';

/**
 * Releases a new version.
 */
export class VersionCommand extends CliCommand {
  /**
   *
   */
  public override readonly arguments = [{ description: 'Version update type: major, minor, patch, beta, or x.y.z[-suffix]', name: '[versionUpdateType]' }];
  /**
   *
   */
  public readonly description = 'Release a new version';
  /**
   *
   */
  public readonly name = 'version';

  /**
   * Executes the version command.
   *
   * @param versionUpdateType - The type of version update to perform.
   * @returns A {@link Promise} that resolves when the version update is complete.
   */
  public execute(versionUpdateType: string): Promise<void> {
    return updateVersion(versionUpdateType);
  }
}
