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

const editorCompartmentMap = new WeakMap<Editor, Compartment>();

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
 * across every editor that shows it (current and future, in any window), use `lockEditorForPath`
 * from `./editor-lock.ts`.
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
  let compartment = editorCompartmentMap.get(editor);
  if (!compartment) {
    compartment = new Compartment();
    editorCompartmentMap.set(editor, compartment);
    // A `Compartment` only takes effect once it is part of the editor's configuration.
    // The compartment is created lazily here, so install it (initially empty) via `appendConfig`.
    // Without this step `reconfigure` is silently ignored and the editor never actually locks.
    editor.cm.dispatch({
      effects: StateEffect.appendConfig.of(compartment.of([]))
    });
  }
  return compartment;
}
