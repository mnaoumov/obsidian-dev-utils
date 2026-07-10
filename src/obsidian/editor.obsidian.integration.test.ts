/**
 * @file
 *
 * Integration tests for the low-level editor read-only primitive.
 *
 * These run against a live Obsidian instance, so they exercise the real CodeMirror editor — unlike
 * the unit tests, which mock `@codemirror/state`. They verify that toggling an editor read-only
 * actually makes its underlying CodeMirror state read-only (the behavior a no-op toggle would
 * silently break) while keeping the editor focusable so app hotkeys keep working, and that toggling
 * it back restores editability.
 */

/// <reference types="obsidian-integration-testing/vitest/typings" />

import { evalInObsidian } from 'obsidian-integration-testing';
import {
  describe,
  expect,
  it
} from 'vitest';

interface ToggleReadOnlyResult {
  readonly contentEditableWhileReadOnly: string;
  readonly isReadOnlyAfterToggleOff: boolean;
  readonly isReadOnlyBeforeToggle: boolean;
  readonly isReadOnlyWhileToggledOn: boolean;
}

describe('editor', () => {
  describe('toggleEditorReadOnly', () => {
    it('should make the editor read-only when toggled on and editable again when toggled off', async () => {
      const result = await evalInObsidian<Record<string, never>, ToggleReadOnlyResult>({
        async fn({ app }) {
          const lib = window.__obsidianDevUtilsModule__;
          if (!lib) {
            throw new Error('obsidian-dev-utils module not registered on window');
          }

          const file = await app.vault.create('editor-toggle-read-only-integration.md', 'hello world');
          await app.workspace.getLeaf().openFile(file);
          // The CodeMirror instance is not fully wired up the instant `openFile` resolves.
          // Give it a beat to settle before toggling, or the compartment reconfigure does not take hold.
          await settle();

          const editor = app.workspace.activeEditor?.editor;
          if (!editor) {
            throw new Error('no active editor after opening the note');
          }

          const isReadOnlyBeforeToggle = editor.cm.state.readOnly;
          lib.obsidian.editor.toggleEditorReadOnly(editor, true);
          const isReadOnlyWhileToggledOn = editor.cm.state.readOnly;
          const contentEditableWhileReadOnly = editor.cm.contentDOM.contentEditable;
          lib.obsidian.editor.toggleEditorReadOnly(editor, false);
          const isReadOnlyAfterToggleOff = editor.cm.state.readOnly;

          return {
            contentEditableWhileReadOnly,
            isReadOnlyAfterToggleOff,
            isReadOnlyBeforeToggle,
            isReadOnlyWhileToggledOn
          };

          async function settle(): Promise<void> {
            const SETTLE_DELAY_MILLISECONDS = 300;
            await new Promise<void>((resolve) => {
              window.setTimeout(resolve, SETTLE_DELAY_MILLISECONDS);
            });
          }
        }
      });

      expect(result.isReadOnlyBeforeToggle).toBe(false);
      expect(result.isReadOnlyWhileToggledOn).toBe(true);
      expect(result.isReadOnlyAfterToggleOff).toBe(false);
      // The read-only state must keep the editor focusable so app hotkeys (e.g. the command palette) keep working.
      expect(result.contentEditableWhileReadOnly).toBe('true');
    });
  });
});
