/**
 * @file
 *
 * Component that provides an AbortSignal for cancelling long-running operations on plugin unload.
 */

import { Component } from 'obsidian';

import { SilentError } from '../../../error.ts';

/**
 * Provides an {@link AbortSignal} that is aborted when the component is unloaded.
 */
export class AbortSignalComponent extends Component {
  /**
   * The abort signal.
   */
  public readonly abortSignal: AbortSignal;

  private readonly abortController: AbortController;

  /**
   * Creates a new abort signal component.
   *
   * @param pluginId - The plugin ID (used in the abort reason message).
   */
  public constructor(private readonly pluginId: string) {
    super();
    this.abortController = new AbortController();
    this.abortSignal = this.abortController.signal;
  }

  /**
   * Aborts the signal on unload.
   */
  public override onunload(): void {
    this.abortController.abort(new SilentError(`Plugin ${this.pluginId} had been unloaded`));
  }
}
