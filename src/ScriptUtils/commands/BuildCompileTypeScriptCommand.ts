/**
 * @packageDocumentation
 *
 * CLI command to check if TypeScript code compiles.
 */

import { buildCompileTypeScript } from '../build.ts';
import { CliCommand } from '../CliCommand.ts';

/**
 * Checks if the TypeScript code compiles.
 */
export class BuildCompileTypeScriptCommand extends CliCommand {
  /**
   *
   */
  public readonly description = 'Check if TypeScript code compiles';
  /**
   *
   */
  public readonly name = 'build:compile:typescript';

  /**
   * Executes the TypeScript compile check command.
   *
   * @returns A {@link Promise} that resolves when the compilation check is complete.
   */
  public execute(): Promise<void> {
    return buildCompileTypeScript();
  }
}
