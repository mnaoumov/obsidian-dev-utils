/**
 * @file
 *
 * Integration tests for path-scoped editor locking ({@link lockEditorForPath}).
 *
 * These run against a live Obsidian instance, so they exercise the real reconcile across every open
 * view of a note — including a separate split and a popout window — which the unit tests (mocked
 * workspace) cannot. They verify that locking a path makes its editor read-only everywhere the note
 * is open, that a view opened AFTER the lock (a future editor) is auto-locked, that editors for other
 * notes stay editable, and that unlocking restores editability.
 *
 * An Obsidian {@link Editor} instance is reused as its leaf navigates between notes and goes stale
 * after a re-layout, so this test NEVER holds an `Editor` reference across another open: it keeps
 * only the (stable) {@link WorkspaceLeaf} handles and re-reads `leaf.view.editor` fresh at read time.
 *
 * A CodeMirror instance is not fully wired up the instant `openFile` resolves, so a read-only
 * reconfigure dispatched against a not-yet-settled editor does not take hold. For a future editor the
 * test therefore settles after the open and triggers a reconcile (`layout-change`) so the manager
 * re-applies the read-only toggle against the now-ready editor.
 */

/// <reference types="obsidian-integration-testing/vitest/typings" />

import type { Editor } from 'obsidian';

import { evalInObsidian } from 'obsidian-integration-testing';
import {
  describe,
  expect,
  inject,
  it
} from 'vitest';

interface BypassScopeResult {
  readonly wasBypassedModifyAllowed: boolean;
  readonly wasModifyBlockedAfterScope: boolean;
}

interface LockForPathResult {
  readonly isCurrentTabLocked: boolean;
  readonly isCurrentTabLockedAfterUnlock: boolean;
  readonly isOtherNoteLocked: boolean;
  readonly isPopoutLocked: boolean;
  readonly isSeparateTabLocked: boolean;
}

interface MutationBlockerResult {
  readonly wasRenameAllowedAfterUnlock: boolean;
  readonly wasRenameBlocked: boolean;
  readonly wasTrashBlocked: boolean;
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

interface SubtreeLockResult {
  readonly isChildLockedAfterUnlock: boolean;
  readonly isChildLockedUnderSubtree: boolean;
}

interface TypableLeaf {
  view: TypableView;
}

interface TypableView {
  editor?: Editor;
}

interface TypingResult {
  readonly didLockedNoteRejectTyping: boolean;
  readonly didOtherNoteAcceptTyping: boolean;
  readonly didUnlockedNoteAcceptTyping: boolean;
}

describe('editor-lock', () => {
  describe('lockEditorForPath', () => {
    it('should lock the current tab, auto-lock a future split and popout of the same note, and leave other notes editable', async () => {
      const result = await evalInObsidian<Record<string, never>, LockForPathResult>({
        async fn({ app }) {
          const lib = window.__obsidianDevUtilsModule__;
          if (!lib) {
            throw new Error('obsidian-dev-utils module not registered on window');
          }

          // This file shares its live Obsidian instance with the other integration suites.
          // Those suites leave their own leaves and popouts open.
          // Start from a clean workspace so the reconcile below sees only the views this test opens.
          app.workspace.detachLeavesOfType('markdown');
          await settle();

          const lockedFile = await app.vault.create('editor-lock-path-locked.md', 'locked note');
          const otherFile = await app.vault.create('editor-lock-path-other.md', 'other note');

          // Open the locked note in the current tab and lock its path.
          // The current editor is already settled, so the lock reconcile makes it read-only straight away.
          const currentTabLeaf = app.workspace.getLeaf();
          await currentTabLeaf.openFile(lockedFile);
          await settle();
          const disposable = lib.obsidian['editor-lock'].lockEditorForPath(app, lockedFile, 'integration-test');
          await settle();
          const isCurrentTabLocked = readLeafReadOnly(currentTabLeaf);

          // Open the SAME note in a split — a future editor.
          // Its first (synchronous) reconcile runs before the editor is ready.
          // Settle and trigger a reconcile so the manager re-applies the lock to the now-ready editor.
          const separateTabLeaf = app.workspace.getLeaf('split');
          await separateTabLeaf.openFile(lockedFile);
          await settle();
          await reconcile();
          const isSeparateTabLocked = readLeafReadOnly(separateTabLeaf);

          // Open the same note a third time in a popout window — another future editor.
          const popoutLeaf = app.workspace.openPopoutLeaf();
          await popoutLeaf.openFile(lockedFile);
          await settle();
          await reconcile();
          const isPopoutLocked = readLeafReadOnly(popoutLeaf);

          // Open a different note, which must stay editable.
          const otherNoteLeaf = app.workspace.getLeaf('split');
          await otherNoteLeaf.openFile(otherFile);
          await settle();
          await reconcile();
          const isOtherNoteLocked = readLeafReadOnly(otherNoteLeaf);

          // Releasing the lock makes the note editable again.
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

          async function reconcile(): Promise<void> {
            // Re-run the manager's reconcile against the now-settled editor.
            // The read-only re-apply then takes hold on a freshly-opened (future) view.
            app.workspace.trigger('layout-change');
            await settle();
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

      // The locked note is read-only in the current tab and in every future view (split, popout).
      expect(result.isCurrentTabLocked).toBe(true);
      expect(result.isSeparateTabLocked).toBe(true);
      expect(result.isPopoutLocked).toBe(true);
      // Other notes stay editable.
      expect(result.isOtherNoteLocked).toBe(false);
      // Unlocking restores editability.
      expect(result.isCurrentTabLockedAfterUnlock).toBe(false);
    });

    it('should prevent the user from typing in a locked note while allowing it in an unlocked one', async () => {
      const result = await evalInObsidian({
        async fn({ app, typeIntoEditor }): Promise<TypingResult> {
          const lib = window.__obsidianDevUtilsModule__;
          if (!lib) {
            throw new Error('obsidian-dev-utils module not registered on window');
          }

          // Start from a clean workspace so the reconcile sees only the views this test opens.
          app.workspace.detachLeavesOfType('markdown');
          await settle();

          const lockedFile = await app.vault.create('editor-lock-typing-locked.md', 'locked note');
          const otherFile = await app.vault.create('editor-lock-typing-other.md', 'other note');

          // Open the to-be-locked note in the current tab and a second note in a split.
          const lockedLeaf = app.workspace.getLeaf();
          await lockedLeaf.openFile(lockedFile);
          await settle();
          const otherLeaf = app.workspace.getLeaf('split');
          await otherLeaf.openFile(otherFile);
          await settle();

          const disposable = lib.obsidian['editor-lock'].lockEditorForPath(app, lockedFile, 'integration-test');
          await settle();
          await reconcile();

          // Typing into the locked note is rejected: its document is unchanged.
          const lockedBefore = readValue(lockedLeaf);
          await typeIntoEditor({ editor: getEditor(lockedLeaf), text: 'X' });
          const didLockedNoteRejectTyping = readValue(lockedLeaf) === lockedBefore;

          // Typing into the never-locked note is accepted: its document gains the typed text.
          const otherBefore = readValue(otherLeaf);
          await typeIntoEditor({ editor: getEditor(otherLeaf), text: 'Y' });
          const didOtherNoteAcceptTyping = readValue(otherLeaf) !== otherBefore;

          // Releasing the lock makes the previously-locked note typable again.
          disposable[Symbol.dispose]();
          await settle();
          const unlockedBefore = readValue(lockedLeaf);
          await typeIntoEditor({ editor: getEditor(lockedLeaf), text: 'Z' });
          const didUnlockedNoteAcceptTyping = readValue(lockedLeaf) !== unlockedBefore;

          return {
            didLockedNoteRejectTyping,
            didOtherNoteAcceptTyping,
            didUnlockedNoteAcceptTyping
          };

          function getEditor(leaf: unknown): Editor {
            const editor = (leaf as TypableLeaf).view.editor;
            if (!editor) {
              throw new Error('no editor on leaf');
            }
            return editor;
          }

          function readValue(leaf: unknown): string {
            return getEditor(leaf).getValue();
          }

          async function reconcile(): Promise<void> {
            app.workspace.trigger('layout-change');
            await settle();
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

      // The user cannot type into the locked note.
      expect(result.didLockedNoteRejectTyping).toBe(true);
      // The user can type into a note that is not locked.
      expect(result.didOtherNoteAcceptTyping).toBe(true);
      // Once unlocked, the note accepts typing again.
      expect(result.didUnlockedNoteAcceptTyping).toBe(true);
    });
  });

  describe('EditorLockComponent subtree lock', () => {
    it('should make a note inside a subtree-locked folder read-only and editable again on unlock', async () => {
      const result = await evalInObsidian({
        async fn({ app }): Promise<SubtreeLockResult> {
          const lib = window.__obsidianDevUtilsModule__;
          if (!lib) {
            throw new Error('obsidian-dev-utils module not registered on window');
          }

          app.workspace.detachLeavesOfType('markdown');
          await settle();

          const folderPath = 'editor-lock-subtree';
          if (!await app.vault.adapter.exists(folderPath)) {
            await app.vault.createFolder(folderPath);
          }
          const childFile = await app.vault.create(`${folderPath}/child.md`, 'child note');

          const leaf = app.workspace.getLeaf();
          await leaf.openFile(childFile);
          await settle();

          // Lock the whole folder subtree; the note inside it must become read-only.
          const component = new lib.obsidian['editor-lock'].EditorLockComponent(app, 'integration-test-subtree');
          const disposable = component.lockForPath(folderPath, { mode: 'subtree' });
          await settle();
          await reconcile();
          const isChildLockedUnderSubtree = readLeafReadOnly(leaf);

          disposable[Symbol.dispose]();
          await settle();
          const isChildLockedAfterUnlock = readLeafReadOnly(leaf);

          return {
            isChildLockedAfterUnlock,
            isChildLockedUnderSubtree
          };

          function readLeafReadOnly(readLeaf: unknown): boolean {
            const editor = (readLeaf as ReadableLeaf).view.editor;
            if (!editor) {
              throw new Error('no editor on leaf');
            }
            return editor.cm.state.readOnly;
          }

          async function reconcile(): Promise<void> {
            app.workspace.trigger('layout-change');
            await settle();
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

      // A note inside a subtree-locked folder is read-only, and editable again once the folder unlocks.
      expect(result.isChildLockedUnderSubtree).toBe(true);
      expect(result.isChildLockedAfterUnlock).toBe(false);
    });
  });

  describe('EditorLockComponent mutation blocker', () => {
    it('should block real vault rename and file-manager trash of a locked file, then allow them after unlock', async () => {
      const result = await evalInObsidian({
        async fn({ app }): Promise<MutationBlockerResult> {
          const lib = window.__obsidianDevUtilsModule__;
          if (!lib) {
            throw new Error('obsidian-dev-utils module not registered on window');
          }

          const { EditorLockComponent, ResourceLockedError } = lib.obsidian['editor-lock'];
          const path = 'editor-lock-blocker-target.md';
          const renamedPath = 'editor-lock-blocker-renamed.md';
          for (const cleanupPath of [path, renamedPath]) {
            if (await app.vault.adapter.exists(cleanupPath)) {
              await app.vault.adapter.remove(cleanupPath);
            }
          }
          const file = await app.vault.create(path, 'content');

          const component = new EditorLockComponent(app, 'integration-blocker');
          const disposable = component.lockForPath(path, { shouldBlockMutations: true });

          let wasRenameBlocked = false;
          let wasTrashBlocked = false;
          try {
            try {
              await app.vault.rename(file, renamedPath);
            } catch (error) {
              wasRenameBlocked = error instanceof ResourceLockedError;
            }
            try {
              await app.fileManager.trashFile(file);
            } catch (error) {
              wasTrashBlocked = error instanceof ResourceLockedError;
            }
          } finally {
            disposable[Symbol.dispose]();
          }

          // With the blocker uninstalled, the same rename now runs.
          let wasRenameAllowedAfterUnlock: boolean;
          try {
            await app.vault.rename(file, renamedPath);
            wasRenameAllowedAfterUnlock = true;
          } catch {
            wasRenameAllowedAfterUnlock = false;
          }

          const renamed = app.vault.getAbstractFileByPath(renamedPath);
          if (renamed) {
            // eslint-disable-next-line obsidianmd/prefer-file-manager-trash-file -- Permanent cleanup in tests.
            await app.vault.delete(renamed, true);
          }

          return {
            wasRenameAllowedAfterUnlock,
            wasRenameBlocked,
            wasTrashBlocked
          };
        },
        vaultPath: inject('tempVaultPath')
      });

      // A mutation-blocking lock rejects real vault rename and file-manager trash with ResourceLockedError.
      expect(result.wasRenameBlocked).toBe(true);
      expect(result.wasTrashBlocked).toBe(true);
      // Once the lock is released the blocker is uninstalled and the mutation succeeds.
      expect(result.wasRenameAllowedAfterUnlock).toBe(true);
    });
  });

  describe('EditorLockComponent mutation bypass scope', () => {
    it('should let a mutation through inside a bypass scope and enforce it again after', async () => {
      const result = await evalInObsidian({
        async fn({ app }): Promise<BypassScopeResult> {
          const lib = window.__obsidianDevUtilsModule__;
          if (!lib) {
            throw new Error('obsidian-dev-utils module not registered on window');
          }

          const { EditorLockComponent, ResourceLockedError } = lib.obsidian['editor-lock'];
          const path = 'editor-lock-bypass-target.md';
          if (await app.vault.adapter.exists(path)) {
            await app.vault.adapter.remove(path);
          }
          const file = await app.vault.create(path, 'content');

          const component = new EditorLockComponent(app, 'integration-bypass');
          const lock = component.lockForPath(path, { shouldBlockMutations: true });

          let wasBypassedModifyAllowed = false;
          let wasModifyBlockedAfterScope = false;
          try {
            const bypass = component.bypassBlockedMutations([path]);
            try {
              await app.vault.modify(file, 'bypassed content');
              wasBypassedModifyAllowed = true;
            } catch {
              // The bypassed modify should be allowed; leave the flag false if it unexpectedly throws.
            } finally {
              bypass[Symbol.dispose]();
            }
            // Outside the scope the path is enforced again.
            try {
              await app.vault.modify(file, 'enforced content');
            } catch (error) {
              wasModifyBlockedAfterScope = error instanceof ResourceLockedError;
            }
          } finally {
            lock[Symbol.dispose]();
          }

          // eslint-disable-next-line obsidianmd/prefer-file-manager-trash-file -- Permanent cleanup in tests.
          await app.vault.delete(file, true);

          return {
            wasBypassedModifyAllowed,
            wasModifyBlockedAfterScope
          };
        },
        vaultPath: inject('tempVaultPath')
      });

      // The owner's mutation passes while bypassed; once the scope ends the path is blocked again.
      expect(result.wasBypassedModifyAllowed).toBe(true);
      expect(result.wasModifyBlockedAfterScope).toBe(true);
    });
  });
});
