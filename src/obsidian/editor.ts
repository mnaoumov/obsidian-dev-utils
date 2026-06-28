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

import { CallbackDisposable } from '../disposable.ts';

const editorCompartmentMap = new WeakMap<Editor, Compartment>();

/**
 * Locks the editor, making it read-only.
 *
 * The editor stays focusable and interactive (selection, copy, and app hotkeys such as the command
 * palette keep working) — only document edits are prevented, via the CodeMirror `readOnly` state.
 *
 * @param editor - The editor to lock.
 * @returns A {@link Disposable} that unlocks the editor when disposed, for use with `using`.
 */
export function lockEditor(editor: Editor): Disposable {
  const compartment = ensureCompartment(editor);
  editor.cm.dispatch({
    effects: compartment.reconfigure(EditorState.readOnly.of(true))
  });
  return new CallbackDisposable({
    callback: (): void => {
      unlockEditor(editor);
    }
  });
}

/**
 * Unlocks the editor, making it editable again.
 *
 * @param editor - The editor to unlock.
 */
export function unlockEditor(editor: Editor): void {
  const compartment = ensureCompartment(editor);
  editor.cm.dispatch({
    effects: compartment.reconfigure([])
  });
}

function ensureCompartment(editor: Editor): Compartment {
  let compartment = editorCompartmentMap.get(editor);
  if (!compartment) {
    compartment = new Compartment();
    editorCompartmentMap.set(editor, compartment);
    // A `Compartment` only takes effect once it is part of the editor's configuration. Since the
    // compartment is created lazily here, install it (initially empty) via `appendConfig`; without
    // this step `reconfigure` is silently ignored and the editor never actually locks.
    editor.cm.dispatch({
      effects: StateEffect.appendConfig.of(compartment.of([]))
    });
  }
  return compartment;
}
