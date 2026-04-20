/**
 * @file
 *
 * Component that provides namespaced console debug logging.
 */

import { Component } from 'obsidian';

import { getDebugger } from '../../../debug.ts';

/**
 * Provides a namespaced `consoleDebug()` method for logging.
 *
 * Messages are not shown by default — enable the plugin's debugger namespace to see them.
 *
 * @see {@link https://github.com/mnaoumov/obsidian-dev-utils/blob/main/docs/debugging.md} for more information.
 */
export class ConsoleDebugComponent extends Component {
  /**
   * The singleton key for the {@link ConsoleDebugComponent} class.
   */
  public static readonly COMPONENT_KEY = Symbol(ConsoleDebugComponent.name);

  /**
   * Creates a new console debug component.
   *
   * @param pluginId - The plugin ID (used as the debugger namespace).
   */
  public constructor(private readonly pluginId: string) {
    super();
  }

  /**
   * Logs a message to the console under the plugin's debugger namespace.
   *
   * @param message - The message to log.
   * @param args - Additional arguments to log.
   */
  public debug(message: string, ...args: unknown[]): void {
    // Skip the `debug()` call itself
    const FRAMES_TO_SKIP = 1;
    const pluginDebugger = getDebugger(this.pluginId, FRAMES_TO_SKIP);
    pluginDebugger(message, ...args);
  }
}
