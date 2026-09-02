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

function createElement(rect: DOMRect, doesMatchHover: () => boolean): HTMLElement {
  return strictProxy<HTMLElement>({
    getBoundingClientRect: (): DOMRect => rect,
    matches: (selector: string): boolean => selector === ':hover' && doesMatchHover()
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
    const editor = strictProxy<EditorOriginal>({
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
    const editor = strictProxy<EditorOriginal>({
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

  it('should stop polling after the timeout when the element never hovers', async () => {
    const element = createElement(createRect({ height: 10, left: 0, top: 0, width: 10 }), () => false);
    const promise = hoverElement({ element });
    await vi.advanceTimersByTimeAsync(INPUT_TIMEOUT_IN_MILLISECONDS);
    await promise;
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

  it('should move just right of the box when flush against the left viewport edge', async () => {
    const element = createElement(createRect({ height: 10, left: 0, right: 10, top: 0 }), () => false);
    const promise = unhoverElement({ element });
    expect(sendInputEvent).toHaveBeenCalledExactlyOnceWith({ type: 'mouseMove', x: 11, y: 5 });
    await vi.advanceTimersByTimeAsync(INPUT_POLL_INTERVAL_IN_MILLISECONDS);
    await promise;
  });

  it('should stop polling after the timeout when the element keeps matching :hover', async () => {
    const element = createElement(createRect({ height: 10, left: 5, right: 15, top: 0 }), () => true);
    const promise = unhoverElement({ element });
    await vi.advanceTimersByTimeAsync(INPUT_TIMEOUT_IN_MILLISECONDS);
    await promise;

    // The move is injected once; only the `:hover` check is polled.
    expect(sendInputEvent).toHaveBeenCalledExactlyOnceWith({ type: 'mouseMove', x: 4, y: 5 });
  });
});
