/**
 * @file
 *
 * Integration tests for path-scoped editor locking ({@link lockEditorForPath}).
 *
 * These run against a live Obsidian instance, so they exercise the real reconcile across every open
 * view of a note — including a separate split and a popout window — which the unit tests (mocked
 * workspace) cannot. They verify that locking a path makes its editor read-only everywhere the note
 * is open, while editors for other notes stay editable, and that unlocking restores editability.
 *
 * An Obsidian {@link Editor} instance is reused as its leaf navigates between notes and goes stale
 * after a re-layout, so this test NEVER holds an `Editor` reference across another open: it keeps
 * only the (stable) {@link WorkspaceLeaf} handles and re-reads `leaf.view.editor` fresh at read time.
 *
 * The views are all opened (and given a beat to settle) BEFORE the path is locked: a CodeMirror
 * instance is not fully wired up the instant `openFile` resolves, so a read-only reconfigure
 * dispatched against a not-yet-settled editor does not take hold. Opening everything first means the
 * single lock reconcile runs against editors that are all ready, which is what makes the assertions
 * deterministic.
 */

/// <reference types="obsidian-integration-testing/vitest/typings" />

import { evalInObsidian } from 'obsidian-integration-testing';
import {
  describe,
  expect,
  inject,
  it
} from 'vitest';

interface LockForPathResult {
  readonly isCurrentTabLocked: boolean;
  readonly isCurrentTabLockedAfterUnlock: boolean;
  readonly isOtherNoteLocked: boolean;
  readonly isPopoutLocked: boolean;
  readonly isSeparateTabLocked: boolean;
}

interface ReadableCodeMirror {
  state: ReadableCodeMirrorState;
}

interface ReadableCodeMirrorState {
  readOnly: boolean;
}

interface ReadableEditor {
  cm: ReadableCodeMirror;
}

interface ReadableLeaf {
  view: ReadableView;
}

interface ReadableView {
  editor?: ReadableEditor;
}

describe('editor-lock', () => {
  describe('lockEditorForPath', () => {
    it('should lock the note in the current tab, a separate split, and a popout window, leaving other notes editable', async () => {
      const result = await evalInObsidian<Record<string, never>, LockForPathResult>({
        async fn({ app }) {
          const lib = window.__obsidianDevUtilsModule__;
          if (!lib) {
            throw new Error('obsidian-dev-utils module not registered on window');
          }

          // This file shares its live Obsidian instance with the other integration suites, which leave
          // their own leaves and popouts open. Start from a clean workspace so the reconcile below sees
          // only the views this test opens.
          app.workspace.detachLeavesOfType('markdown');
          await settle();

          const lockedFile = await app.vault.create('editor-lock-path-locked.md', 'locked note');
          const otherFile = await app.vault.create('editor-lock-path-other.md', 'other note');

          // Open the locked note in the current tab, a separate split, and a popout window.
          // Open a different note in its own split. Settle after each so every editor is ready before locking.
          const currentTabLeaf = app.workspace.getLeaf();
          await currentTabLeaf.openFile(lockedFile);
          await settle();

          const separateTabLeaf = app.workspace.getLeaf('split');
          await separateTabLeaf.openFile(lockedFile);
          await settle();

          const popoutLeaf = app.workspace.openPopoutLeaf();
          await popoutLeaf.openFile(lockedFile);
          await settle();

          const otherNoteLeaf = app.workspace.getLeaf('split');
          await otherNoteLeaf.openFile(otherFile);
          await settle();

          // A single lock reconcile now locks every open view of the path; other notes stay editable.
          const disposable = lib.obsidian['editor-lock'].lockEditorForPath(app, lockedFile);
          await settle();

          const isCurrentTabLocked = readLeafReadOnly(currentTabLeaf);
          const isSeparateTabLocked = readLeafReadOnly(separateTabLeaf);
          const isPopoutLocked = readLeafReadOnly(popoutLeaf);
          const isOtherNoteLocked = readLeafReadOnly(otherNoteLeaf);

          // Releasing the lock makes the note editable again everywhere it is open.
          disposable[Symbol.dispose]();
          await settle();
          const isCurrentTabLockedAfterUnlock = readLeafReadOnly(currentTabLeaf);

          return {
            isCurrentTabLocked,
            isCurrentTabLockedAfterUnlock,
            isOtherNoteLocked,
            isPopoutLocked,
            isSeparateTabLocked
          };

          function readLeafReadOnly(leaf: unknown): boolean {
            const editor = (leaf as ReadableLeaf).view.editor;
            if (!editor) {
              throw new Error('no editor on leaf');
            }
            return editor.cm.state.readOnly;
          }

          async function settle(): Promise<void> {
            const SETTLE_DELAY_MILLISECONDS = 300;
            await new Promise<void>((resolve) => {
              window.setTimeout(resolve, SETTLE_DELAY_MILLISECONDS);
            });
          }
        },
        vaultPath: inject('tempVaultPath')
      });

      // The locked note is read-only in every place it is open (current tab, split, popout).
      expect(result.isCurrentTabLocked).toBe(true);
      expect(result.isSeparateTabLocked).toBe(true);
      expect(result.isPopoutLocked).toBe(true);
      // Other notes stay editable.
      expect(result.isOtherNoteLocked).toBe(false);
      // Unlocking restores editability.
      expect(result.isCurrentTabLockedAfterUnlock).toBe(false);
    });
  });
});
