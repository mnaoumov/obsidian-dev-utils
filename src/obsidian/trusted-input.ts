/**
 * @file
 *
 * Trusted input helpers that work on **either platform** — the documented entry point for keystrokes,
 * pointer moves and clicks that Obsidian actually believes.
 *
 * Untrusted input (`element.dispatchEvent(new MouseEvent('click'))`) is silently ignored by CodeMirror,
 * by the CSS `:hover` engine and by every `e.isTrusted` guard in Obsidian, so a test driving it exercises
 * nothing while still passing. A trusted event has to come from outside the renderer, and how it gets
 * there is platform-specific: Electron's `webContents.sendInputEvent` on desktop, a CDP injection
 * round-tripped through the harness's host channel on mobile.
 *
 * This module **internalizes that split** (see the project `AGENTS.md` **L6**): it stays
 * cross-platform-loadable — no platform-only module is on its import graph — and each helper defers to a
 * `Platform`-gated call-time dynamic `import()` of the arm that fits. So a consumer writes
 * `await clickElement({ element })` once and never a platform check.
 *
 * The arms remain importable directly, for a caller making a deliberate platform commitment:
 * {@link ./desktop-trusted-input.ts | desktop-trusted-input} and
 * {@link ./mobile-trusted-input.ts | mobile-trusted-input}. Prefer this facade otherwise.
 *
 * **Every helper must be awaited.** The desktop arm has nothing to wait for, but the mobile arm's
 * injection is a round-trip to the host, so a missing `await` lets the assertion run before the input has
 * landed. The signature is the same on both platforms precisely so that a suite growing a mobile lane
 * does not have to be rewritten.
 *
 * **Not every helper survives the port.** `moveMouse`, `hoverElement` and `unhoverElement` **throw** on
 * mobile: a touch screen has no persistent pointer and `:hover` has no touch equivalent. They throw
 * rather than no-op, because a silent no-op is exactly the false confidence trusted input exists to end.
 * Gate those on `Platform.isDesktopApp`, or drive the element with {@link clickElement} instead.
 */

import { Platform } from 'obsidian';

import type {
  ClickElementParams,
  ClickMouseParams,
  HoverElementParams,
  MoveMouseParams,
  PressKeyParams,
  TypeIntoEditorParams,
  UnhoverElementParams
} from './desktop-trusted-input.ts';

export type {
  ClickElementParams,
  ClickMouseParams,
  HoverElementParams,
  MouseButton,
  MoveMouseParams,
  PressKeyParams,
  TypeIntoEditorParams,
  UnhoverElementParams
} from './desktop-trusted-input.ts';

// The seven helpers both arms export, with identical signatures. Typed off the mobile arm because it
// Exports nothing else; the desktop arm additionally exports the parameter contracts both share.
type TrustedInputArm = typeof import('./mobile-trusted-input.ts');

/**
 * Clicks the center of an element using **trusted** input — Electron's `sendInputEvent` on desktop, a CDP
 * touch tap in the WebView on mobile.
 *
 * The element-relative counterpart of {@link clickMouse}, mirroring the {@link moveMouse} /
 * {@link hoverElement} split. Use {@link clickMouse} directly when the point to click is **not** the
 * element's center — the markdown editor's margin, for instance, lies inside `cm.scrollDOM` but outside
 * `.cm-sizer`, so no element's center lands on it.
 *
 * @param params - The element to click, the button to press and any modifiers to hold.
 * @returns A {@link Promise} that resolves once the click has been injected.
 */
export async function clickElement(params: ClickElementParams): Promise<void> {
  const arm = await loadArm();
  await arm.clickElement(params);
}

/**
 * Clicks at the given viewport coordinates using **trusted** input, so the renderer synthesizes a real
 * `click` (or `contextmenu`, for the right button) with `isTrusted === true`.
 *
 * The low-level primitive: one click at one point, with no waiting for any effect — callers poll their own
 * readiness signal. Prefer {@link clickElement} for element-relative clicks.
 *
 * A real context menu actually opens, so a suite driving a right click must close it (or remove the
 * leftover `.menu` element) before the next test.
 *
 * **On mobile the button model does not survive the port**: touch has no buttons, so `'left'` (the
 * default) is a **tap**, `'right'` is the **long-press** that opens Obsidian Mobile's context menu, and
 * `'middle'` throws.
 *
 * @param params - The viewport coordinates to click at, the button to press and any modifiers to hold.
 * @returns A {@link Promise} that resolves once the click has been injected.
 */
export async function clickMouse(params: ClickMouseParams): Promise<void> {
  const arm = await loadArm();
  await arm.clickMouse(params);
}

/**
 * Moves the pointer to the center of an element using **trusted** pointer input, then polls until the
 * element actually matches `:hover`.
 *
 * **Desktop only** — it throws on mobile, where `:hover` has no touch equivalent.
 *
 * @param params - The element to hover.
 * @returns A {@link Promise} that resolves once the element matches `:hover`.
 */
export async function hoverElement(params: HoverElementParams): Promise<void> {
  const arm = await loadArm();
  await arm.hoverElement(params);
}

/**
 * Moves the pointer to the given viewport coordinates using a **trusted** pointer move, so `:hover` rules
 * genuinely apply.
 *
 * The low-level primitive: a single move that does **not** wait for any state to settle. Prefer
 * {@link hoverElement} / {@link unhoverElement} for element-relative moves.
 *
 * **Desktop only** — it throws on mobile, which has no persistent pointer to move.
 *
 * @param params - The viewport coordinates to move to.
 * @returns A {@link Promise} that resolves once the move has been injected.
 */
export async function moveMouse(params: MoveMouseParams): Promise<void> {
  const arm = await loadArm();
  await arm.moveMouse(params);
}

/**
 * Presses a single key (optionally with modifiers) using **trusted** keyboard input, firing the full real
 * key pipeline — `keydown` → `keypress` → `beforeinput` → `input` → `keyup`.
 *
 * It is delivered to the window's DOM-focused element, so the caller focuses the target first and then
 * awaits the expected effect; the press itself polls for nothing. On mobile the accepted keys are the
 * named ones (`'Enter'`, `'Escape'`, `'Tab'`, `'Backspace'`, `'Delete'`, the arrows) plus single printable
 * characters — anything else throws rather than pressing nothing.
 *
 * @param params - The key to press and any modifiers to hold.
 * @returns A {@link Promise} that resolves once the key press has been injected.
 */
export async function pressKey(params: PressKeyParams): Promise<void> {
  const arm = await loadArm();
  await arm.pressKey(params);
}

/**
 * Types text into a CodeMirror editor using **trusted** keyboard input.
 *
 * Focuses the editor (caret to the end) and presses every code point of the text — the same trusted
 * sequence a real user produces — so the text reaches the document **only if the editor genuinely holds
 * focus**. Then it polls until the document reflects the input, or a bounded timeout elapses (the expected
 * outcome when the editor is read-only or focus was stolen).
 *
 * @param params - The editor to type into and the text to type.
 * @returns A {@link Promise} that resolves once the keystrokes have settled.
 */
export async function typeIntoEditor(params: TypeIntoEditorParams): Promise<void> {
  const arm = await loadArm();
  await arm.typeIntoEditor(params);
}

/**
 * Moves the pointer to a point just outside an element's bounding box using a **trusted** pointer move,
 * then polls until the element no longer matches `:hover`.
 *
 * The inverse of {@link hoverElement}. When an element spans the full viewport (no point outside its box
 * is reachable), use {@link moveMouse} directly to move the pointer to a known empty coordinate instead.
 *
 * **Desktop only** — it throws on mobile, for the same reason {@link hoverElement} does.
 *
 * @param params - The element to move the pointer away from.
 * @returns A {@link Promise} that resolves once the element no longer matches `:hover`.
 */
export async function unhoverElement(params: UnhoverElementParams): Promise<void> {
  const arm = await loadArm();
  await arm.unhoverElement(params);
}

async function loadArm(): Promise<TrustedInputArm> {
  // Conditional import of the platform-only arm, at call time: neither arm is on the other platform's
  // Load path, and the specifiers stay literal so esbuild bundles both.
  return Platform.isDesktopApp ? await import('./desktop-trusted-input.ts') : await import('./mobile-trusted-input.ts');
}
