/**
 * @file
 *
 * Mobile-only trusted input helpers. There is no in-renderer route to a trusted event on a phone —
 * `webContents.sendInputEvent` is Electron-only and a dispatched event is untrusted — so the injection
 * has to be a round-trip: the request goes to the host over the `obsidian-integration-testing` harness's
 * binding channel, and the host injects it into the WebView over CDP.
 *
 * That channel is installed by the harness's Appium transport, so these helpers **delegate** to the
 * harness rather than reimplementing the wire format: they call
 * `window.__obsidianIntegrationTesting.trustedInput.*`, which holds the very function objects the harness
 * seeds into an `evalInObsidian` closure's `lib` bag. Delegating is what keeps the mobile semantics —
 * tap, long-press for `button: 'right'`, a throw for `'middle'`, the `pressKey` key set, and the throws
 * for the `:hover` helpers — identical to the harness's own copy for free, instead of a second
 * implementation to hand-sync (see the project `AGENTS.md` **L4**).
 *
 * The namespace shape is declared **locally**: the harness must never be a dependency of this library, in
 * either direction, at runtime or in types.
 *
 * **Consequence, and it is deliberate:** these helpers only work inside an app the harness bootstrapped.
 * Outside one they throw a message saying so, rather than silently doing nothing — a no-op would recreate
 * exactly the false-confidence failure trusted input exists to end. Consumers wanting the platform-correct
 * helper should import the {@link ../trusted-input.ts | trusted-input} facade instead of this module.
 */

import type {
  ClickElementParams,
  ClickMouseParams,
  HoverElementParams,
  MoveMouseParams,
  PressKeyParams,
  TypeIntoEditorParams,
  UnhoverElementParams
  // The parameter contracts live with the desktop twin and are shared verbatim, so the two platforms
  // Cannot drift apart on what a caller passes. A type-only import loads nothing (L5).
} from './desktop-trusted-input.ts';

/**
 * The global the harness bootstraps its namespace onto.
 */
interface ObsidianIntegrationTestingHolder {
  __obsidianIntegrationTesting: ObsidianIntegrationTestingNamespace;
}

/**
 * The part of the harness namespace this module reads. Everything else on it is none of this module's
 * business.
 */
interface ObsidianIntegrationTestingNamespace {
  trustedInput?: Partial<TrustedInputSeam>;
}

/**
 * The trusted-input seam the `obsidian-integration-testing` harness publishes on its namespace.
 *
 * Declared here rather than imported: the harness is not a dependency of this library. It mirrors
 * `namespace-bootstrap.ts`'s `trustedInput` object, and the mirroring is by hand — the same
 * behavioral-sync obligation the desktop twin carries.
 */
interface TrustedInputSeam {
  clickElement(params: ClickElementParams): Promise<void>;
  clickMouse(params: ClickMouseParams): Promise<void>;
  hoverElement(params: HoverElementParams): Promise<void>;
  moveMouse(params: MoveMouseParams): Promise<void>;
  pressKey(params: PressKeyParams): Promise<void>;
  typeIntoEditor(params: TypeIntoEditorParams): Promise<void>;
  unhoverElement(params: UnhoverElementParams): Promise<void>;
}

/**
 * Clicks the center of an element using **trusted** touch input — a CDP tap in the WebView, injected by
 * the host.
 *
 * The element-relative counterpart of {@link clickMouse}. `button: 'right'` is the long-press that opens
 * Obsidian Mobile's context menu; `'middle'` throws, because touch has no gesture for it and inventing
 * one would be worse than saying so.
 *
 * @param params - The element to click, the button to press and any modifiers to hold.
 * @returns A {@link Promise} that resolves once the click has been injected.
 */
export async function clickElement(params: ClickElementParams): Promise<void> {
  await getSeamFunction('clickElement')(params);
}

/**
 * Clicks at the given viewport coordinates using **trusted** touch input, injected by the host over CDP.
 *
 * The coordinates are CSS pixels in the WebView's own viewport — which is what CDP takes — so
 * `devicePixelRatio` never enters the picture.
 *
 * @param params - The viewport coordinates to click at, the button to press and any modifiers to hold.
 * @returns A {@link Promise} that resolves once the click has been injected.
 */
export async function clickMouse(params: ClickMouseParams): Promise<void> {
  await getSeamFunction('clickMouse')(params);
}

/**
 * Always throws: `:hover` has no touch equivalent.
 *
 * A silent no-op here would let a hover test pass on a phone without hovering anything, so the mobile arm
 * refuses instead. Gate the assertion on `Platform.isDesktopApp`, or drive the element with
 * {@link clickElement}.
 *
 * @param params - The element to hover.
 * @returns A {@link Promise} that never resolves — the call throws.
 */
export async function hoverElement(params: HoverElementParams): Promise<void> {
  await getSeamFunction('hoverElement')(params);
}

/**
 * Always throws: a touch screen has no persistent pointer to move.
 *
 * @param params - The viewport coordinates to move to.
 * @returns A {@link Promise} that never resolves — the call throws.
 */
export async function moveMouse(params: MoveMouseParams): Promise<void> {
  await getSeamFunction('moveMouse')(params);
}

/**
 * Presses a single key using **trusted** keyboard input, injected by the host over CDP.
 *
 * Named keys (`'Enter'`, `'Escape'`, `'Tab'`, `'Backspace'`, `'Delete'`, the arrows) and single printable
 * characters are supported; anything else throws rather than pressing nothing.
 *
 * @param params - The key to press and any modifiers to hold.
 * @returns A {@link Promise} that resolves once the key press has been injected.
 */
export async function pressKey(params: PressKeyParams): Promise<void> {
  await getSeamFunction('pressKey')(params);
}

/**
 * Types text into a CodeMirror editor using **trusted** keyboard input, injected by the host over CDP.
 *
 * Focuses the editor (caret to the end), presses every code point of the text, then polls until the
 * document reflects the input or a bounded timeout elapses.
 *
 * @param params - The editor to type into and the text to type.
 * @returns A {@link Promise} that resolves once the keystrokes have settled.
 */
export async function typeIntoEditor(params: TypeIntoEditorParams): Promise<void> {
  await getSeamFunction('typeIntoEditor')(params);
}

/**
 * Always throws, for the same reason as {@link hoverElement}: there is no `:hover` state to clear.
 *
 * @param params - The element to move the pointer away from.
 * @returns A {@link Promise} that never resolves — the call throws.
 */
export async function unhoverElement(params: UnhoverElementParams): Promise<void> {
  await getSeamFunction('unhoverElement')(params);
}

function getSeamFunction<Key extends keyof TrustedInputSeam>(name: Key): TrustedInputSeam[Key] {
  // eslint-disable-next-line obsidianmd/no-global-this -- The harness installs its namespace on the realm global; there is nowhere else to read it from.
  const holder = globalThis as Partial<ObsidianIntegrationTestingHolder>;
  const seamFunction = holder.__obsidianIntegrationTesting?.trustedInput?.[name];
  if (!seamFunction) {
    throw new Error(
      `Trusted input is unavailable on mobile: \`window.__obsidianIntegrationTesting.trustedInput.${name}\` is not installed. `
        + 'A phone has no in-renderer route to a trusted event, so the injection is a round-trip to the host over the '
        + '`obsidian-integration-testing` Appium transport\'s channel — which means these helpers only work inside an app that '
        + 'harness bootstrapped.'
    );
  }

  return seamFunction;
}
