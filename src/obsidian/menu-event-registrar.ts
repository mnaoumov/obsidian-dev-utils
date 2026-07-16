/**
 * @file
 *
 * Menu event registrar.
 */

import type {
  Editor,
  MarkdownFileInfo,
  Menu,
  TAbstractFile,
  WorkspaceLeaf
} from 'obsidian';

import type { DisposableEx } from '../disposable.ts';

/**
 * Handler for the editor context menu event.
 *
 * @param menu - The menu to add items to.
 * @param editor - The editor instance.
 * @param ctx - The markdown file context.
 */
export type EditorMenuEventHandler = (menu: Menu, editor: Editor, ctx: MarkdownFileInfo) => void;

/**
 * Handler for the single-file context menu event.
 *
 * @param menu - The menu to add items to.
 * @param abstractFile - The file or folder.
 * @param source - The source of the event.
 * @param leaf - The workspace leaf, if available.
 */
export type FileMenuEventHandler = (menu: Menu, abstractFile: TAbstractFile, source: string, leaf?: WorkspaceLeaf) => void;

/**
 * Handler for the multi-file context menu event.
 *
 * @param menu - The menu to add items to.
 * @param abstractFiles - The files or folders.
 * @param source - The source of the event.
 * @param leaf - The workspace leaf, if available.
 */
export type FilesMenuEventHandler = (menu: Menu, abstractFiles: TAbstractFile[], source: string, leaf?: WorkspaceLeaf) => void;

/**
 * Registers menu event handlers with lifecycle management.
 */
export interface MenuEventRegistrar {
  /**
   * Registers a handler for the editor context menu event.
   *
   * @param handler - The handler to register.
   * @returns A {@link DisposableEx} that unregisters the handler when disposed.
   */
  registerEditorMenuEventHandler(handler: EditorMenuEventHandler): DisposableEx;

  /**
   * Registers a handler for the single-file context menu event.
   *
   * @param handler - The handler to register.
   * @returns A {@link DisposableEx} that unregisters the handler when disposed.
   */
  registerFileMenuEventHandler(handler: FileMenuEventHandler): DisposableEx;

  /**
   * Registers a handler for the multi-file context menu event.
   *
   * @param handler - The handler to register.
   * @returns A {@link DisposableEx} that unregisters the handler when disposed.
   */
  registerFilesMenuEventHandler(handler: FilesMenuEventHandler): DisposableEx;
}
