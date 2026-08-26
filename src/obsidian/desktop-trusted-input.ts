/**
 * @file
 *
 * Desktop-only trusted input helpers that drive the real Electron renderer via
 * `webContents.sendInputEvent`, so keystrokes, pointer moves and clicks flow through the same trusted
 * input pipeline a real user produces (unlike untrusted `dispatchEvent`, which CodeMirror, the CSS
 * `:hover` engine and every `e.isTrusted` guard in Obsidian ignore).
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
 * Parameters for {@link clickElement}.
 */
export interface ClickElementParams {
  /**
   * The mouse button to click with.
   *
   * @default `'left'`
   */
  readonly button?: MouseButton;

  /**
   * The element to click. The pointer is moved to its center.
   */
  readonly element: HTMLElement;

  /**
   * The modifier keys to hold, using Obsidian's {@link Modifier} names. `'Mod'` resolves per-platform
   * (Cmd on macOS, Ctrl elsewhere).
   *
   * @default `[]`
   */
  readonly modifiers?: readonly Modifier[];
}

/**
 * Parameters for {@link clickMouse}.
 */
export interface ClickMouseParams {
  /**
   * The mouse button to click with.
   *
   * @default `'left'`
   */
  readonly button?: MouseButton;

  /**
   * The modifier keys to hold, using Obsidian's {@link Modifier} names. `'Mod'` resolves per-platform
   * (Cmd on macOS, Ctrl elsewhere).
   *
   * @default `[]`
   */
  readonly modifiers?: readonly Modifier[];

  /**
   * The x coordinate (web-contents DIP) to click at.
   */
  readonly x: number;

  /**
   * The y coordinate (web-contents DIP) to click at.
   */
  readonly y: number;
}

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
 * The mouse button a trusted click presses, in Electron's `sendInputEvent` spelling.
 */
export type MouseButton = NonNullable<ElectronMouseInputEvent['button']>;

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

// The pointer variant of the `sendInputEvent` union, picked out by the coordinates only it carries.
// Derived from the web-contents type so it stays in sync with the Electron typings.
type ElectronMouseInputEvent = Extract<Parameters<CurrentWebContents['sendInputEvent']>[0], PointerCoordinates>;

// The shape that discriminates a pointer `sendInputEvent` payload from a keyboard one.
interface PointerCoordinates {
  x: number;
}

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
 * The `clickCount` a single (non-double) trusted click carries.
 */
const SINGLE_CLICK_COUNT = 1;

/**
 * Clicks the center of an element using **trusted** Electron pointer input.
 *
 * The element-relative counterpart of {@link clickMouse}, mirroring the {@link moveMouse} /
 * {@link hoverElement} split. Use {@link clickMouse} directly when the point to click is **not** the
 * element's center — the markdown editor's margin, for instance, lies inside `cm.scrollDOM` but outside
 * `.cm-sizer`, so no element's center lands on it.
 *
 * @param params - The element to click, the button to press and any modifiers to hold.
 */
export function clickElement(params: ClickElementParams): void {
  const { button = 'left', element, modifiers = [] } = params;

  // Viewport coords equal web-contents DIP coords for the full-window `BrowserWindow`.
  const rect = element.getBoundingClientRect();
  clickMouse({
    button,
    modifiers,
    x: rect.left + rect.width / CENTER_DIVISOR,
    y: rect.top + rect.height / CENTER_DIVISOR
  });
}

/**
 * Clicks at the given web-contents coordinates using **trusted** Electron pointer input, so Chromium
 * synthesizes a real `click` (or `contextmenu`, for the right button) with `isTrusted === true`.
 *
 * This is what `element.dispatchEvent(new MouseEvent('click'))` cannot do: Obsidian and CodeMirror gate
 * on `isTrusted`, so a dispatched event silently exercises nothing while the test still passes. Obsidian
 * 1.13.7's markdown viewport (margin) menu, for example, opens from
 * `cm.scrollDOM.addEventListener('contextmenu', (e) => { if (!e.defaultPrevented && e.isTrusted && …) })`
 * — a dispatched `contextmenu` never gets past that check.
 *
 * It is the low-level primitive: a single trusted `mouseMove` → `mouseDown` → `mouseUp` at one point,
 * with no waiting for any effect (callers poll their own readiness signal). The leading move is what puts
 * the pointer over the hit-test target before the button goes down. Prefer {@link clickElement} for
 * element-relative clicks.
 *
 * @param params - The web-contents DIP coordinates to click at, the button to press and any modifiers to
 * hold.
 */
export function clickMouse(params: ClickMouseParams): void {
  const { button = 'left', modifiers = [], x, y } = params;

  const electronModifiers = toElectronModifiers(modifiers);
  const roundedX = Math.round(x);
  const roundedY = Math.round(y);
  const webContents = getWebContents();

  webContents.sendInputEvent({ modifiers: electronModifiers, type: 'mouseMove', x: roundedX, y: roundedY });
  webContents.sendInputEvent({
    button,
    clickCount: SINGLE_CLICK_COUNT,
    modifiers: electronModifiers,
    type: 'mouseDown',
    x: roundedX,
    y: roundedY
  });
  webContents.sendInputEvent({
    button,
    clickCount: SINGLE_CLICK_COUNT,
    modifiers: electronModifiers,
    type: 'mouseUp',
    x: roundedX,
    y: roundedY
  });
}

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

  const electronModifiers = toElectronModifiers(modifiers);
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

// Maps Obsidian's `Modifier` names to Electron's lowercase `sendInputEvent` modifier names.
// Shared by every trusted-input helper, so a key press and a click cannot disagree on `'Mod'`.
function toElectronModifiers(modifiers: readonly Modifier[]): ElectronModifier[] {
  // 'Mod' is Obsidian's platform-agnostic modifier: Cmd (meta) on macOS, Ctrl elsewhere.
  const isMacOS = Platform.isMacOS;

  return modifiers.map((modifier): ElectronModifier => {
    switch (modifier) {
      case 'Alt': {
        return 'alt';
      }
      case 'Ctrl': {
        return 'control';
      }
      case 'Meta': {
        return 'meta';
      }
      case 'Mod': {
        return isMacOS ? 'meta' : 'control';
      }
      case 'Shift': {
        return 'shift';
      }
      default: {
        return assertNever(modifier);
      }
    }
  });
}
