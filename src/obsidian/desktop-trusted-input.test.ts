// @vitest-environment jsdom

import type { Editor as EditorOriginal } from 'obsidian';

import { Platform } from 'obsidian';
import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  vi
} from 'vitest';

import { strictProxy } from '../strict-proxy.ts';
import {
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

function createElement(rect: DOMRect, matchesHover: () => boolean): HTMLElement {
  return strictProxy<HTMLElement>({
    getBoundingClientRect: (): DOMRect => rect,
    matches: (selector: string): boolean => selector === ':hover' && matchesHover()
  });
}

function createRect(overrides: Partial<DOMRect>): DOMRect {
  return strictProxy<DOMRect>(overrides);
}

describe('moveMouse', () => {
  it('should send a trusted mouseMove with rounded coordinates', () => {
    moveMouse({ x: 10.7, y: 20.2 });
    expect(sendInputEvent).toHaveBeenCalledExactlyOnceWith({ type: 'mouseMove', x: 11, y: 20 });
  });
});

describe('pressKey', () => {
  it('should inject a trusted keyDown -> char -> keyUp sequence with no modifiers', () => {
    vi.spyOn(Platform, 'isMacOS', 'get').mockReturnValue(false);
    pressKey({ key: 'a' });
    expect(sendInputEvent).toHaveBeenCalledTimes(3);
    expect(sendInputEvent).toHaveBeenNthCalledWith(1, { keyCode: 'a', modifiers: [], type: 'keyDown' });
    expect(sendInputEvent).toHaveBeenNthCalledWith(2, { keyCode: 'a', modifiers: [], type: 'char' });
    expect(sendInputEvent).toHaveBeenNthCalledWith(3, { keyCode: 'a', modifiers: [], type: 'keyUp' });
  });

  it('should map Mod to meta on macOS', () => {
    vi.spyOn(Platform, 'isMacOS', 'get').mockReturnValue(true);
    pressKey({ key: 'a', modifiers: ['Mod'] });
    expect(sendInputEvent).toHaveBeenNthCalledWith(1, { keyCode: 'a', modifiers: ['meta'], type: 'keyDown' });
  });

  it('should map Mod to control off macOS', () => {
    vi.spyOn(Platform, 'isMacOS', 'get').mockReturnValue(false);
    pressKey({ key: 'a', modifiers: ['Mod'] });
    expect(sendInputEvent).toHaveBeenNthCalledWith(1, { keyCode: 'a', modifiers: ['control'], type: 'keyDown' });
  });

  it('should map Ctrl to control', () => {
    vi.spyOn(Platform, 'isMacOS', 'get').mockReturnValue(false);
    pressKey({ key: 'a', modifiers: ['Ctrl'] });
    expect(sendInputEvent).toHaveBeenNthCalledWith(1, { keyCode: 'a', modifiers: ['control'], type: 'keyDown' });
  });

  it('should lowercase other modifier names', () => {
    vi.spyOn(Platform, 'isMacOS', 'get').mockReturnValue(false);
    pressKey({ key: 'a', modifiers: ['Shift', 'Alt'] });
    expect(sendInputEvent).toHaveBeenNthCalledWith(1, { keyCode: 'a', modifiers: ['shift', 'alt'], type: 'keyDown' });
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
});
