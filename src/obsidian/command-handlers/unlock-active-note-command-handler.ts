/**
 * @file
 *
 * Handles the "Unlock active note" command.
 */

import type { App } from 'obsidian';

import type { ResourceLockComponent } from '../resource-lock.ts';

import { GlobalCommandHandler } from './global-command-handler.ts';

/**
 * Constructor parameters for {@link UnlockActiveNoteCommandHandler}.
 */
export interface UnlockActiveNoteCommandHandlerConstructorParams {
  /**
   * The Obsidian app instance.
   */
  readonly app: App;

  /**
   * The resource-lock component whose lock covering the active note the command releases.
   */
  readonly resourceLockComponent: ResourceLockComponent;
}

/**
 * A command handler that unlocks the active note. It cancels the operation that took the lock and
 * releases the lock covering the note — whether the note is locked directly or by a `subtree`-locked
 * ancestor folder. Only available while the active note is locked.
 */
export class UnlockActiveNoteCommandHandler extends GlobalCommandHandler {
  /**
   * The Obsidian app instance.
   */
  protected readonly app: App;

  /**
   * The resource-lock component whose lock covering the active note the command releases.
   */
  protected readonly resourceLockComponent: ResourceLockComponent;

  /**
   * Constructs a new instance.
   *
   * @param params - Constructor parameters.
   */
  public constructor(params: UnlockActiveNoteCommandHandlerConstructorParams) {
    super({
      icon: 'unlock',
      id: 'unlock-active-note',
      name: 'Unlock active note'
    });

    this.app = params.app;
    this.resourceLockComponent = params.resourceLockComponent;
  }

  /**
   * Executes the command, unlocking the active note.
   */
  public override execute(): void {
    const activeFile = this.app.workspace.getActiveFile();
    if (!activeFile) {
      return;
    }
    this.resourceLockComponent.requestUnlockForPath(activeFile);
  }

  /**
   * Checks whether the command can currently execute: only when there is an active note covered by a
   * lock (directly or by a `subtree`-locked ancestor folder).
   *
   * @returns Whether the active note is locked.
   */
  protected override canExecute(): boolean {
    const activeFile = this.app.workspace.getActiveFile();
    if (!activeFile) {
      return false;
    }
    return this.resourceLockComponent.isLockedByAncestorForPath(activeFile);
  }
}
