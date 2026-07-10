/**
 * @file
 *
 * Integration tests for path-scoped editor locking ({@link lockResourceForPath}).
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
  it
} from 'vitest';

interface BypassScopeResult {
  readonly wasBypassedModifyAllowed: boolean;
  readonly wasModifyBlockedAfterScope: boolean;
}

interface ExternalChangeResult {
  readonly wasAbortedOnExternalDelete: boolean;
}

interface ForceUnlockResult {
  readonly isLockedAfterUnlock: boolean;
  readonly isLockedBeforeUnlock: boolean;
  readonly wasAborted: boolean;
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

interface ShiftEnterResult {
  readonly didLockedNoteRejectShiftEnter: boolean;
  readonly didUnlockedNoteAcceptShiftEnter: boolean;
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

describe('resource-lock', () => {
  describe('lockResourceForPath', () => {
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

          const lockedFile = await app.vault.create('resource-lock-path-locked.md', 'locked note');
          const otherFile = await app.vault.create('resource-lock-path-other.md', 'other note');

          // Open the locked note in the current tab and lock its path.
          // The current editor is already settled, so the lock reconcile makes it read-only straight away.
          const currentTabLeaf = app.workspace.getLeaf();
          await currentTabLeaf.openFile(lockedFile);
          await settle();
          const disposable = lib.obsidian['resource-lock'].lockResourceForPath({ app, operationName: 'Integration test', pathOrFile: lockedFile, pluginId: 'integration-test' });
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
        }
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

          const lockedFile = await app.vault.create('resource-lock-typing-locked.md', 'locked note');
          const otherFile = await app.vault.create('resource-lock-typing-other.md', 'other note');

          // Open the to-be-locked note in the current tab and a second note in a split.
          const lockedLeaf = app.workspace.getLeaf();
          await lockedLeaf.openFile(lockedFile);
          await settle();
          const otherLeaf = app.workspace.getLeaf('split');
          await otherLeaf.openFile(otherFile);
          await settle();

          const disposable = lib.obsidian['resource-lock'].lockResourceForPath({ app, operationName: 'Integration test', pathOrFile: lockedFile, pluginId: 'integration-test' });
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
        }
      });

      // The user cannot type into the locked note.
      expect(result.didLockedNoteRejectTyping).toBe(true);
      // The user can type into a note that is not locked.
      expect(result.didOtherNoteAcceptTyping).toBe(true);
      // Once unlocked, the note accepts typing again.
      expect(result.didUnlockedNoteAcceptTyping).toBe(true);
    });

    it('should reject a Shift+Enter keystroke in a locked note (which bypasses the read-only facet) and accept it after unlock', async () => {
      const result = await evalInObsidian({
        async fn({ app, pressKey, waitUntil }): Promise<ShiftEnterResult> {
          const lib = window.__obsidianDevUtilsModule__;
          if (!lib) {
            throw new Error('obsidian-dev-utils module not registered on window');
          }

          // Start from a clean workspace so the reconcile sees only the view this test opens.
          app.workspace.detachLeavesOfType('markdown');
          await settle();

          const lockedFile = await app.vault.create('resource-lock-shift-enter.md', 'hello');
          const lockedLeaf = app.workspace.getLeaf();
          await lockedLeaf.openFile(lockedFile);
          await settle();

          const disposable = lib.obsidian['resource-lock'].lockResourceForPath({ app, operationName: 'Integration test', pathOrFile: lockedFile, pluginId: 'integration-test' });
          await settle();
          await reconcile();

          // Obsidian binds Shift+Enter to a handler that dispatches a change transaction directly.
          // It slips past the CodeMirror `readOnly` facet, so the lock's change filter must still drop it.
          const lockedBefore = readValue(lockedLeaf);
          await pressShiftEnter(lockedLeaf);
          await settle();
          const didLockedNoteRejectShiftEnter = readValue(lockedLeaf) === lockedBefore;

          // Releasing the lock restores the normal Shift+Enter behavior (a newline is inserted).
          disposable[Symbol.dispose]();
          await settle();
          await reconcile();
          const unlockedBefore = readValue(lockedLeaf);
          await pressShiftEnter(lockedLeaf);
          await waitUntil({
            message: 'locked note to accept Shift+Enter after unlock',
            predicate: () => readValue(lockedLeaf) !== unlockedBefore
          });
          const didUnlockedNoteAcceptShiftEnter = readValue(lockedLeaf) !== unlockedBefore;

          return {
            didLockedNoteRejectShiftEnter,
            didUnlockedNoteAcceptShiftEnter
          };

          function getEditor(leaf: unknown): Editor {
            const editor = (leaf as TypableLeaf).view.editor;
            if (!editor) {
              throw new Error('no editor on leaf');
            }
            return editor;
          }

          async function pressShiftEnter(leaf: unknown): Promise<void> {
            // `pressKey` targets the globally-focused element, so focus the editor before pressing.
            getEditor(leaf).focus();
            await pressKey({ key: 'Enter', modifiers: ['Shift'] });
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
        }
      });

      // Shift+Enter cannot edit the locked note.
      expect(result.didLockedNoteRejectShiftEnter).toBe(true);
      // Once unlocked, Shift+Enter inserts a newline again.
      expect(result.didUnlockedNoteAcceptShiftEnter).toBe(true);
    });
  });

  describe('ResourceLockComponent subtree lock', () => {
    it('should make a note inside a subtree-locked folder read-only and editable again on unlock', async () => {
      const result = await evalInObsidian({
        async fn({ app }): Promise<SubtreeLockResult> {
          const lib = window.__obsidianDevUtilsModule__;
          if (!lib) {
            throw new Error('obsidian-dev-utils module not registered on window');
          }

          app.workspace.detachLeavesOfType('markdown');
          await settle();

          const folderPath = 'resource-lock-subtree';
          if (!await app.vault.adapter.exists(folderPath)) {
            await app.vault.createFolder(folderPath);
          }
          const childFile = await app.vault.create(`${folderPath}/child.md`, 'child note');

          const leaf = app.workspace.getLeaf();
          await leaf.openFile(childFile);
          await settle();

          // Lock the whole folder subtree; the note inside it must become read-only.
          const component = new lib.obsidian['resource-lock'].ResourceLockComponent(app, 'integration-test-subtree');
          const disposable = component.lockForPath({ mode: 'subtree', operationName: 'Integration test', pathOrFile: folderPath });
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
        }
      });

      // A note inside a subtree-locked folder is read-only, and editable again once the folder unlocks.
      expect(result.isChildLockedUnderSubtree).toBe(true);
      expect(result.isChildLockedAfterUnlock).toBe(false);
    });
  });

  describe('ResourceLockComponent force unlock', () => {
    it('should abort the operation and make a locked note editable again via requestUnlockForPath', async () => {
      const result = await evalInObsidian({
        async fn({ app }): Promise<ForceUnlockResult> {
          const lib = window.__obsidianDevUtilsModule__;
          if (!lib) {
            throw new Error('obsidian-dev-utils module not registered on window');
          }

          const SETTLE_DELAY_MILLISECONDS = 300;

          app.workspace.detachLeavesOfType('markdown');
          await sleep(SETTLE_DELAY_MILLISECONDS);

          const lockedFile = await app.vault.create('resource-lock-force-unlock.md', 'locked note');
          const leaf = app.workspace.getLeaf();
          await leaf.openFile(lockedFile);
          await sleep(SETTLE_DELAY_MILLISECONDS);

          const component = new lib.obsidian['resource-lock'].ResourceLockComponent(app, 'integration-force-unlock');
          const abortController = new AbortController();
          component.lockForPath({ abortController, operationName: 'Integration force unlock', pathOrFile: lockedFile });
          await sleep(SETTLE_DELAY_MILLISECONDS);
          // Re-run the manager's reconcile against the now-settled editor so the read-only re-apply takes hold.
          app.workspace.trigger('layout-change');
          await sleep(SETTLE_DELAY_MILLISECONDS);
          const isLockedBeforeUnlock = readLeafReadOnly(leaf);

          // Force-unlock aborts the controller (cancel) AND removes the lock entry (release).
          component.requestUnlockForPath(lockedFile);
          await sleep(SETTLE_DELAY_MILLISECONDS);
          const isLockedAfterUnlock = readLeafReadOnly(leaf);
          const wasAborted = abortController.signal.aborted;

          return {
            isLockedAfterUnlock,
            isLockedBeforeUnlock,
            wasAborted
          };

          function readLeafReadOnly(readLeaf: unknown): boolean {
            const editor = (readLeaf as ReadableLeaf).view.editor;
            if (!editor) {
              throw new Error('no editor on leaf');
            }
            return editor.cm.state.readOnly;
          }
        }
      });

      // The note is read-only while locked, editable once force-unlocked, and the operation was aborted.
      expect(result.isLockedBeforeUnlock).toBe(true);
      expect(result.isLockedAfterUnlock).toBe(false);
      expect(result.wasAborted).toBe(true);
    });
  });

  describe('ResourceLockComponent mutation blocker', () => {
    it('should block real vault rename and file-manager trash of a locked file, then allow them after unlock', async () => {
      const result = await evalInObsidian({
        async fn({ app }): Promise<MutationBlockerResult> {
          const lib = window.__obsidianDevUtilsModule__;
          if (!lib) {
            throw new Error('obsidian-dev-utils module not registered on window');
          }

          const { ResourceLockComponent, ResourceLockedError } = lib.obsidian['resource-lock'];
          const path = 'resource-lock-blocker-target.md';
          const renamedPath = 'resource-lock-blocker-renamed.md';
          for (const cleanupPath of [path, renamedPath]) {
            if (await app.vault.adapter.exists(cleanupPath)) {
              await app.vault.adapter.remove(cleanupPath);
            }
          }
          const file = await app.vault.create(path, 'content');

          const component = new ResourceLockComponent(app, 'integration-blocker');
          const disposable = component.lockForPath({ operationName: 'Integration test', pathOrFile: path, shouldBlockMutations: true });

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
        }
      });

      // A mutation-blocking lock rejects real vault rename and file-manager trash with ResourceLockedError.
      expect(result.wasRenameBlocked).toBe(true);
      expect(result.wasTrashBlocked).toBe(true);
      // Once the lock is released the blocker is uninstalled and the mutation succeeds.
      expect(result.wasRenameAllowedAfterUnlock).toBe(true);
    });
  });

  describe('ResourceLockComponent mutation bypass scope', () => {
    it('should let a mutation through inside a bypass scope and enforce it again after', async () => {
      const result = await evalInObsidian({
        async fn({ app }): Promise<BypassScopeResult> {
          const lib = window.__obsidianDevUtilsModule__;
          if (!lib) {
            throw new Error('obsidian-dev-utils module not registered on window');
          }

          const { ResourceLockComponent, ResourceLockedError } = lib.obsidian['resource-lock'];
          const path = 'resource-lock-bypass-target.md';
          if (await app.vault.adapter.exists(path)) {
            await app.vault.adapter.remove(path);
          }
          const file = await app.vault.create(path, 'content');

          const component = new ResourceLockComponent(app, 'integration-bypass');
          const lock = component.lockForPath({ operationName: 'Integration test', pathOrFile: path, shouldBlockMutations: true });

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
        }
      });

      // The owner's mutation passes while bypassed; once the scope ends the path is blocked again.
      expect(result.wasBypassedModifyAllowed).toBe(true);
      expect(result.wasModifyBlockedAfterScope).toBe(true);
    });
  });

  describe('ResourceLockComponent external-change detection', () => {
    it('should abort the owning operation when a locked file is changed outside the blocker (raw adapter)', async () => {
      const result = await evalInObsidian({
        async fn({ app }): Promise<ExternalChangeResult> {
          const lib = window.__obsidianDevUtilsModule__;
          if (!lib) {
            throw new Error('obsidian-dev-utils module not registered on window');
          }

          const { ResourceLockComponent } = lib.obsidian['resource-lock'];
          const path = 'resource-lock-detector-target.md';
          if (await app.vault.adapter.exists(path)) {
            await app.vault.adapter.remove(path);
          }
          await app.vault.create(path, 'content');

          const component = new ResourceLockComponent(app, 'integration-detector');
          const abortController = new AbortController();
          const lock = component.lockForPath({ abortController, operationName: 'Integration test', pathOrFile: path, shouldBlockMutations: true });

          try {
            // A change that bypasses the blocker patch entirely (raw adapter delete). Obsidian's file watcher then fires vault('delete'), which the detector reconciles into an abort.
            await app.vault.adapter.remove(path);
            const MAX_WAIT_ITERATIONS = 50;
            const WAIT_STEP_MILLISECONDS = 100;
            for (let iteration = 0; iteration < MAX_WAIT_ITERATIONS && !abortController.signal.aborted; iteration++) {
              await sleep(WAIT_STEP_MILLISECONDS);
            }
            return { wasAbortedOnExternalDelete: abortController.signal.aborted };
          } finally {
            lock[Symbol.dispose]();
          }
        }
      });

      // The external delete aborted the operation holding the mutation-blocking lock.
      expect(result.wasAbortedOnExternalDelete).toBe(true);
    });
  });
});
