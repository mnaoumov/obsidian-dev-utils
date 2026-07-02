/**
 * @file
 *
 * This module provides utility functions for working with markdown editors in Obsidian
 */

import type {
  App,
  Editor
} from 'obsidian';

import {
  Compartment,
  EditorState,
  StateEffect
} from '@codemirror/state';
import { ViewType } from '@obsidian-typings/obsidian-public-latest/implementations';
import { MarkdownView } from 'obsidian';

import type { PathOrFile } from './file-system.ts';

import { castTo } from '../object-utils.ts';
import { getPath } from './file-system.ts';

const compartmentByCodeMirror = new WeakMap<Editor['cm'], Compartment>();

/**
 * Overwrites the buffer of every open {@link MarkdownView} currently showing the given path so that
 * it reflects `content`, in any window or popout.
 *
 * This is the fix for a subtle data-loss window: when a note is open in an editor with a **dirty
 * buffer** (a pending, not-yet-saved edit) and its file content is rewritten on disk out from under
 * the editor, the editor's next autosave re-writes its stale buffer and clobbers the on-disk content.
 * A caller that restores a file's content on disk (e.g. rolling back a transaction) must also reset
 * the open editor's buffer to the same content, so its next save is a no-op instead of a clobber.
 *
 * Only the view whose {@link MarkdownView.file} still matches `pathOrFile` is touched — if the editor
 * has since navigated to another note, it is left alone. The buffer is replaced only when it actually
 * differs from `content`, so a clean editor already in sync is not disturbed (no cursor reset).
 *
 * @param app - The Obsidian app instance.
 * @param pathOrFile - The path or file whose open editors should be synchronized.
 * @param content - The content to overwrite each matching editor's buffer with.
 */
export function syncOpenEditorBuffersForPath(app: App, pathOrFile: PathOrFile, content: string): void {
  const path = getPath(app, pathOrFile);
  for (const leaf of app.workspace.getLeavesOfType(ViewType.Markdown)) {
    const view = leaf.view;
    if (!(view instanceof MarkdownView)) {
      continue;
    }
    if (view.file?.path !== path) {
      continue;
    }
    if (view.editor.getValue() !== content) {
      view.editor.setValue(content);
    }
  }
}

/**
 * Toggles the read-only state of a single CodeMirror instance — the low-level primitive behind
 * editor locking.
 *
 * When read-only, the editor stays focusable and interactive (selection, copy, and app hotkeys such
 * as the command palette keep working) — only document edits are prevented, via the CodeMirror
 * `readOnly` state.
 *
 * This toggles ONE CodeMirror instance, not "a file": an Obsidian {@link Editor} is reused as its
 * leaf navigates between notes, so this primitive does not follow a note around. To lock a note
 * across every editor that shows it (current and future, in any window), use `lockResourceForPath`
 * from `./resource-lock.ts`.
 *
 * @param editor - The editor whose CodeMirror instance to toggle.
 * @param isReadOnly - `true` to make the editor read-only, `false` to make it editable again.
 */
export function toggleEditorReadOnly(editor: Editor, isReadOnly: boolean): void {
  const compartment = ensureCompartment(editor);
  editor.cm.dispatch({
    effects: compartment.reconfigure(isReadOnly ? EditorState.readOnly.of(true) : [])
  });
}

function ensureCompartment(editor: Editor): Compartment {
  // Key the cache by the CodeMirror instance, not by the `Editor` wrapper.
  // An `Editor` keeps its identity while its underlying CodeMirror view is swapped out.
  const codeMirror = editor.cm;
  const cachedCompartment = compartmentByCodeMirror.get(codeMirror);
  // Reuse the cached compartment only while it is still part of the current configuration.
  // A view can silently drop an appended compartment when it rebuilds its state.
  // Opening a note into a freshly created leaf does this: it installs the compartment mid-open.
  // The subsequent load then replaces the whole state, taking the compartment with it.
  // Then `Compartment.get` returns `undefined`, since the compartment is no longer configured.
  // Re-install it in that case, or every later `reconfigure` is silently ignored and nothing locks.
  // The `castTo` bridges the dual CommonJS and ESM `EditorState` declarations of `@codemirror/state`.
  // They are structurally identical, but TypeScript treats them as nominally incompatible.
  if (cachedCompartment?.get(castTo<EditorState>(codeMirror.state)) !== undefined) {
    return cachedCompartment;
  }

  const compartment = new Compartment();
  compartmentByCodeMirror.set(codeMirror, compartment);
  // A `Compartment` only takes effect once it is part of the editor's configuration.
  // The compartment is created lazily here, so install it (initially empty) via `appendConfig`.
  codeMirror.dispatch({
    effects: StateEffect.appendConfig.of(compartment.of([]))
  });
  return compartment;
}
