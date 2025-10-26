/**
 * @packageDocumentation
 *
 * This module provides utility functions for working with markdown editors in Obsidian
 */

import type { Editor } from 'obsidian';

import {
  Compartment,
  EditorState
} from '@codemirror/state';
import { EditorView } from '@codemirror/view';

const editorCompartmentMap = new WeakMap<Editor, Compartment>();

/**
 * Locks the editor.
 *
 * @param editor - The editor to lock.
 */
export function lockEditor(editor: Editor): void {
  const compartment = ensureCompartment(editor);
  editor.cm.dispatch({
    effects: compartment.reconfigure([
      EditorState.readOnly.of(true),
      EditorView.editable.of(false)
    ])
  });
}

/**
 * Unlocks the editor.
 *
 * @param editor - The editor to unlock.
 */
export function unlockEditor(editor: Editor): void {
  const compartment = ensureCompartment(editor);
  editor.cm.dispatch({
    effects: compartment.reconfigure([
      EditorState.readOnly.of(false),
      EditorView.editable.of(true)
    ])
  });
}

function ensureCompartment(editor: Editor): Compartment {
  let compartment = editorCompartmentMap.get(editor);
  if (!compartment) {
    compartment = new Compartment();
    editorCompartmentMap.set(editor, compartment);
  }
  return compartment;
}
