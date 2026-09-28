// @vitest-environment jsdom

import type {
  Editor as EditorOriginal,
  Modifier
} from 'obsidian';

import { Platform } from 'obsidian';
import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  vi
} from 'vitest';

import { castTo } from '../object-utils.ts';
import { strictProxy } from '../strict-proxy.ts';
import {
  clickElement,
  clickMouse,
  hoverElement,
  moveMouse,
  pressKey,
  typeIntoEditor,
  unhoverElement
} from './desktop-trusted-input.ts';

const FOCUS_SETTLE_DELAY_IN_MILLISECONDS = 300;
const INPUT_POLL_INTERVAL_IN_MILLISECONDS = 50;
const INPUT_TIMEOUT_IN_MILLISECONDS = 5000;

interface StubbedWebContents {
  sendInputEvent: ReturnType<typeof vi.fn>;
}

let sendInputEvent: ReturnType<typeof vi.fn>;

beforeEach(() => {
  sendInputEvent = vi.fn();
  vi.stubGlobal('electron', {
    remote: {
      getCurrentWebContents: (): StubbedWebContents => ({ sendInputEvent })
    }
  });
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  vi.useRealTimers();
});

function createDocument(defaultView: null | Window): Document {
  return strictProxy<Document>({ defaultView: castTo<Document['defaultView']>(defaultView) });
}

function createEditor(overrides: Partial<EditorOriginal>, defaultView: null | Window = window): EditorOriginal {
  return strictProxy<EditorOriginal>({
    cm: castTo<EditorOriginal['cm']>({ dom: { ownerDocument: createDocument(defaultView) } }),
    ...overrides
  });
}

function createElement(rect: DOMRect, doesMatchHover: () => boolean, defaultView: null | Window = window): HTMLElement {
  return strictProxy<HTMLElement>({
    getBoundingClientRect: (): DOMRect => rect,
    matches: (selector: string): boolean => selector === ':hover' && doesMatchHover(),
    ownerDocument: createDocument(defaultView)
  });
}

// A popout window: its own `electron` bridge answers with its own web contents.
function createPopoutWindow(popoutSendInputEvent: ReturnType<typeof vi.fn>): Window {
  return strictProxy<Window>({
    electron: castTo<Window['electron']>({
      remote: {
        getCurrentWebContents: (): StubbedWebContents => ({ sendInputEvent: popoutSendInputEvent })
      }
    })
  });
}

function createRect(overrides: Partial<DOMRect>): DOMRect {
  return strictProxy<DOMRect>(overrides);
}

describe('clickMouse', () => {
  beforeEach(() => {
    vi.spyOn(Platform, 'isMacOS', 'get').mockReturnValue(false);
  });

  it('should send a trusted mouseMove -> mouseDown -> mouseUp with rounded coordinates', async () => {
    await clickMouse({ x: 10.7, y: 20.2 });
    expect(sendInputEvent).toHaveBeenCalledTimes(3);
    expect(sendInputEvent).toHaveBeenNthCalledWith(1, { modifiers: [], type: 'mouseMove', x: 11, y: 20 });
    expect(sendInputEvent).toHaveBeenNthCalledWith(2, { button: 'left', clickCount: 1, modifiers: [], type: 'mouseDown', x: 11, y: 20 });
    expect(sendInputEvent).toHaveBeenNthCalledWith(3, { button: 'left', clickCount: 1, modifiers: [], type: 'mouseUp', x: 11, y: 20 });
  });

  it('should press the requested button', async () => {
    await clickMouse({ button: 'right', x: 1, y: 2 });
    expect(sendInputEvent).toHaveBeenNthCalledWith(2, { button: 'right', clickCount: 1, modifiers: [], type: 'mouseDown', x: 1, y: 2 });
    expect(sendInputEvent).toHaveBeenNthCalledWith(3, { button: 'right', clickCount: 1, modifiers: [], type: 'mouseUp', x: 1, y: 2 });
  });

  it('should map modifiers the same way pressKey does', async () => {
    await clickMouse({ modifiers: ['Mod', 'Shift'], x: 1, y: 2 });
    expect(sendInputEvent).toHaveBeenNthCalledWith(1, { modifiers: ['control', 'shift'], type: 'mouseMove', x: 1, y: 2 });
  });
});

describe('clickElement', () => {
  beforeEach(() => {
    vi.spyOn(Platform, 'isMacOS', 'get').mockReturnValue(false);
  });

  it('should click the center of the element with the left button by default', async () => {
    const element = createElement(createRect({ height: 10, left: 0, top: 0, width: 10 }), () => false);
    await clickElement({ element });
    expect(sendInputEvent).toHaveBeenNthCalledWith(1, { modifiers: [], type: 'mouseMove', x: 5, y: 5 });
    expect(sendInputEvent).toHaveBeenNthCalledWith(2, { button: 'left', clickCount: 1, modifiers: [], type: 'mouseDown', x: 5, y: 5 });
  });

  it('should forward the button and the modifiers', async () => {
    const element = createElement(createRect({ height: 4, left: 20, top: 30, width: 6 }), () => false);
    await clickElement({ button: 'middle', element, modifiers: ['Alt'] });
    expect(sendInputEvent).toHaveBeenNthCalledWith(2, { button: 'middle', clickCount: 1, modifiers: ['alt'], type: 'mouseDown', x: 23, y: 32 });
  });
});

describe('moveMouse', () => {
  it('should send a trusted mouseMove with rounded coordinates', async () => {
    await moveMouse({ x: 10.7, y: 20.2 });
    expect(sendInputEvent).toHaveBeenCalledExactlyOnceWith({ type: 'mouseMove', x: 11, y: 20 });
  });
});

describe('pressKey', () => {
  it('should inject a trusted keyDown -> char -> keyUp sequence with no modifiers', async () => {
    vi.spyOn(Platform, 'isMacOS', 'get').mockReturnValue(false);
    await pressKey({ key: 'a' });
    expect(sendInputEvent).toHaveBeenCalledTimes(3);
    expect(sendInputEvent).toHaveBeenNthCalledWith(1, { keyCode: 'a', modifiers: [], type: 'keyDown' });
    expect(sendInputEvent).toHaveBeenNthCalledWith(2, { keyCode: 'a', modifiers: [], type: 'char' });
    expect(sendInputEvent).toHaveBeenNthCalledWith(3, { keyCode: 'a', modifiers: [], type: 'keyUp' });
  });

  it('should map Mod to meta on macOS', async () => {
    vi.spyOn(Platform, 'isMacOS', 'get').mockReturnValue(true);
    await pressKey({ key: 'a', modifiers: ['Mod'] });
    expect(sendInputEvent).toHaveBeenNthCalledWith(1, { keyCode: 'a', modifiers: ['meta'], type: 'keyDown' });
  });

  it('should map Mod to control off macOS', async () => {
    vi.spyOn(Platform, 'isMacOS', 'get').mockReturnValue(false);
    await pressKey({ key: 'a', modifiers: ['Mod'] });
    expect(sendInputEvent).toHaveBeenNthCalledWith(1, { keyCode: 'a', modifiers: ['control'], type: 'keyDown' });
  });

  it('should map Ctrl to control', async () => {
    vi.spyOn(Platform, 'isMacOS', 'get').mockReturnValue(false);
    await pressKey({ key: 'a', modifiers: ['Ctrl'] });
    expect(sendInputEvent).toHaveBeenNthCalledWith(1, { keyCode: 'a', modifiers: ['control'], type: 'keyDown' });
  });

  it('should lowercase other modifier names', async () => {
    vi.spyOn(Platform, 'isMacOS', 'get').mockReturnValue(false);
    await pressKey({ key: 'a', modifiers: ['Shift', 'Alt'] });
    expect(sendInputEvent).toHaveBeenNthCalledWith(1, { keyCode: 'a', modifiers: ['shift', 'alt'], type: 'keyDown' });
  });

  it('should map Meta to meta', async () => {
    vi.spyOn(Platform, 'isMacOS', 'get').mockReturnValue(false);
    await pressKey({ key: 'a', modifiers: ['Meta'] });
    expect(sendInputEvent).toHaveBeenNthCalledWith(1, { keyCode: 'a', modifiers: ['meta'], type: 'keyDown' });
  });

  it('should throw for an unknown modifier', async () => {
    vi.spyOn(Platform, 'isMacOS', 'get').mockReturnValue(false);
    await expect(pressKey({ key: 'a', modifiers: [castTo<Modifier>('Unknown')] })).rejects.toThrow();
  });
});

describe('typeIntoEditor', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.spyOn(Platform, 'isMacOS', 'get').mockReturnValue(false);
  });

  it('should focus, press each key, and resolve once the document reflects the input', async () => {
    let value = 'start';
    const editor = createEditor({
      focus: vi.fn(),
      getLine: (): string => value,
      getValue: (): string => value,
      lastLine: (): number => 0,
      setCursor: vi.fn()
    });

    const promise = typeIntoEditor({ editor, text: 'ab' });
    await vi.advanceTimersByTimeAsync(FOCUS_SETTLE_DELAY_IN_MILLISECONDS);

    // Two characters, each a keyDown/char/keyUp triple.
    expect(sendInputEvent).toHaveBeenCalledTimes(6);

    value = 'started';
    await vi.advanceTimersByTimeAsync(INPUT_POLL_INTERVAL_IN_MILLISECONDS);
    await promise;
  });

  it('should stop polling after the timeout when the document never updates', async () => {
    const editor = createEditor({
      focus: vi.fn(),
      getLine: (): string => 'start',
      getValue: (): string => 'start',
      lastLine: (): number => 0,
      setCursor: vi.fn()
    });

    const promise = typeIntoEditor({ editor, text: 'a' });
    await vi.advanceTimersByTimeAsync(FOCUS_SETTLE_DELAY_IN_MILLISECONDS + INPUT_TIMEOUT_IN_MILLISECONDS);
    await promise;

    expect(sendInputEvent).toHaveBeenCalledTimes(3);
  });
});

describe('hoverElement', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  it('should move to the element center and resolve once it matches :hover', async () => {
    let isHovering = false;
    const element = createElement(createRect({ height: 10, left: 0, top: 0, width: 10 }), () => isHovering);

    const promise = hoverElement({ element });
    expect(sendInputEvent).toHaveBeenCalledExactlyOnceWith({ type: 'mouseMove', x: 5, y: 5 });

    isHovering = true;
    await vi.advanceTimersByTimeAsync(INPUT_POLL_INTERVAL_IN_MILLISECONDS);
    await promise;
  });

  it('should throw after the timeout when the element never hovers', async () => {
    const element = createElement(createRect({ height: 10, left: 0, top: 0, width: 10 }), () => false);
    const promise = hoverElement({ element });
    const rejection = expect(promise).rejects.toThrow('never matched `:hover`');
    await vi.advanceTimersByTimeAsync(INPUT_TIMEOUT_IN_MILLISECONDS);
    await rejection;
  });
});

describe('unhoverElement', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  it('should move just left of the box and resolve once it no longer matches :hover', async () => {
    let isHovering = true;
    const element = createElement(createRect({ height: 10, left: 5, right: 15, top: 0 }), () => isHovering);

    const promise = unhoverElement({ element });
    expect(sendInputEvent).toHaveBeenCalledExactlyOnceWith({ type: 'mouseMove', x: 4, y: 5 });

    isHovering = false;
    await vi.advanceTimersByTimeAsync(INPUT_POLL_INTERVAL_IN_MILLISECONDS);
    await promise;
  });

  /*
   * A layout box rarely lands on a whole pixel, and `moveMouse` rounds — so an offset taken from the raw
   * fractional edge rounds back onto the element's own pixel column and the pointer never leaves. Snapping
   * the edge outward first is what makes the offset a whole pixel of real clearance.
   */
  it('should snap a fractional left edge outward before applying the offset', async () => {
    const element = createElement(createRect({ height: 10, left: 859.796875, right: 1008, top: 704 }), () => false);
    await unhoverElement({ element });
    expect(sendInputEvent).toHaveBeenCalledExactlyOnceWith({ type: 'mouseMove', x: 858, y: 709 });
  });

  it('should move just right of the box when flush against the left viewport edge', async () => {
    const element = createElement(createRect({ height: 10, left: 0, right: 10, top: 0 }), () => false);
    const promise = unhoverElement({ element });
    expect(sendInputEvent).toHaveBeenCalledExactlyOnceWith({ type: 'mouseMove', x: 11, y: 5 });
    await vi.advanceTimersByTimeAsync(INPUT_POLL_INTERVAL_IN_MILLISECONDS);
    await promise;
  });

  it('should throw after the timeout when the element keeps matching :hover', async () => {
    const element = createElement(createRect({ height: 10, left: 5, right: 15, top: 0 }), () => true);
    const promise = unhoverElement({ element });
    const rejection = expect(promise).rejects.toThrow('still matched `:hover`');
    await vi.advanceTimersByTimeAsync(INPUT_TIMEOUT_IN_MILLISECONDS);
    await rejection;

    // The move is injected once; only the `:hover` check is polled.
    expect(sendInputEvent).toHaveBeenCalledExactlyOnceWith({ type: 'mouseMove', x: 4, y: 5 });
  });
});

/*
 * Every Obsidian popout is its own Electron web contents, and `remote.getCurrentWebContents()` answers for
 * the window whose bridge it is called through. So input aimed at a popout has to go through the popout's
 * own bridge; the main window's would deliver it to the main window instead.
 */
describe('popout windows', () => {
  let popoutSendInputEvent: ReturnType<typeof vi.fn>;
  let popoutWindow: Window;

  beforeEach(() => {
    vi.spyOn(Platform, 'isMacOS', 'get').mockReturnValue(false);
    popoutSendInputEvent = vi.fn();
    popoutWindow = createPopoutWindow(popoutSendInputEvent);
  });

  it('should press a key in the window it is given', async () => {
    await pressKey({ key: 'Escape', window: popoutWindow });
    expect(popoutSendInputEvent).toHaveBeenCalledTimes(3);
    expect(sendInputEvent).not.toHaveBeenCalled();
  });

  it('should press a key in the main window when given the main window', async () => {
    await pressKey({ key: 'Escape', window });
    expect(sendInputEvent).toHaveBeenCalledTimes(3);
  });

  it('should click and move in the window it is given', async () => {
    await clickMouse({ window: popoutWindow, x: 1, y: 2 });
    await moveMouse({ window: popoutWindow, x: 3, y: 4 });
    expect(popoutSendInputEvent).toHaveBeenCalledTimes(4);
    expect(popoutSendInputEvent).toHaveBeenLastCalledWith({ type: 'mouseMove', x: 3, y: 4 });
    expect(sendInputEvent).not.toHaveBeenCalled();
  });

  it('should refuse a window that has no Electron bridge', async () => {
    const frameWindow = strictProxy<Window>({ electron: castTo<Window['electron']>(undefined) });
    await expect(pressKey({ key: 'Escape', window: frameWindow })).rejects.toThrow('no Electron bridge');
    expect(sendInputEvent).not.toHaveBeenCalled();
  });

  it('should click an element in the window that owns it', async () => {
    const element = createElement(createRect({ height: 10, left: 0, top: 0, width: 10 }), () => false, popoutWindow);
    await clickElement({ element });
    expect(popoutSendInputEvent).toHaveBeenNthCalledWith(1, { modifiers: [], type: 'mouseMove', x: 5, y: 5 });
    expect(sendInputEvent).not.toHaveBeenCalled();
  });

  it('should fall back to the main window for an element whose document has no window', async () => {
    const element = createElement(createRect({ height: 10, left: 0, top: 0, width: 10 }), () => false, null);
    await clickElement({ element });
    expect(sendInputEvent).toHaveBeenCalledTimes(3);
  });

  it('should hover and unhover an element in the window that owns it', async () => {
    let isHovering = true;
    const element = createElement(createRect({ height: 10, left: 5, right: 15, top: 0, width: 10 }), () => isHovering, popoutWindow);
    await hoverElement({ element });
    isHovering = false;
    await unhoverElement({ element });
    expect(popoutSendInputEvent).toHaveBeenNthCalledWith(1, { type: 'mouseMove', x: 10, y: 5 });
    expect(popoutSendInputEvent).toHaveBeenNthCalledWith(2, { type: 'mouseMove', x: 4, y: 5 });
    expect(sendInputEvent).not.toHaveBeenCalled();
  });

  describe('typeIntoEditor', () => {
    beforeEach(() => {
      vi.useFakeTimers();
    });

    it('should type into an editor in the window that owns it', async () => {
      let value = 'start';
      const editor = createEditor({
        focus: vi.fn(),
        getLine: (): string => value,
        getValue: (): string => value,
        lastLine: (): number => 0,
        setCursor: vi.fn()
      }, popoutWindow);

      const promise = typeIntoEditor({ editor, text: 'a' });
      await vi.advanceTimersByTimeAsync(FOCUS_SETTLE_DELAY_IN_MILLISECONDS);
      value = 'started';
      await vi.advanceTimersByTimeAsync(INPUT_POLL_INTERVAL_IN_MILLISECONDS);
      await promise;

      expect(popoutSendInputEvent).toHaveBeenCalledTimes(3);
      expect(sendInputEvent).not.toHaveBeenCalled();
    });

    it('should type into the main window when the editor document has no window', async () => {
      let value = 'start';
      const editor = createEditor({
        focus: vi.fn(),
        getLine: (): string => value,
        getValue: (): string => value,
        lastLine: (): number => 0,
        setCursor: vi.fn()
      }, null);

      const promise = typeIntoEditor({ editor, text: 'a' });
      await vi.advanceTimersByTimeAsync(FOCUS_SETTLE_DELAY_IN_MILLISECONDS);
      value = 'started';
      await vi.advanceTimersByTimeAsync(INPUT_POLL_INTERVAL_IN_MILLISECONDS);
      await promise;

      expect(sendInputEvent).toHaveBeenCalledTimes(3);
    });
  });
});
