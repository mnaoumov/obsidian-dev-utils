/**
 * @file
 *
 * This module provides utilities for working with Obsidian's core file explorer.
 */

import type {
  App,
  TAbstractFile
} from 'obsidian';

import { InternalPluginName } from '@obsidian-typings/obsidian-public-latest/implementations';

import { requestAnimationFrameAsync } from '../async.ts';

/**
 * How many animation frames the explorer keeps re-activating itself for after its reveal settles.
 *
 * `revealInFolder` awaits `revealLeaf`, which activates the explorer, and then activates it AGAIN inside
 * `app.nextFrame`. Waiting one frame is not enough to land after that: a caller focusing an editor on the
 * first frame lost the focus back to the explorer on every real mouse click (measured in Obsidian 1.13.x).
 */
const FRAMES_TO_OUTLAST_THE_EXPLORER_ACTIVATION = 2;

/**
 * Parameters for {@link revealInFileExplorer}.
 */
export interface RevealInFileExplorerParams {
  /**
   * The file or folder to reveal.
   */
  readonly abstractFile: TAbstractFile;

  /**
   * The Obsidian app instance.
   */
  readonly app: App;
}

/**
 * Highlights a file or folder in the core file explorer, and resolves only once the explorer has
 * finished taking the focus for it.
 *
 * The core plugin's `revealInFolder` is typed `void` but is asynchronous at runtime, and the explorer
 * re-activates itself on a later frame. A caller that moves the focus somewhere else right after the
 * reveal — back into an editor, say — loses that race unless it awaits this.
 *
 * A disabled file explorer reveals nothing, and the returned promise resolves at once.
 *
 * @param params - The parameters.
 * @returns A {@link Promise} that resolves once the explorer has finished revealing.
 */
export async function revealInFileExplorer(params: RevealInFileExplorerParams): Promise<void> {
  const { abstractFile, app } = params;
  const fileExplorer = app.internalPlugins.getEnabledPluginById(InternalPluginName.FileExplorer);
  if (!fileExplorer) {
    return;
  }

  // Typed `void`, returns a promise at runtime.
  const revealInFolder: (file: TAbstractFile) => unknown = fileExplorer.revealInFolder.bind(fileExplorer);
  await revealInFolder(abstractFile);

  for (let frame = 0; frame < FRAMES_TO_OUTLAST_THE_EXPLORER_ACTIVATION; frame++) {
    await requestAnimationFrameAsync();
  }
}
