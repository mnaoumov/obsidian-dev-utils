// @vitest-environment jsdom

import {
  afterAll,
  afterEach,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi
} from 'vitest';

import {
  appendCodeBlock,
  createDivAsync,
  createElAsync,
  createFragmentAsync,
  createSpanAsync,
  createSvgAsync,
  ensureLoaded,
  getZIndex,
  isElementVisibleInOffsetParent,
  isLoaded,
  onAncestorScrollOrResize,
  toPx
} from '../src/HTMLElement.ts';
import type { GenericObject } from '../src/TypeGuards.ts';

import {
  assertNonNullable,
  ensureGenericObject
} from '../src/TypeGuards.ts';

// Obsidian provides these globals at runtime; define them for jsdom.
beforeAll(() => {
  vi.stubGlobal('createDiv', vi.fn((_o?: DomElementInfo | string) => document.createElement('div')));
  vi.stubGlobal('createEl', vi.fn((tag: keyof HTMLElementTagNameMap, _o?: DomElementInfo | string) => document.createElement(tag)));
  vi.stubGlobal('createSpan', vi.fn((_o?: DomElementInfo | string) => document.createElement('span')));
  vi.stubGlobal('createFragment', vi.fn(() => document.createDocumentFragment()));
  vi.stubGlobal(
    'createSvg',
    // eslint-disable-next-line no-undef -- SvgElementInfo is an Obsidian global type not available in jsdom.
    vi.fn((tag: keyof SVGElementTagNameMap, _o?: string | SvgElementInfo) => document.createElementNS('http://www.w3.org/2000/svg', tag))
  );
});

afterAll(() => {
  vi.unstubAllGlobals();
});

describe('toPx', () => {
  it.each([
    [0, '0px'],
    [42, '42px'],
    [-5, '-5px'],
    [3.14, '3.14px'],
    [100, '100px'],
    [-0.5, '-0.5px']
  ])('should convert %j to %j', (input: number, expected: string) => {
    expect(toPx(input)).toBe(expected);
  });
});

describe('createDivAsync', () => {
  it('should return the created div', async () => {
    const result = await createDivAsync();
    expect(result).toBeInstanceOf(HTMLDivElement);
  });

  it('should call createDiv with the provided options', async () => {
    await createDivAsync('my-class');
    expect(createDiv).toHaveBeenCalledWith('my-class');
  });

  it('should work without a callback', async () => {
    const result = await createDivAsync();
    expect(result).toBeInstanceOf(HTMLDivElement);
  });

  it('should call the sync callback with the div', async () => {
    const callback = vi.fn();
    await createDivAsync(undefined, callback);
    expect(callback).toHaveBeenCalledWith(expect.any(HTMLDivElement));
  });

  it('should call the async callback with the div', async () => {
    const callback = vi.fn(async () => {
      await Promise.resolve();
    });
    await createDivAsync(undefined, callback);
    expect(callback).toHaveBeenCalledWith(expect.any(HTMLDivElement));
  });

  it('should await the async callback before returning', async () => {
    let callbackCompleted = false;
    async function callback(): Promise<void> {
      await Promise.resolve();
      callbackCompleted = true;
    }
    await createDivAsync(undefined, callback);
    expect(callbackCompleted).toBe(true);
  });
});

describe('createElAsync', () => {
  it('should return the created element', async () => {
    const result = await createElAsync('p');
    expect(result).toBeInstanceOf(HTMLParagraphElement);
  });

  it('should call createEl with the tag and options', async () => {
    await createElAsync('p', 'my-class');
    expect(createEl).toHaveBeenCalledWith('p', 'my-class');
  });

  it('should work without a callback', async () => {
    const result = await createElAsync('p');
    expect(result).toBeInstanceOf(HTMLParagraphElement);
  });

  it('should call the sync callback with the element', async () => {
    const callback = vi.fn();
    await createElAsync('p', undefined, callback);
    expect(callback).toHaveBeenCalledWith(expect.any(HTMLParagraphElement));
  });

  it('should call the async callback with the element', async () => {
    const callback = vi.fn(async () => {
      await Promise.resolve();
    });
    await createElAsync('p', undefined, callback);
    expect(callback).toHaveBeenCalledWith(expect.any(HTMLParagraphElement));
  });

  it('should await the async callback before returning', async () => {
    let callbackCompleted = false;
    async function callback(): Promise<void> {
      await Promise.resolve();
      callbackCompleted = true;
    }
    await createElAsync('p', undefined, callback);
    expect(callbackCompleted).toBe(true);
  });
});

describe('createSpanAsync', () => {
  it('should return the created span', async () => {
    const result = await createSpanAsync();
    expect(result).toBeInstanceOf(HTMLSpanElement);
  });

  it('should call createSpan with the provided options', async () => {
    await createSpanAsync('my-class');
    expect(createSpan).toHaveBeenCalledWith('my-class');
  });

  it('should work without a callback', async () => {
    const result = await createSpanAsync();
    expect(result).toBeInstanceOf(HTMLSpanElement);
  });

  it('should call the sync callback with the span', async () => {
    const callback = vi.fn();
    await createSpanAsync(undefined, callback);
    expect(callback).toHaveBeenCalledWith(expect.any(HTMLSpanElement));
  });

  it('should call the async callback with the span', async () => {
    const callback = vi.fn(async () => {
      await Promise.resolve();
    });
    await createSpanAsync(undefined, callback);
    expect(callback).toHaveBeenCalledWith(expect.any(HTMLSpanElement));
  });

  it('should await the async callback before returning', async () => {
    let callbackCompleted = false;
    async function callback(): Promise<void> {
      await Promise.resolve();
      callbackCompleted = true;
    }
    await createSpanAsync(undefined, callback);
    expect(callbackCompleted).toBe(true);
  });
});

describe('createFragmentAsync', () => {
  it('should return the created fragment', async () => {
    const result = await createFragmentAsync();
    expect(result).toBeInstanceOf(DocumentFragment);
  });

  it('should work without a callback', async () => {
    const result = await createFragmentAsync();
    expect(result).toBeInstanceOf(DocumentFragment);
  });

  it('should call the sync callback with the fragment', async () => {
    const callback = vi.fn();
    await createFragmentAsync(callback);
    expect(callback).toHaveBeenCalledWith(expect.any(DocumentFragment));
  });

  it('should call the async callback with the fragment', async () => {
    const callback = vi.fn(async () => {
      await Promise.resolve();
    });
    await createFragmentAsync(callback);
    expect(callback).toHaveBeenCalledWith(expect.any(DocumentFragment));
  });

  it('should await the async callback before returning', async () => {
    let callbackCompleted = false;
    async function callback(): Promise<void> {
      await Promise.resolve();
      callbackCompleted = true;
    }
    await createFragmentAsync(callback);
    expect(callbackCompleted).toBe(true);
  });
});

describe('createSvgAsync', () => {
  it('should return the created svg element', async () => {
    const result = await createSvgAsync('svg');
    expect(result).toBeInstanceOf(SVGSVGElement);
  });

  it('should call createSvg with the tag and options', async () => {
    await createSvgAsync('svg', 'my-class');
    expect(createSvg).toHaveBeenCalledWith('svg', 'my-class');
  });

  it('should work without a callback', async () => {
    const result = await createSvgAsync('svg');
    expect(result).toBeInstanceOf(SVGSVGElement);
  });

  it('should call the sync callback with the svg element', async () => {
    const callback = vi.fn();
    await createSvgAsync('svg', undefined, callback);
    expect(callback).toHaveBeenCalledWith(expect.any(SVGSVGElement));
  });

  it('should call the async callback with the svg element', async () => {
    const callback = vi.fn(async () => {
      await Promise.resolve();
    });
    await createSvgAsync('svg', undefined, callback);
    expect(callback).toHaveBeenCalledWith(expect.any(SVGSVGElement));
  });

  it('should await the async callback before returning', async () => {
    let callbackCompleted = false;
    async function callback(): Promise<void> {
      await Promise.resolve();
      callbackCompleted = true;
    }
    await createSvgAsync('svg', undefined, callback);
    expect(callbackCompleted).toBe(true);
  });
});

describe('appendCodeBlock', () => {
  it('should call createEl on the element with strong tag and correct options', () => {
    const mockCreateEl = vi.fn();
    const el = createMockElement();
    el.createEl = mockCreateEl;
    appendCodeBlock(el, 'console.log("hello")');
    expect(mockCreateEl).toHaveBeenCalledWith(
      'strong',
      { cls: 'markdown-rendered code' },
      expect.any(Function)
    );
  });

  it('should call createEl on the strong element with code tag inside the callback', () => {
    const innerCreateEl = vi.fn();
    const mockStrong = createMockElement();
    mockStrong.createEl = innerCreateEl;
    const mockCreateEl = vi.fn((_tag: string, _opts: unknown, cb: (el: HTMLElement) => void) => {
      cb(mockStrong);
    });
    const el = createMockElement();
    el.createEl = mockCreateEl;
    appendCodeBlock(el, 'my-code');
    expect(innerCreateEl).toHaveBeenCalledWith('code', { text: 'my-code' });
  });

  it('should pass the code text correctly', () => {
    const innerCreateEl = vi.fn();
    const mockStrong = createMockElement();
    mockStrong.createEl = innerCreateEl;
    const mockCreateEl = vi.fn((_tag: string, _opts: unknown, cb: (el: HTMLElement) => void) => {
      cb(mockStrong);
    });
    const el = createMockElement();
    el.createEl = mockCreateEl;
    const code = 'const x = 42;';
    appendCodeBlock(el, code);
    expect(innerCreateEl).toHaveBeenCalledWith('code', { text: code });
  });
});

describe('getZIndex', () => {
  beforeEach(() => {
    vi.stubGlobal('getComputedStyle', vi.fn());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('should return the z-index from computed style when set', () => {
    const el = createMockElement();
    vi.mocked(getComputedStyle).mockReturnValue({ zIndex: '10' } as CSSStyleDeclaration);
    expect(getZIndex(el)).toBe(10);
  });

  it('should return 0 for an element with auto z-index and no parent', () => {
    const el = createMockElement();
    vi.mocked(getComputedStyle).mockReturnValue({ zIndex: 'auto' } as CSSStyleDeclaration);
    expect(getZIndex(el)).toBe(0);
  });

  it('should return parent z-index if child has auto', () => {
    const parent = createMockElement();
    const child = createMockElement(parent);
    vi.mocked(getComputedStyle).mockImplementation((target) => {
      if (target === child) {
        return { zIndex: 'auto' } as CSSStyleDeclaration;
      }
      if (target === parent) {
        return { zIndex: '5' } as CSSStyleDeclaration;
      }
      return { zIndex: 'auto' } as CSSStyleDeclaration;
    });
    expect(getZIndex(child)).toBe(5);
  });

  it('should return 0 if no ancestor has a numeric z-index', () => {
    const grandparent = createMockElement();
    const parent = createMockElement(grandparent);
    const child = createMockElement(parent);
    vi.mocked(getComputedStyle).mockReturnValue({ zIndex: 'auto' } as CSSStyleDeclaration);
    expect(getZIndex(child)).toBe(0);
  });

  it('should return negative z-index values', () => {
    const el = createMockElement();
    vi.mocked(getComputedStyle).mockReturnValue({ zIndex: '-3' } as CSSStyleDeclaration);
    expect(getZIndex(el)).toBe(-3);
  });

  it('should skip elements with empty z-index string', () => {
    const parent = createMockElement();
    const child = createMockElement(parent);
    vi.mocked(getComputedStyle).mockImplementation((target) => {
      if (target === child) {
        return { zIndex: '' } as CSSStyleDeclaration;
      }
      return { zIndex: '7' } as CSSStyleDeclaration;
    });
    expect(getZIndex(child)).toBe(7);
  });
});

describe('isLoaded', () => {
  describe('HTMLBodyElement', () => {
    afterEach(() => {
      vi.unstubAllGlobals();
    });

    it('should return true when document.readyState is complete', () => {
      const el = document.body;
      vi.stubGlobal('document', { readyState: 'complete' });
      expect(isLoaded(el)).toBe(true);
    });

    it('should return true when document.readyState is interactive', () => {
      const el = document.body;
      vi.stubGlobal('document', { readyState: 'interactive' });
      expect(isLoaded(el)).toBe(true);
    });

    it('should return false when document.readyState is loading', () => {
      const el = document.body;
      vi.stubGlobal('document', { readyState: 'loading' });
      expect(isLoaded(el)).toBe(false);
    });
  });

  describe('HTMLImageElement', () => {
    it('should return true when complete is true and naturalWidth > 0', () => {
      const el = createElement('img', {
        complete: true,
        naturalWidth: 100
      });
      expect(isLoaded(el)).toBe(true);
    });

    it('should return false when complete is false', () => {
      const el = createElement('img', {
        complete: false,
        naturalWidth: 100
      });
      expect(isLoaded(el)).toBe(false);
    });

    it('should return false when naturalWidth is 0', () => {
      const el = createElement('img', {
        complete: true,
        naturalWidth: 0
      });
      expect(isLoaded(el)).toBe(false);
    });
  });

  describe('HTMLIFrameElement', () => {
    it('should return true when contentDocument exists', () => {
      const el = createElement('iframe', {
        contentDocument: {}
      });
      expect(isLoaded(el)).toBe(true);
    });

    it('should return false when contentDocument is null', () => {
      const el = createElement('iframe', {
        contentDocument: null
      });
      expect(isLoaded(el)).toBe(false);
    });
  });

  describe('HTMLEmbedElement', () => {
    it('should return true when getSVGDocument returns truthy', () => {
      const el = createElement('embed', {
        getSVGDocument: vi.fn(() => ({}))
      });
      expect(isLoaded(el)).toBe(true);
    });

    it('should return false when getSVGDocument returns null', () => {
      const el = createElement('embed', {
        getSVGDocument: vi.fn(() => null)
      });
      expect(isLoaded(el)).toBe(false);
    });
  });

  describe('HTMLLinkElement', () => {
    it('should return true for stylesheet link with sheet set', () => {
      const el = createElement('link', {
        rel: 'stylesheet',
        sheet: {}
      });
      expect(isLoaded(el)).toBe(true);
    });

    it('should return false for stylesheet link with sheet null', () => {
      const el = createElement('link', { rel: 'stylesheet', sheet: null });
      expect(isLoaded(el)).toBe(false);
    });

    it('should return true for non-stylesheet link', () => {
      const el = createElement('link', { rel: 'icon', sheet: null });
      expect(isLoaded(el)).toBe(true);
    });
  });

  describe('HTMLObjectElement', () => {
    it('should return true when contentDocument exists', () => {
      const el = createElement('object', { contentDocument: {}, getSVGDocument: vi.fn(() => null) });
      expect(isLoaded(el)).toBe(true);
    });

    it('should return true when getSVGDocument returns truthy', () => {
      const el = createElement('object', { contentDocument: null, getSVGDocument: vi.fn(() => ({})) });
      expect(isLoaded(el)).toBe(true);
    });

    it('should return false when both contentDocument and getSVGDocument are falsy', () => {
      const el = createElement('object', { contentDocument: null, getSVGDocument: vi.fn(() => null) });
      expect(isLoaded(el)).toBe(false);
    });
  });

  describe('HTMLScriptElement', () => {
    it('should always return true', () => {
      const el = createElement('script');
      expect(isLoaded(el)).toBe(true);
    });
  });

  describe('HTMLStyleElement', () => {
    it('should return true when sheet is set', () => {
      const el = createElement('style', { sheet: {} });
      expect(isLoaded(el)).toBe(true);
    });

    it('should return false when sheet is null', () => {
      const el = createElement('style', { sheet: null });
      expect(isLoaded(el)).toBe(false);
    });
  });

  describe('HTMLTrackElement', () => {
    it('should return true when readyState is 2 (loaded)', () => {
      const el = createElement('track', { readyState: 2 });
      expect(isLoaded(el)).toBe(true);
    });

    it('should return false when readyState is not 2', () => {
      const el = createElement('track', { readyState: 0 });
      expect(isLoaded(el)).toBe(false);
    });

    it('should return false when readyState is 1', () => {
      const el = createElement('track', { readyState: 1 });
      expect(isLoaded(el)).toBe(false);
    });
  });

  describe('generic element', () => {
    it('should return true when element has no loadable children', () => {
      const el = createMockElement();
      expect(isLoaded(el)).toBe(true);
    });

    it('should return true when all loadable children are loaded', () => {
      const el = createMockElement();
      createMockElement(el);
      expect(isLoaded(el)).toBe(true);
    });

    it('should return false when a loadable child is not loaded', () => {
      const img = createElement('img', { complete: false, naturalWidth: 0 });
      const el = createMockElement();
      el.appendChild(img);
      expect(isLoaded(el)).toBe(false);
    });
  });
});

describe('isElementVisibleInOffsetParent', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('should return false when offsetParent is null', () => {
    const el = createElement('div', { offsetParent: null });
    expect(isElementVisibleInOffsetParent(el)).toBe(false);
  });

  it('should return true when element is fully within offset parent', () => {
    const parent = createMockElement();
    parent.getBoundingClientRect = vi.fn((): DOMRect => ({ bottom: 200, height: 200, left: 0, right: 200, toJSON: vi.fn(), top: 0, width: 200, x: 0, y: 0 }));
    const el = createElement('div', { offsetParent: parent });
    el.getBoundingClientRect = vi.fn((): DOMRect => ({ bottom: 100, height: 90, left: 10, right: 100, toJSON: vi.fn(), top: 10, width: 90, x: 10, y: 10 }));
    expect(isElementVisibleInOffsetParent(el)).toBe(true);
  });

  it('should return false when element extends above offset parent', () => {
    const parent = createMockElement();
    parent.getBoundingClientRect = vi.fn((): DOMRect => ({ bottom: 200, height: 150, left: 0, right: 200, toJSON: vi.fn(), top: 50, width: 200, x: 0, y: 50 }));
    const el = createMockElement(parent);
    el.getBoundingClientRect = vi.fn((): DOMRect => ({ bottom: 100, height: 90, left: 10, right: 100, toJSON: vi.fn(), top: 10, width: 90, x: 10, y: 10 }));
    expect(isElementVisibleInOffsetParent(el)).toBe(false);
  });

  it('should return false when element extends below offset parent', () => {
    const parent = createMockElement();
    parent.getBoundingClientRect = vi.fn((): DOMRect => ({ bottom: 100, height: 100, left: 0, right: 200, toJSON: vi.fn(), top: 0, width: 200, x: 0, y: 0 }));
    const el = createElement('div', { offsetParent: parent });
    el.getBoundingClientRect = vi.fn((): DOMRect => ({ bottom: 150, height: 140, left: 10, right: 100, toJSON: vi.fn(), top: 10, width: 90, x: 10, y: 10 }));
    expect(isElementVisibleInOffsetParent(el)).toBe(false);
  });

  it('should return false when element extends left of offset parent', () => {
    const parent = createMockElement();
    parent.getBoundingClientRect = vi.fn((): DOMRect => ({ bottom: 200, height: 150, left: 50, right: 200, toJSON: vi.fn(), top: 0, width: 150, x: 50, y: 0 }));
    const el = createElement('div', { offsetParent: parent });
    el.getBoundingClientRect = vi.fn((): DOMRect => ({ bottom: 100, height: 90, left: 10, right: 100, toJSON: vi.fn(), top: 10, width: 90, x: 10, y: 10 }));
    expect(isElementVisibleInOffsetParent(el)).toBe(false);
  });

  it('should return false when element extends right of offset parent', () => {
    const parent = createMockElement();
    parent.getBoundingClientRect = vi.fn((): DOMRect => ({ bottom: 200, height: 100, left: 0, right: 100, toJSON: vi.fn(), top: 0, width: 100, x: 0, y: 0 }));
    const el = createElement('div', { offsetParent: parent });
    el.getBoundingClientRect = vi.fn((): DOMRect => ({ bottom: 100, height: 90, left: 10, right: 150, toJSON: vi.fn(), top: 10, width: 140, x: 10, y: 10 }));
    expect(isElementVisibleInOffsetParent(el)).toBe(false);
  });

  it('should return true when element exactly matches offset parent bounds', () => {
    const parent = createMockElement();
    parent.getBoundingClientRect = vi.fn((): DOMRect => ({ bottom: 100, height: 100, left: 0, right: 100, toJSON: vi.fn(), top: 0, width: 100, x: 0, y: 0 }));
    const el = createElement('div', { offsetParent: parent });
    el.getBoundingClientRect = vi.fn((): DOMRect => ({ bottom: 100, height: 100, left: 0, right: 100, toJSON: vi.fn(), top: 0, width: 100, x: 0, y: 0 }));
    expect(isElementVisibleInOffsetParent(el)).toBe(true);
  });
});

describe('onAncestorScrollOrResize', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('should return a cleanup function', () => {
    const node = createMockElement();
    const cleanup = onAncestorScrollOrResize(node, vi.fn());
    expect(typeof cleanup).toBe('function');
  });

  it('should add scroll and resize listeners to document, window, and the node', () => {
    const node = createMockElement();
    vi.spyOn(document, 'addEventListener');
    vi.spyOn(window, 'addEventListener');
    vi.spyOn(node, 'addEventListener');

    onAncestorScrollOrResize(node, vi.fn());

    expect(vi.mocked(document.addEventListener)).toHaveBeenCalledWith('scroll', expect.any(Function), { capture: true });
    expect(vi.mocked(document.addEventListener)).toHaveBeenCalledWith('resize', expect.any(Function), { capture: true });
    expect(vi.mocked(window.addEventListener)).toHaveBeenCalledWith('scroll', expect.any(Function), { capture: true });
    expect(vi.mocked(window.addEventListener)).toHaveBeenCalledWith('resize', expect.any(Function), { capture: true });
    expect(vi.mocked(node.addEventListener)).toHaveBeenCalledWith('scroll', expect.any(Function), { capture: true });
    expect(vi.mocked(node.addEventListener)).toHaveBeenCalledWith('resize', expect.any(Function), { capture: true });
  });

  it('should add listeners to ancestor nodes in the parent chain', () => {
    const grandparent = createMockElement();
    const parent = createMockElement(grandparent);
    const node = createMockElement(parent);

    vi.spyOn(node, 'addEventListener');
    vi.spyOn(parent, 'addEventListener');
    vi.spyOn(grandparent, 'addEventListener');

    onAncestorScrollOrResize(node, vi.fn());

    expect(vi.mocked(node.addEventListener)).toHaveBeenCalledWith('scroll', expect.any(Function), { capture: true });
    expect(vi.mocked(parent.addEventListener)).toHaveBeenCalledWith('scroll', expect.any(Function), { capture: true });
    expect(vi.mocked(grandparent.addEventListener)).toHaveBeenCalledWith('scroll', expect.any(Function), { capture: true });
  });

  it('should remove all listeners when cleanup is called', () => {
    const node = createMockElement();
    const cleanup = onAncestorScrollOrResize(node, vi.fn());

    const documentRemoveEventListeners = vi.fn();
    document.removeEventListener = documentRemoveEventListeners;
    const windowRemoveEventListeners = vi.fn();
    window.removeEventListener = windowRemoveEventListeners;
    const nodeRemoveEventListeners = vi.fn();
    node.removeEventListener = nodeRemoveEventListeners;

    cleanup();

    expect(documentRemoveEventListeners).toHaveBeenCalledWith(
      'scroll',
      expect.any(Function),
      { capture: true }
    );
    expect(documentRemoveEventListeners).toHaveBeenCalledWith(
      'resize',
      expect.any(Function),
      { capture: true }
    );
    expect(windowRemoveEventListeners).toHaveBeenCalledWith(
      'scroll',
      expect.any(Function),
      { capture: true }
    );
    expect(windowRemoveEventListeners).toHaveBeenCalledWith(
      'resize',
      expect.any(Function),
      { capture: true }
    );
    expect(nodeRemoveEventListeners).toHaveBeenCalledWith(
      'scroll',
      expect.any(Function),
      { capture: true }
    );
    expect(nodeRemoveEventListeners).toHaveBeenCalledWith(
      'resize',
      expect.any(Function),
      { capture: true }
    );
  });

  it('should invoke the callback via requestAnimationFrame when a scroll event fires', () => {
    vi.spyOn(window, 'requestAnimationFrame').mockImplementation((cb: FrameRequestCallback) => {
      cb(0);
      return 0;
    });

    const node = createMockElement();
    const callback = vi.fn();
    onAncestorScrollOrResize(node, callback);

    node.dispatchEvent(new Event('scroll'));

    expect(vi.mocked(window.requestAnimationFrame)).toHaveBeenCalled();
    expect(callback).toHaveBeenCalledTimes(1);
  });

  it('should debounce multiple rapid event triggers', () => {
    vi.spyOn(window, 'requestAnimationFrame').mockImplementation((_cb: FrameRequestCallback) => 0);

    const node = createMockElement();
    const callback = vi.fn();
    onAncestorScrollOrResize(node, callback);

    // Trigger scroll multiple times before requestAnimationFrame fires
    node.dispatchEvent(new Event('scroll'));
    node.dispatchEvent(new Event('scroll'));
    node.dispatchEvent(new Event('scroll'));

    // RequestAnimationFrame should only be called once because isEventTriggered guards
    expect(vi.mocked(window.requestAnimationFrame)).toHaveBeenCalledTimes(1);
  });

  it('should allow new events after requestAnimationFrame callback completes', () => {
    vi.spyOn(window, 'requestAnimationFrame').mockImplementation((cb: FrameRequestCallback) => {
      cb(0);
      return 0;
    });

    const node = createMockElement();
    const callback = vi.fn();
    onAncestorScrollOrResize(node, callback);

    // First event
    node.dispatchEvent(new Event('scroll'));
    expect(callback).toHaveBeenCalledTimes(1);

    // Second event after first completes
    node.dispatchEvent(new Event('scroll'));
    expect(vi.mocked(window.requestAnimationFrame)).toHaveBeenCalledTimes(2);
    expect(callback).toHaveBeenCalledTimes(2);
  });

  it('should reset isEventTriggered even if callback throws', () => {
    const rafCallbacks: FrameRequestCallback[] = [];
    vi.spyOn(window, 'requestAnimationFrame').mockImplementation((cb: FrameRequestCallback) => {
      rafCallbacks.push(cb);
      return 0;
    });

    const node = createMockElement();
    const callback = vi.fn(() => {
      throw new Error('callback error');
    });
    onAncestorScrollOrResize(node, callback);

    // First scroll queues a raf callback
    node.dispatchEvent(new Event('scroll'));
    expect(vi.mocked(window.requestAnimationFrame)).toHaveBeenCalledTimes(1);

    // Execute the raf callback — it throws but try/finally should reset isEventTriggered
    const firstCallback = rafCallbacks[0];
    assertNonNullable(firstCallback);
    expect(() => {
      firstCallback(0);
    }).toThrow('callback error');

    // If isEventTriggered was properly reset, a second scroll should queue another raf
    node.dispatchEvent(new Event('scroll'));
    expect(vi.mocked(window.requestAnimationFrame)).toHaveBeenCalledTimes(2);
  });
});

describe('ensureLoaded', () => {
  it('should resolve immediately when element is already loaded', async () => {
    const el = createMockElement();
    await expect(ensureLoaded(el)).resolves.toBeUndefined();
  });

  it('should resolve immediately for a generic element with no loadable children', async () => {
    const el = createMockElement();
    await expect(ensureLoaded(el)).resolves.toBeUndefined();
  });

  it('should wait for load event on an unloaded image', async () => {
    const el = createElement('img', {
      complete: false,
      naturalWidth: 0
    });

    const promise = ensureLoaded(el);
    el.dispatchEvent(new Event('load'));

    await expect(promise).resolves.toBeUndefined();
  });

  it('should wait for error event on an unloaded image', async () => {
    const el = createElement('img', {
      complete: false,
      naturalWidth: 0
    });

    const promise = ensureLoaded(el);
    el.dispatchEvent(new Event('error'));

    await expect(promise).resolves.toBeUndefined();
  });

  it('should recursively ensure all loadable children are loaded for generic elements', async () => {
    const script = createElement('script');
    const el = createMockElement();
    el.appendChild(script);
    await expect(ensureLoaded(el)).resolves.toBeUndefined();
  });

  it('should recursively wait for unloaded children inside a generic element', async () => {
    const img = createElement('img', {
      complete: false,
      naturalWidth: 0
    });
    const el = createMockElement();
    el.appendChild(img);

    const promise = ensureLoaded(el);
    img.dispatchEvent(new Event('load'));

    await expect(promise).resolves.toBeUndefined();
  });

  it('should wait for load on an unloaded iframe', async () => {
    const el = createElement('iframe', {
      contentDocument: null
    });

    const promise = ensureLoaded(el);
    el.dispatchEvent(new Event('load'));

    await expect(promise).resolves.toBeUndefined();
  });

  it('should wait for load on an unloaded style element', async () => {
    const el = createElement('style', {
      sheet: null
    });

    const promise = ensureLoaded(el);
    el.dispatchEvent(new Event('load'));

    await expect(promise).resolves.toBeUndefined();
  });
});

function createElement(tag: string, attrs: GenericObject = {}): HTMLElement {
  const el = document.createElement(tag);
  const record = ensureGenericObject(el);

  for (const [key, value] of Object.entries(attrs)) {
    Object.defineProperty(record, key, { value });
  }

  return el;
}

function createMockElement(parent?: HTMLElement): HTMLElement {
  const el = createElement('div');
  parent?.appendChild(el);
  return el;
}
