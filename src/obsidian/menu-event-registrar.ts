/**
 * @file
 *
 * Menu event registrar.
 */

import type {
  Editor,
  MarkdownFileInfo,
  MarkdownView,
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
export type EditorMenuEventHandler = (menu: Menu, editor: Editor, context: MarkdownFileInfo) => void;

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
 * Handler for the markdown viewport (margin) context menu event.
 *
 * This is the menu raised by right-clicking the empty space BESIDE the text — the one carrying
 * `Readable line length` / `Line numbers` / `Inline title` — or the line-number gutter. It is a different
 * menu from the editor one: with `Readable line length` on, the text is centred inside a narrower
 * `.cm-sizer`, so a margin click lands outside the editor's `contentDOM` and `editor-menu` never fires.
 *
 * @param menu - The menu to add items to.
 * @param view - The markdown view the menu was raised over.
 * @param mode - The view mode (`'source'` or `'preview'`).
 * @param source - What raised the menu. Obsidian 1.13.7 passes the literal `'gutter'` from BOTH of its
 *                 trigger sites, for a margin click as well as a line-number-gutter one, so it does not
 *                 currently distinguish the two. It is forwarded rather than dropped because it is part
 *                 of the event's shape and may start carrying more than one value.
 */
export type MarkdownViewportMenuEventHandler = (menu: Menu, view: MarkdownView, mode: string, source: string) => void;

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

  /**
   * Registers a handler for the markdown viewport (margin) context menu event.
   *
   * @param handler - The handler to register.
   * @returns A {@link DisposableEx} that unregisters the handler when disposed.
   */
  registerMarkdownViewportMenuEventHandler(handler: MarkdownViewportMenuEventHandler): DisposableEx;
}
