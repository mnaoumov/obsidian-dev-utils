/**
 * @file
 *
 * This module provides utility functions for working with markdown editors in Obsidian
 */

import type { Editor } from 'obsidian';

import {
  Compartment,
  EditorState,
  StateEffect
} from '@codemirror/state';

import { castTo } from '../object-utils.ts';

const compartmentByCodeMirror = new WeakMap<Editor['cm'], Compartment>();

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
