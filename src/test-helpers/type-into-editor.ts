/**
 * @file
 *
 * Test helper that types text into a CodeMirror editor using **trusted** keyboard input.
 *
 * Reliably testing "the user typed into the editor" inside a live Obsidian integration test is
 * surprisingly hard, because the two obvious approaches both lie:
 *
 * - A `dispatchEvent`ed `KeyboardEvent` is **untrusted** (`isTrusted: false`), so it produces no
 *   native DOM edit and CodeMirror's DOM observer ignores it — the document never changes, even when
 *   everything is wired correctly.
 * - `execCommand('insertText')` mutates the editor's current selection directly, so it inserts text
 *   **even when the editor is not focused** — masking focus bugs (e.g. a modal focus trap stealing
 *   focus) and yielding false-positive passes.
 *
 * This helper instead injects a **trusted** character event through Electron's
 * `webContents.sendInputEvent` (reachable in the Obsidian renderer via `@electron/remote`, the same
 * object as `window.electron.remote`). A trusted event behaves exactly like a real keypress: it is
 * delivered to the window's DOM-focused element and flows through CodeMirror's real input pipeline.
 * So the typed text reaches the document **only if the editor genuinely holds focus** — which makes
 * the resulting assertion a faithful end-to-end check rather than a false positive.
 *
 * It uses `getCurrentWebContents()` (the renderer's own window), NOT `getFocusedWebContents()`: the
 * latter returns `null` when no Obsidian window holds OS-level focus — exactly the headless/CI case —
 * whereas the former targets this window's input pipeline regardless of OS focus.
 *
 * It must be passed into an `evalInObsidian` callback via `args` (it is serialized with `toString()`
 * and runs inside the Obsidian process), so it is deliberately self-contained: it references only its
 * parameters and runtime globals (`window`, `sleep`), never module-scope imports or constants.
 */

import type { Editor } from 'obsidian';

interface ElectronRemote {
  getCurrentWebContents(): ElectronWebContents;
}

interface ElectronWebContents {
  sendInputEvent(inputEvent: SendInputEventKeyboardInput): void;
}

interface SendInputEventKeyboardInput {
  keyCode: string;
  type: 'char' | 'keyDown' | 'keyUp';
}

declare global {
  interface Window {
    /**
     * Electron's renderer `require`, used to reach `@electron/remote` for trusted input injection.
     * `window.electron.remote` reaches the same object at runtime; `require` is used here because it
     * types cleanly against the local interfaces.
     *
     * @param moduleId - The module to require.
     * @returns The required module.
     */
    require(moduleId: '@electron/remote'): ElectronRemote;
  }
}

/**
 * Parameters for {@link typeIntoEditor}.
 */
export interface TypeIntoEditorParams {
  /**
   * The editor to type into. It is focused (with the caret moved to the end of the document) before
   * the keystrokes are injected.
   */
  readonly editor: Editor;

  /**
   * The text to type, one trusted character event per code point.
   */
  readonly text: string;
}

/**
 * Types {@link TypeIntoEditorParams.text} into {@link TypeIntoEditorParams.editor} using trusted
 * Electron keyboard input, so the document changes only if the editor actually holds focus.
 *
 * Must be invoked inside an `evalInObsidian` callback (passed in via `args`); it runs in the Obsidian
 * renderer and uses the runtime `sleep` global.
 *
 * After injecting the keystrokes it waits — by polling, not a fixed delay — until the document
 * reflects the text, or until a bounded timeout elapses (which is the expected outcome when the
 * editor is read-only and rejects the input, or when focus was stolen and the input landed nowhere).
 * Polling keeps the result reliable even when the shared Obsidian instance is slow under full-suite
 * load, where a fixed settle would flake.
 *
 * @param params - The editor to type into and the text to type.
 * @returns A {@link Promise} that resolves once the keystrokes have been injected and settled.
 */
export async function typeIntoEditor(params: TypeIntoEditorParams): Promise<void> {
  const { editor, text } = params;
  const FOCUS_SETTLE_DELAY_MILLISECONDS = 300;
  const INPUT_POLL_INTERVAL_MILLISECONDS = 50;
  const INPUT_TIMEOUT_MILLISECONDS = 5000;

  const valueBeforeTyping = editor.getValue();

  // Focus the editor and place the caret at the end of the document.
  editor.focus();
  const lastLine = editor.lastLine();
  editor.setCursor(lastLine, editor.getLine(lastLine).length);

  // Let any focus trap (a `setTimeout(0)` re-focus) fire before typing, so stolen focus is detected.
  await sleep(FOCUS_SETTLE_DELAY_MILLISECONDS);

  const webContents = window.require('@electron/remote').getCurrentWebContents();
  for (const char of text) {
    webContents.sendInputEvent({ keyCode: char, type: 'char' });
  }

  // Poll until the document reflects the input or the timeout elapses, instead of a fixed settle.
  const startTime = Date.now();
  while (editor.getValue() === valueBeforeTyping && Date.now() - startTime < INPUT_TIMEOUT_MILLISECONDS) {
    await sleep(INPUT_POLL_INTERVAL_MILLISECONDS);
  }
}
