/**
 * @packageDocumentation
 *
 * CLI command to check if Svelte code compiles.
 */

import { buildCompileSvelte } from '../build.ts';
import { CliCommand } from '../CliCommand.ts';

/**
 * Checks if the Svelte code compiles.
 */
export class BuildCompileSvelteCommand extends CliCommand {
  /**
   *
   */
  public readonly description = 'Check if Svelte code compiles';
  /**
   *
   */
  public readonly name = 'build:compile:svelte';

  /**
   * Executes the Svelte compile check command.
   *
   * @returns A {@link Promise} that resolves when the compilation check is complete.
   */
  public execute(): Promise<void> {
    return buildCompileSvelte();
  }
}
