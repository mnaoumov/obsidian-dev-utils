/**
 * @file
 *
 * Integration tests for {@link MinimizableModal} against a live Obsidian instance.
 *
 * The whole point of minimizing a blocking {@link Modal} is that the app stays usable while a
 * long-running operation continues in the background — most importantly, the user must be able to
 * keep editing notes. A minimized modal is still `open()`, so Obsidian keeps its focus trap active
 * (`Keymap.onFocusIn` re-focuses the active scope's `tabFocusContainerEl`, which `Modal` sets to its
 * now-hidden `containerEl`): focusing the editor gets stolen back and the user cannot type. The fix
 * pops the modal's keymap scope on `minimize()` (and pushes it back on `restore()`).
 *
 * Typing goes through {@link typeIntoEditor}, which injects **trusted** Electron keyboard input — so
 * the document changes only if the editor genuinely holds focus. With the focus trap still active the
 * trusted keystroke lands nowhere and the assertion fails, making this a faithful end-to-end guard
 * (unlike `execCommand`, which would insert text even while focus is trapped away).
 */

/// <reference types="obsidian-integration-testing/vitest/typings" />

import { evalInObsidian } from 'obsidian-integration-testing';
import {
  describe,
  expect,
  inject,
  it
} from 'vitest';

import { typeIntoEditor } from '../../test-helpers/type-into-editor.ts';

interface TypingWhileMinimizedResult {
  readonly didAcceptTypingAfterRestore: boolean;
  readonly didAcceptTypingWhileMinimized: boolean;
  readonly isMinimized: boolean;
}

describe('MinimizableModal', () => {
  describe('minimize', () => {
    it('should keep the editor typable while the modal is minimized and after it is restored', async () => {
      const result = await evalInObsidian({
        args: { typeIntoEditor },
        async fn({ app, obsidianModule, typeIntoEditor: typeIntoEditorInObsidian }): Promise<TypingWhileMinimizedResult> {
          const lib = window.__obsidianDevUtilsModule__;
          if (!lib) {
            throw new Error('obsidian-dev-utils module not registered on window');
          }

          // This file shares its live Obsidian instance with the other integration suites.
          // Start from a clean workspace so only the view this test opens is around.
          app.workspace.detachLeavesOfType('markdown');
          await settle();

          const file = await app.vault.create('minimizable-modal-typing.md', 'hello world');
          const leaf = app.workspace.getLeaf();
          await leaf.openFile(file);
          // The CodeMirror instance is not fully wired up the instant `openFile` resolves.
          await settle();

          // Open a plain blocking modal and wrap it so it can be minimized.
          const modal = new obsidianModule.Modal(app);
          modal.setTitle('Working');
          const minimizable = new lib.obsidian.modals['minimizable-modal'].MinimizableModal(modal);
          minimizable.modal.open();
          await settle();

          // Minimize it: the backdrop is hidden and the app should be fully usable again.
          minimizable.minimize();
          await settle();
          const isMinimized = minimizable.isMinimized;

          // Typing into the editor while the modal is minimized must reach the document.
          // A trusted keystroke only lands if the editor holds focus (i.e. the focus trap released).
          const beforeMinimized = readValue();
          await typeIntoEditorInObsidian({ editor: getEditor(), text: 'X' });
          const didAcceptTypingWhileMinimized = readValue() !== beforeMinimized;

          // Restoring then closing the modal must leave the editor typable.
          minimizable.restore();
          await settle();
          minimizable.modal.close();
          await settle();
          const beforeRestore = readValue();
          await typeIntoEditorInObsidian({ editor: getEditor(), text: 'Y' });
          const didAcceptTypingAfterRestore = readValue() !== beforeRestore;

          return {
            didAcceptTypingAfterRestore,
            didAcceptTypingWhileMinimized,
            isMinimized
          };

          function getEditor(): NonNullable<NonNullable<typeof app.workspace.activeEditor>['editor']> {
            const editor = app.workspace.activeEditor?.editor;
            if (!editor) {
              throw new Error('no active editor');
            }
            return editor;
          }

          function readValue(): string {
            return getEditor().getValue();
          }

          async function settle(): Promise<void> {
            const SETTLE_DELAY_MILLISECONDS = 300;
            await sleep(SETTLE_DELAY_MILLISECONDS);
          }
        },
        vaultPath: inject('tempVaultPath')
      });

      // Minimizing actually minimized the modal.
      expect(result.isMinimized).toBe(true);
      // The user can type into the editor while the modal is minimized (focus trap released).
      expect(result.didAcceptTypingWhileMinimized).toBe(true);
      // Editing still works once the modal is restored and closed.
      expect(result.didAcceptTypingAfterRestore).toBe(true);
    });
  });
});
