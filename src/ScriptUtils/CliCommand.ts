/**
 * @packageDocumentation
 *
 * Abstract base class for CLI commands.
 */

import type { Promisable } from 'type-fest';

import type { MaybeReturn } from '../Type.ts';
import type { CliTaskResult } from './CliUtils.ts';

/**
 * Represents a CLI command argument definition.
 */
export interface CliCommandArgument {
  /**
   * A description of the argument.
   */
  description: string;

  /**
   * A name of the argument.
   */
  name: string;
}

/**
 * Abstract base class for CLI commands. Each command encapsulates its own
 * name, description, optional arguments, and execution logic.
 */
export abstract class CliCommand {
  /**
   * The arguments for the command.
   */
  public readonly arguments: CliCommandArgument[] = [];

  /**
   * A description of the command.
   */
  public abstract readonly description: string;

  /**
   * The name of the command.
   */
  public abstract readonly name: string;

  /**
   * Executes the command.
   *
   * @param args - The arguments passed to the command.
   * @returns A {@link Promisable} that resolves to a {@link CliTaskResult} or `void`.
   */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- Commander passes `any` typed arguments.
  public abstract execute(...args: any[]): Promisable<MaybeReturn<CliTaskResult>>;
}
