/**
 * @file
 *
 * Desktop-only trusted input helpers that drive the real Electron renderer via
 * `webContents.sendInputEvent`, so keystrokes and pointer moves flow through the same trusted input
 * pipeline a real user produces (unlike untrusted `dispatchEvent`, which CodeMirror and the CSS `:hover`
 * engine ignore).
 *
 * These are the importable-module twins of the base helpers the `obsidian-integration-testing` harness
 * seeds into the `lib` bag; the two copies are kept behaviorally in sync by hand (see the project
 * `CLAUDE.md`). Desktop-only: they depend on `window.electron`.
 */

import type {
  Editor,
  Modifier
} from 'obsidian';

import { Platform } from 'obsidian';

import { assertNever } from '../type-guards.ts';

/**
 * Parameters for {@link hoverElement}.
 */
export interface HoverElementParams {
  /**
   * The element to hover. The pointer is moved to its center.
   */
  readonly element: HTMLElement;
}

/**
 * Parameters for {@link moveMouse}.
 */
export interface MoveMouseParams {
  /**
   * The x coordinate (web-contents DIP) to move the pointer to.
   */
  readonly x: number;

  /**
   * The y coordinate (web-contents DIP) to move the pointer to.
   */
  readonly y: number;
}

/**
 * Parameters for {@link pressKey}.
 */
export interface PressKeyParams {
  /**
   * The key to press, given as an Electron Accelerator key name — e.g. `'Enter'`, `'Escape'`, `'Tab'`,
   * an arrow key, or a printable character (`'a'`, `'1'`).
   */
  readonly key: string;

  /**
   * The modifier keys to hold, using Obsidian's {@link Modifier} names. `'Mod'` resolves per-platform
   * (Cmd on macOS, Ctrl elsewhere).
   *
   * @default `[]`
   */
  readonly modifiers?: readonly Modifier[];
}

/**
 * Parameters for {@link typeIntoEditor}.
 */
export interface TypeIntoEditorParams {
  /**
   * The editor to type into. It is focused (caret moved to the end of the document) before the keystrokes
   * are injected.
   */
  readonly editor: Editor;

  /**
   * The text to type. Each code point is pressed via {@link pressKey}, exactly as a real user typing.
   */
  readonly text: string;
}

/**
 * Parameters for {@link unhoverElement}.
 */
export interface UnhoverElementParams {
  /**
   * The element to move the pointer away from. The pointer is moved to a point just outside its bounding
   * box.
   */
  readonly element: HTMLElement;
}

type CurrentWebContents = ReturnType<Window['electron']['remote']['getCurrentWebContents']>;

// The Electron modifier-key names `sendInputEvent` accepts (e.g. 'meta', 'control', 'shift', 'alt').
// The type is derived from the web-contents type so it stays in sync with the Electron typings.
type ElectronModifier = NonNullable<Parameters<CurrentWebContents['sendInputEvent']>[0]['modifiers']>[number];

/**
 * Interval (in ms) between polls while waiting for a trusted input event to take effect (the editor
 * document updates, or an element's `:hover` state flips).
 */
const INPUT_POLL_INTERVAL_IN_MILLISECONDS = 50;

/**
 * Maximum time (in ms) to wait for a trusted input event to take effect before giving up (the expected
 * outcome when the input is rejected — e.g. a read-only editor).
 */
const INPUT_TIMEOUT_IN_MILLISECONDS = 5000;

/**
 * Divisor used to find the center of an element's bounding box.
 */
const CENTER_DIVISOR = 2;

/**
 * Moves the mouse pointer to the center of an element using **trusted** Electron pointer input, then polls
 * until the element actually matches `:hover`.
 *
 * Because the move is trusted, the real `:hover` state takes effect in the CSS engine — unlike
 * `dispatchEvent(new MouseEvent('mouseover'))`, which is untrusted and never sets `:hover`. It targets the
 * single window's **global** pointer, so only one element is hovered at a time.
 *
 * @param params - The element to hover.
 * @returns A {@link Promise} that resolves once the element matches `:hover`.
 */
export async function hoverElement(params: HoverElementParams): Promise<void> {
  const { element } = params;

  // Viewport coords equal web-contents DIP coords for the full-window `BrowserWindow`.
  const rect = element.getBoundingClientRect();
  moveMouse({ x: rect.left + rect.width / CENTER_DIVISOR, y: rect.top + rect.height / CENTER_DIVISOR });

  // Poll until the real `:hover` state has actually taken, instead of a fixed settle.
  const startTime = Date.now();
  while (!element.matches(':hover') && Date.now() - startTime < INPUT_TIMEOUT_IN_MILLISECONDS) {
    await sleep(INPUT_POLL_INTERVAL_IN_MILLISECONDS);
  }
}

/**
 * Moves the mouse pointer to the given web-contents coordinates using a **trusted** Electron pointer move.
 *
 * A trusted move updates the real pointer state in the CSS engine, so `:hover` rules genuinely apply. This
 * is the low-level primitive: it performs a single move and does **not** wait for any state to settle
 * (callers poll their own readiness signal). Prefer {@link hoverElement} / {@link unhoverElement} for
 * element-relative moves.
 *
 * @param params - The web-contents DIP coordinates to move to.
 */
export function moveMouse(params: MoveMouseParams): void {
  getWebContents().sendInputEvent({ type: 'mouseMove', x: Math.round(params.x), y: Math.round(params.y) });
}

/**
 * Presses a single key (optionally with modifiers) using **trusted** Electron keyboard input, firing the
 * full real key pipeline — `keydown` → `keypress` → `beforeinput` → `input` → `keyup`.
 *
 * It injects a trusted `keyDown` → `char` → `keyUp` sequence, delivered to the window's DOM-focused
 * element — unlike `dispatchEvent(new KeyboardEvent(...))`, which is untrusted and ignored by CodeMirror.
 * Use it for special keys (`'Enter'`, `'Escape'`, `'Tab'`, arrow keys) and modifier combinations. It does
 * **not** poll for any effect; the caller focuses the target first, then awaits the expected effect.
 *
 * @param params - The key to press and any modifiers to hold.
 */
export function pressKey(params: PressKeyParams): void {
  const { key, modifiers = [] } = params;

  // 'Mod' is Obsidian's platform-agnostic modifier: Cmd (meta) on macOS, Ctrl elsewhere.
  const isMacOS = Platform.isMacOS;

  // Map Obsidian's `Modifier` names to Electron's lowercase `sendInputEvent` modifier names.
  const electronModifiers = modifiers.map((modifier): ElectronModifier => {
    switch (modifier) {
      case 'Alt':
        return 'alt';
      case 'Ctrl':
        return 'control';
      case 'Meta':
        return 'meta';
      case 'Mod':
        return isMacOS ? 'meta' : 'control';
      case 'Shift':
        return 'shift';
      default:
        return assertNever(modifier);
    }
  });

  const webContents = getWebContents();

  // A trusted key press is keyDown -> char -> keyUp: the full real key pipeline.
  webContents.sendInputEvent({ keyCode: key, modifiers: electronModifiers, type: 'keyDown' });
  webContents.sendInputEvent({ keyCode: key, modifiers: electronModifiers, type: 'char' });
  webContents.sendInputEvent({ keyCode: key, modifiers: electronModifiers, type: 'keyUp' });
}

/**
 * Types text into a CodeMirror {@link Editor} using **trusted** Electron keyboard input.
 *
 * This focuses the editor (caret to end) and presses every code point of `text` via {@link pressKey} — the
 * same trusted sequence a real user produces — so the text reaches the document **only if the editor
 * genuinely holds focus**. After injecting the keystrokes it polls until the document reflects the input,
 * or a bounded timeout elapses (the expected outcome when the editor is read-only or focus was stolen).
 *
 * @param params - The editor to type into and the text to type.
 * @returns A {@link Promise} that resolves once the keystrokes have settled.
 */
export async function typeIntoEditor(params: TypeIntoEditorParams): Promise<void> {
  const FOCUS_SETTLE_DELAY_IN_MILLISECONDS = 300;

  const { editor, text } = params;
  const valueBeforeTyping = editor.getValue();

  // Focus the editor and place the caret at the end of the document.
  editor.focus();
  const lastLine = editor.lastLine();
  editor.setCursor(lastLine, editor.getLine(lastLine).length);

  // Let any focus trap (a `setTimeout(0)` re-focus) fire before typing, so stolen focus is detected.
  await sleep(FOCUS_SETTLE_DELAY_IN_MILLISECONDS);

  // Typing is pressing each character key in turn.
  for (const char of text) {
    pressKey({ key: char });
  }

  // Poll until the document reflects the input or the timeout elapses, instead of a fixed settle.
  const startTime = Date.now();
  while (editor.getValue() === valueBeforeTyping && Date.now() - startTime < INPUT_TIMEOUT_IN_MILLISECONDS) {
    await sleep(INPUT_POLL_INTERVAL_IN_MILLISECONDS);
  }
}

/**
 * Moves the mouse pointer to a point just outside an element's bounding box using a **trusted** Electron
 * pointer move, then polls until the element no longer matches `:hover`.
 *
 * The inverse of {@link hoverElement}. When an element spans the full viewport (no point outside its box is
 * reachable), use {@link moveMouse} directly to move the pointer to a known empty coordinate instead.
 *
 * @param params - The element to move the pointer away from.
 * @returns A {@link Promise} that resolves once the element no longer matches `:hover`.
 */
export async function unhoverElement(params: UnhoverElementParams): Promise<void> {
  const OUTSIDE_OFFSET_IN_PIXELS = 1;

  const { element } = params;

  // Move to a point just outside the element's box. When flush against the viewport's left edge, use just
  // Past the right edge. A full-viewport-width element should use `moveMouse` directly instead.
  const rect = element.getBoundingClientRect();
  const x = rect.left >= OUTSIDE_OFFSET_IN_PIXELS ? rect.left - OUTSIDE_OFFSET_IN_PIXELS : rect.right + OUTSIDE_OFFSET_IN_PIXELS;
  const y = rect.top + rect.height / CENTER_DIVISOR;
  moveMouse({ x, y });

  // Poll until the real `:hover` state has actually cleared, instead of a fixed settle.
  const startTime = Date.now();
  while (element.matches(':hover') && Date.now() - startTime < INPUT_TIMEOUT_IN_MILLISECONDS) {
    await sleep(INPUT_POLL_INTERVAL_IN_MILLISECONDS);
  }
}

function getWebContents(): CurrentWebContents {
  return window.electron.remote.getCurrentWebContents();
}
