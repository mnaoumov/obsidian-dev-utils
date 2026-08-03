// @vitest-environment jsdom

import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  vi
} from 'vitest';

import type { GenericObject } from './type-guards.ts';

import { snapshot } from './array.ts';
import { dispose } from './disposable.ts';
import { noopAsync } from './function.ts';
import {
  createDivAsync,
  createElAsync,
  createFragmentAsync,
  createSpanAsync,
  createSvgAsync,
  ensureLoaded,
  getDocumentWindow,
  getZIndex,
  isElementVisibleInOffsetParent,
  isLoaded,
  onAncestorScrollOrResize,
  toPx,
  waitUntilConnected
} from './html-element.ts';
import { strictProxy } from './strict-proxy.ts';
import {
  assertNonNullable,
  ensureGenericObject
} from './type-guards.ts';

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

  it('should apply the provided class string to the div', async () => {
    const div = await createDivAsync('my-class');
    expect(div.className).toBe('my-class');
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
      await noopAsync();
    });
    await createDivAsync(undefined, callback);
    expect(callback).toHaveBeenCalledWith(expect.any(HTMLDivElement));
  });

  it('should await the async callback before returning', async () => {
    let wasCallbackCompleted = false;
    async function callback(): Promise<void> {
      await noopAsync();
      wasCallbackCompleted = true;
    }
    await createDivAsync(undefined, callback);
    expect(wasCallbackCompleted).toBe(true);
  });
});

describe('createElAsync', () => {
  it('should return the created element', async () => {
    const result = await createElAsync('p');
    expect(result).toBeInstanceOf(HTMLParagraphElement);
  });

  it('should create an element of the requested tag and apply a class string', async () => {
    const element = await createElAsync('p', 'my-class');
    expect(element.tagName).toBe('P');
    expect(element.className).toBe('my-class');
  });

  it('should apply an array of classes', async () => {
    const element = await createElAsync('p', { cls: ['class-a', 'class-b'] });
    expect(element.className).toBe('class-a class-b');
  });

  it('should apply text content', async () => {
    const element = await createElAsync('p', { text: 'hello' });
    expect(element.textContent).toBe('hello');
  });

  it('should apply a DocumentFragment as text content', async () => {
    const fragment = createFragment();
    fragment.append(createSpan());
    const element = await createElAsync('p', { text: fragment });
    expect(element.querySelector('span')).not.toBeNull();
  });

  it('should set and remove attributes (null removes)', async () => {
    const element = await createElAsync('p', { attr: { 'data-drop': null, 'data-keep': 'value' } });
    expect(element.getAttribute('data-keep')).toBe('value');
    expect(Object.hasOwn(element.dataset, 'drop')).toBe(false);
  });

  it('should apply the title', async () => {
    const element = await createElAsync('p', { title: 'my-title' });
    expect(element.title).toBe('my-title');
  });

  it('should append to the parent', async () => {
    const parent = createDiv();
    const element = await createElAsync('p', { parent });
    expect(parent.lastElementChild).toBe(element);
  });

  it('should prepend to the parent', async () => {
    const parent = createDiv();
    parent.append(createSpan());
    const element = await createElAsync('p', { parent, prepend: true });
    expect(parent.firstElementChild).toBe(element);
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
      await noopAsync();
    });
    await createElAsync('p', undefined, callback);
    expect(callback).toHaveBeenCalledWith(expect.any(HTMLParagraphElement));
  });

  it('should await the async callback before returning', async () => {
    let wasCallbackCompleted = false;
    async function callback(): Promise<void> {
      await noopAsync();
      wasCallbackCompleted = true;
    }
    await createElAsync('p', undefined, callback);
    expect(wasCallbackCompleted).toBe(true);
  });
});

describe('createSpanAsync', () => {
  it('should return the created span', async () => {
    const result = await createSpanAsync();
    expect(result).toBeInstanceOf(HTMLSpanElement);
  });

  it('should apply the provided class string to the span', async () => {
    const span = await createSpanAsync('my-class');
    expect(span.className).toBe('my-class');
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
      await noopAsync();
    });
    await createSpanAsync(undefined, callback);
    expect(callback).toHaveBeenCalledWith(expect.any(HTMLSpanElement));
  });

  it('should await the async callback before returning', async () => {
    let wasCallbackCompleted = false;
    async function callback(): Promise<void> {
      await noopAsync();
      wasCallbackCompleted = true;
    }
    await createSpanAsync(undefined, callback);
    expect(wasCallbackCompleted).toBe(true);
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
      await noopAsync();
    });
    await createFragmentAsync(callback);
    expect(callback).toHaveBeenCalledWith(expect.any(DocumentFragment));
  });

  it('should await the async callback before returning', async () => {
    let wasCallbackCompleted = false;
    async function callback(): Promise<void> {
      await noopAsync();
      wasCallbackCompleted = true;
    }
    await createFragmentAsync(callback);
    expect(wasCallbackCompleted).toBe(true);
  });
});

describe('createSvgAsync', () => {
  it('should return the created svg element', async () => {
    const result = await createSvgAsync('svg');
    expect(result).toBeInstanceOf(SVGSVGElement);
  });

  it('should apply the provided class string to the svg', async () => {
    const svg = await createSvgAsync('svg', 'my-class');
    expect(svg.classList.contains('my-class')).toBe(true);
  });

  it('should apply an array of classes to the svg', async () => {
    const svg = await createSvgAsync('svg', { cls: ['class-a', 'class-b'] });
    expect(svg.classList.contains('class-a')).toBe(true);
    expect(svg.classList.contains('class-b')).toBe(true);
  });

  it('should set attributes on the svg', async () => {
    const svg = await createSvgAsync('svg', { attr: { viewBox: '0 0 10 10' } });
    expect(svg.getAttribute('viewBox')).toBe('0 0 10 10');
  });

  it('should append the svg to the parent', async () => {
    const parent = createDiv();
    const svg = await createSvgAsync('svg', { parent });
    expect(parent.lastElementChild).toBe(svg);
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
      await noopAsync();
    });
    await createSvgAsync('svg', undefined, callback);
    expect(callback).toHaveBeenCalledWith(expect.any(SVGSVGElement));
  });

  it('should await the async callback before returning', async () => {
    let wasCallbackCompleted = false;
    async function callback(): Promise<void> {
      await noopAsync();
      wasCallbackCompleted = true;
    }
    await createSvgAsync('svg', undefined, callback);
    expect(wasCallbackCompleted).toBe(true);
  });
});

describe('getDocumentWindow', () => {
  it('should return the window the document belongs to', () => {
    expect(getDocumentWindow(document)).toBe(window);
  });

  it('should throw for a detached document', () => {
    // A document built this way has no window of its own.
    const detachedDoc = document.implementation.createHTMLDocument();

    expect(() => getDocumentWindow(detachedDoc)).toThrow('The document has no window');
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
    const element = buildElement();
    vi.mocked(getComputedStyle).mockReturnValue(strictProxy<CSSStyleDeclaration>({ zIndex: '10' }));
    expect(getZIndex(element)).toBe(10);
  });

  it('should return 0 for an element with auto z-index and no parent', () => {
    const element = buildElement();
    vi.mocked(getComputedStyle).mockReturnValue(strictProxy<CSSStyleDeclaration>({ zIndex: 'auto' }));
    expect(getZIndex(element)).toBe(0);
  });

  it('should return parent z-index if child has auto', () => {
    const parent = buildElement();
    const child = buildElement({ parent });
    vi.mocked(getComputedStyle).mockImplementation((target) => {
      if (target === child) {
        return strictProxy<CSSStyleDeclaration>({ zIndex: 'auto' });
      }
      if (target === parent) {
        return strictProxy<CSSStyleDeclaration>({ zIndex: '5' });
      }
      return strictProxy<CSSStyleDeclaration>({ zIndex: 'auto' });
    });
    expect(getZIndex(child)).toBe(5);
  });

  it('should return 0 if no ancestor has a numeric z-index', () => {
    const grandparent = buildElement();
    const parent = buildElement({ parent: grandparent });
    const child = buildElement({ parent });
    vi.mocked(getComputedStyle).mockReturnValue(strictProxy<CSSStyleDeclaration>({ zIndex: 'auto' }));
    expect(getZIndex(child)).toBe(0);
  });

  it('should return negative z-index values', () => {
    const element = buildElement();
    vi.mocked(getComputedStyle).mockReturnValue(strictProxy<CSSStyleDeclaration>({ zIndex: '-3' }));
    expect(getZIndex(element)).toBe(-3);
  });

  it('should skip elements with empty z-index string', () => {
    const parent = buildElement();
    const child = buildElement({ parent });
    vi.mocked(getComputedStyle).mockImplementation((target) => {
      if (target === child) {
        return strictProxy<CSSStyleDeclaration>({ zIndex: '' });
      }
      return strictProxy<CSSStyleDeclaration>({ zIndex: '7' });
    });
    expect(getZIndex(child)).toBe(7);
  });
});

describe('isLoaded', () => {
  describe('HTMLBodyElement', () => {
    afterEach(() => {
      vi.restoreAllMocks();
    });

    it('should return true when document.readyState is complete', () => {
      const element = activeDocument.body;
      vi.spyOn(activeDocument, 'readyState', 'get').mockReturnValue('complete');
      expect(isLoaded(element)).toBe(true);
    });

    it('should return true when document.readyState is interactive', () => {
      const element = activeDocument.body;
      vi.spyOn(activeDocument, 'readyState', 'get').mockReturnValue('interactive');
      expect(isLoaded(element)).toBe(true);
    });

    it('should return false when document.readyState is loading', () => {
      const element = activeDocument.body;
      vi.spyOn(activeDocument, 'readyState', 'get').mockReturnValue('loading');
      expect(isLoaded(element)).toBe(false);
    });
  });

  describe('HTMLImageElement', () => {
    it('should return true when complete is true and naturalWidth > 0', () => {
      const element = buildElement({
        attributes: {
          complete: true,
          naturalWidth: 100
        },
        tag: 'img'
      });
      expect(isLoaded(element)).toBe(true);
    });

    it('should return false when complete is false', () => {
      const element = buildElement({
        attributes: {
          complete: false,
          naturalWidth: 100
        },
        tag: 'img'
      });
      expect(isLoaded(element)).toBe(false);
    });

    it('should return false when naturalWidth is 0', () => {
      const element = buildElement({
        attributes: {
          complete: true,
          naturalWidth: 0
        },
        tag: 'img'
      });
      expect(isLoaded(element)).toBe(false);
    });
  });

  describe('HTMLIFrameElement', () => {
    it('should return true when contentDocument exists', () => {
      const element = buildElement({
        attributes: {
          contentDocument: {}
        },
        tag: 'iframe'
      });
      expect(isLoaded(element)).toBe(true);
    });

    it('should return false when contentDocument is null', () => {
      const element = buildElement({
        attributes: {
          contentDocument: null
        },
        tag: 'iframe'
      });
      expect(isLoaded(element)).toBe(false);
    });
  });

  describe('HTMLEmbedElement', () => {
    it('should return true when getSVGDocument returns truthy', () => {
      const element = buildElement({
        attributes: {
          getSVGDocument: vi.fn(() => ({}))
        },
        tag: 'embed'
      });
      expect(isLoaded(element)).toBe(true);
    });

    it('should return false when getSVGDocument returns null', () => {
      const element = buildElement({
        attributes: {
          getSVGDocument: vi.fn(() => null)
        },
        tag: 'embed'
      });
      expect(isLoaded(element)).toBe(false);
    });
  });

  describe('HTMLLinkElement', () => {
    it('should return true for stylesheet link with sheet set', () => {
      const element = buildElement({
        attributes: {
          // eslint-disable-next-line unicorn/name-replacements -- `rel` is the HTML attribute name.
          rel: 'stylesheet',
          sheet: {}
        },
        tag: 'link'
      });
      expect(isLoaded(element)).toBe(true);
    });

    it('should return false for stylesheet link with sheet null', () => {
      const element = buildElement({
        attributes: {
          // eslint-disable-next-line unicorn/name-replacements -- `rel` is the HTML attribute name.
          rel: 'stylesheet',
          sheet: null
        },
        tag: 'link'
      });
      expect(isLoaded(element)).toBe(false);
    });

    it('should return true for non-stylesheet link', () => {
      const element = buildElement({
        attributes: {
          // eslint-disable-next-line unicorn/name-replacements -- `rel` is the HTML attribute name.
          rel: 'icon',
          sheet: null
        },
        tag: 'link'
      });
      expect(isLoaded(element)).toBe(true);
    });
  });

  describe('HTMLObjectElement', () => {
    it('should return true when contentDocument exists', () => {
      const element = buildElement({ attributes: { contentDocument: {}, getSVGDocument: vi.fn(() => null) }, tag: 'object' });
      expect(isLoaded(element)).toBe(true);
    });

    it('should return true when getSVGDocument returns truthy', () => {
      const element = buildElement({ attributes: { contentDocument: null, getSVGDocument: vi.fn(() => ({})) }, tag: 'object' });
      expect(isLoaded(element)).toBe(true);
    });

    it('should return false when both contentDocument and getSVGDocument are falsy', () => {
      const element = buildElement({ attributes: { contentDocument: null, getSVGDocument: vi.fn(() => null) }, tag: 'object' });
      expect(isLoaded(element)).toBe(false);
    });
  });

  describe('HTMLScriptElement', () => {
    it('should always return true', () => {
      const element = buildElement({ tag: 'script' });
      expect(isLoaded(element)).toBe(true);
    });
  });

  describe('HTMLStyleElement', () => {
    it('should return true when sheet is set', () => {
      const element = buildElement({ attributes: { sheet: {} }, tag: 'style' });
      expect(isLoaded(element)).toBe(true);
    });

    it('should return false when sheet is null', () => {
      const element = buildElement({ attributes: { sheet: null }, tag: 'style' });
      expect(isLoaded(element)).toBe(false);
    });
  });

  describe('HTMLTrackElement', () => {
    it('should return true when readyState is 2 (loaded)', () => {
      const element = buildElement({ attributes: { readyState: 2 }, tag: 'track' });
      expect(isLoaded(element)).toBe(true);
    });

    it('should return false when readyState is not 2', () => {
      const element = buildElement({ attributes: { readyState: 0 }, tag: 'track' });
      expect(isLoaded(element)).toBe(false);
    });

    it('should return false when readyState is 1', () => {
      const element = buildElement({ attributes: { readyState: 1 }, tag: 'track' });
      expect(isLoaded(element)).toBe(false);
    });
  });

  describe('generic element', () => {
    it('should return true when element has no loadable children', () => {
      const element = buildElement();
      expect(isLoaded(element)).toBe(true);
    });

    it('should return true when all loadable children are loaded', () => {
      const element = buildElement();
      buildElement({ parent: element });
      expect(isLoaded(element)).toBe(true);
    });

    it('should return false when a loadable child is not loaded', () => {
      const img = buildElement({ attributes: { complete: false, naturalWidth: 0 }, tag: 'img' });
      const element = buildElement();
      element.append(img);
      expect(isLoaded(element)).toBe(false);
    });
  });
});

describe('isElementVisibleInOffsetParent', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('should return false when offsetParent is null', () => {
    const element = buildElement({ attributes: { offsetParent: null }, tag: 'div' });
    expect(isElementVisibleInOffsetParent(element)).toBe(false);
  });

  it('should return true when element is fully within offset parent', () => {
    const parent = buildElement();
    parent.getBoundingClientRect = vi.fn((): DOMRect => ({ bottom: 200, height: 200, left: 0, right: 200, toJSON: vi.fn(), top: 0, width: 200, x: 0, y: 0 }));
    const element = buildElement({ attributes: { offsetParent: parent }, tag: 'div' });
    element.getBoundingClientRect = vi.fn((): DOMRect => ({ bottom: 100, height: 90, left: 10, right: 100, toJSON: vi.fn(), top: 10, width: 90, x: 10, y: 10 }));
    expect(isElementVisibleInOffsetParent(element)).toBe(true);
  });

  it('should return false when element extends above offset parent', () => {
    const parent = buildElement();
    parent.getBoundingClientRect = vi.fn((): DOMRect => ({ bottom: 200, height: 150, left: 0, right: 200, toJSON: vi.fn(), top: 50, width: 200, x: 0, y: 50 }));
    const element = buildElement({ parent });
    element.getBoundingClientRect = vi.fn((): DOMRect => ({ bottom: 100, height: 90, left: 10, right: 100, toJSON: vi.fn(), top: 10, width: 90, x: 10, y: 10 }));
    expect(isElementVisibleInOffsetParent(element)).toBe(false);
  });

  it('should return false when element extends below offset parent', () => {
    const parent = buildElement();
    parent.getBoundingClientRect = vi.fn((): DOMRect => ({ bottom: 100, height: 100, left: 0, right: 200, toJSON: vi.fn(), top: 0, width: 200, x: 0, y: 0 }));
    const element = buildElement({ attributes: { offsetParent: parent }, tag: 'div' });
    element.getBoundingClientRect = vi.fn((): DOMRect => ({ bottom: 150, height: 140, left: 10, right: 100, toJSON: vi.fn(), top: 10, width: 90, x: 10, y: 10 }));
    expect(isElementVisibleInOffsetParent(element)).toBe(false);
  });

  it('should return false when element extends left of offset parent', () => {
    const parent = buildElement();
    parent.getBoundingClientRect = vi.fn((): DOMRect => ({ bottom: 200, height: 150, left: 50, right: 200, toJSON: vi.fn(), top: 0, width: 150, x: 50, y: 0 }));
    const element = buildElement({ attributes: { offsetParent: parent }, tag: 'div' });
    element.getBoundingClientRect = vi.fn((): DOMRect => ({ bottom: 100, height: 90, left: 10, right: 100, toJSON: vi.fn(), top: 10, width: 90, x: 10, y: 10 }));
    expect(isElementVisibleInOffsetParent(element)).toBe(false);
  });

  it('should return false when element extends right of offset parent', () => {
    const parent = buildElement();
    parent.getBoundingClientRect = vi.fn((): DOMRect => ({ bottom: 200, height: 100, left: 0, right: 100, toJSON: vi.fn(), top: 0, width: 100, x: 0, y: 0 }));
    const element = buildElement({ attributes: { offsetParent: parent }, tag: 'div' });
    element.getBoundingClientRect = vi.fn((): DOMRect => ({ bottom: 100, height: 90, left: 10, right: 150, toJSON: vi.fn(), top: 10, width: 140, x: 10, y: 10 }));
    expect(isElementVisibleInOffsetParent(element)).toBe(false);
  });

  it('should return true when element exactly matches offset parent bounds', () => {
    const parent = buildElement();
    parent.getBoundingClientRect = vi.fn((): DOMRect => ({ bottom: 100, height: 100, left: 0, right: 100, toJSON: vi.fn(), top: 0, width: 100, x: 0, y: 0 }));
    const element = buildElement({ attributes: { offsetParent: parent }, tag: 'div' });
    element.getBoundingClientRect = vi.fn((): DOMRect => ({ bottom: 100, height: 100, left: 0, right: 100, toJSON: vi.fn(), top: 0, width: 100, x: 0, y: 0 }));
    expect(isElementVisibleInOffsetParent(element)).toBe(true);
  });
});

describe('onAncestorScrollOrResize', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('should return a disposable', () => {
    const node = buildElement();
    const disposable = onAncestorScrollOrResize(node, vi.fn());
    expect(typeof disposable[Symbol.dispose]).toBe('function');
  });

  it('should add scroll and resize listeners to document, window, and the node', () => {
    const node = buildElement();
    vi.spyOn(activeDocument, 'addEventListener');
    vi.spyOn(activeWindow, 'addEventListener');
    vi.spyOn(node, 'addEventListener');

    onAncestorScrollOrResize(node, vi.fn());

    expect(vi.mocked(activeDocument.addEventListener)).toHaveBeenCalledWith('scroll', expect.any(Function), { capture: true });
    expect(vi.mocked(activeDocument.addEventListener)).toHaveBeenCalledWith('resize', expect.any(Function), { capture: true });

    expect(vi.mocked(activeWindow.addEventListener)).toHaveBeenCalledWith('scroll', expect.any(Function), { capture: true });

    expect(vi.mocked(activeWindow.addEventListener)).toHaveBeenCalledWith('resize', expect.any(Function), { capture: true });
    expect(vi.mocked(node.addEventListener)).toHaveBeenCalledWith('scroll', expect.any(Function), { capture: true });
    expect(vi.mocked(node.addEventListener)).toHaveBeenCalledWith('resize', expect.any(Function), { capture: true });
  });

  it('should add listeners to ancestor nodes in the parent chain', () => {
    const grandparent = buildElement();
    const parent = buildElement({ parent: grandparent });
    const node = buildElement({ parent });

    vi.spyOn(node, 'addEventListener');
    vi.spyOn(parent, 'addEventListener');
    vi.spyOn(grandparent, 'addEventListener');

    onAncestorScrollOrResize(node, vi.fn());

    expect(vi.mocked(node.addEventListener)).toHaveBeenCalledWith('scroll', expect.any(Function), { capture: true });
    expect(vi.mocked(parent.addEventListener)).toHaveBeenCalledWith('scroll', expect.any(Function), { capture: true });
    expect(vi.mocked(grandparent.addEventListener)).toHaveBeenCalledWith('scroll', expect.any(Function), { capture: true });
  });

  it('should remove all listeners when the disposable is disposed', () => {
    const node = buildElement();
    const disposable = onAncestorScrollOrResize(node, vi.fn());

    const documentRemoveEventListeners = vi.fn();
    activeDocument.removeEventListener = documentRemoveEventListeners;
    const windowRemoveEventListeners = vi.fn();
    activeWindow.removeEventListener = windowRemoveEventListeners;
    const nodeRemoveEventListeners = vi.fn();
    node.removeEventListener = nodeRemoveEventListeners;

    dispose(disposable);

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
    vi.spyOn(activeWindow, 'requestAnimationFrame').mockImplementation(($callback: FrameRequestCallback) => {
      $callback(0);
      return 0;
    });

    const node = buildElement();
    const callback = vi.fn();
    onAncestorScrollOrResize(node, callback);

    node.dispatchEvent(new Event('scroll'));

    expect(vi.mocked(activeWindow.requestAnimationFrame)).toHaveBeenCalled();
    expect(callback).toHaveBeenCalledTimes(1);
  });

  it('should debounce multiple rapid event triggers', () => {
    vi.spyOn(activeWindow, 'requestAnimationFrame').mockImplementation((_callback: FrameRequestCallback) => 0);

    const node = buildElement();
    const callback = vi.fn();
    onAncestorScrollOrResize(node, callback);

    // Trigger scroll multiple times before requestAnimationFrame fires
    node.dispatchEvent(new Event('scroll'));
    node.dispatchEvent(new Event('scroll'));
    node.dispatchEvent(new Event('scroll'));

    // RequestAnimationFrame should only be called once because isEventTriggered guards
    expect(vi.mocked(activeWindow.requestAnimationFrame)).toHaveBeenCalledTimes(1);
  });

  it('should allow new events after the requestAnimationFrame callback completes', () => {
    vi.spyOn(activeWindow, 'requestAnimationFrame').mockImplementation(($callback: FrameRequestCallback) => {
      $callback(0);
      return 0;
    });

    const node = buildElement();
    const callback = vi.fn();
    onAncestorScrollOrResize(node, callback);

    // First event
    node.dispatchEvent(new Event('scroll'));
    expect(callback).toHaveBeenCalledTimes(1);

    // Second event after first completes
    node.dispatchEvent(new Event('scroll'));
    expect(vi.mocked(activeWindow.requestAnimationFrame)).toHaveBeenCalledTimes(2);
    expect(callback).toHaveBeenCalledTimes(2);
  });

  it('should fall back to the window document for a node without an ownerDocument', () => {
    // A Document node has a `null` ownerDocument, exercising the window-document fallback.
    const disposable = onAncestorScrollOrResize(activeDocument, vi.fn());
    expect(typeof disposable[Symbol.dispose]).toBe('function');
    dispose(disposable);
  });

  it('should reset isEventTriggered even if callback throws', () => {
    const rafCallbacks: FrameRequestCallback[] = [];

    vi.spyOn(activeWindow, 'requestAnimationFrame').mockImplementation(($callback: FrameRequestCallback) => {
      rafCallbacks.push($callback);
      return 0;
    });

    const node = buildElement();
    const callback = vi.fn(() => {
      throw new Error('callback error');
    });
    onAncestorScrollOrResize(node, callback);

    // First scroll queues a raf callback
    node.dispatchEvent(new Event('scroll'));
    expect(vi.mocked(activeWindow.requestAnimationFrame)).toHaveBeenCalledTimes(1);

    // Execute the raf callback — it throws but try/finally should reset isEventTriggered
    const firstCallback = rafCallbacks[0];
    assertNonNullable(firstCallback);
    expect(() => {
      firstCallback(0);
    }).toThrow('callback error');

    // If isEventTriggered was properly reset, a second scroll should queue another raf
    node.dispatchEvent(new Event('scroll'));
    expect(vi.mocked(activeWindow.requestAnimationFrame)).toHaveBeenCalledTimes(2);
  });
});

describe('ensureLoaded', () => {
  it('should resolve immediately when element is already loaded', async () => {
    const element = buildElement();
    await expect(ensureLoaded(element)).resolves.toBeUndefined();
  });

  it('should resolve immediately for a generic element with no loadable children', async () => {
    const element = buildElement();
    await expect(ensureLoaded(element)).resolves.toBeUndefined();
  });

  it('should wait for load event on an unloaded image', async () => {
    const element = buildElement({
      attributes: {
        complete: false,
        naturalWidth: 0
      },
      tag: 'img'
    });

    const promise = ensureLoaded(element);
    element.dispatchEvent(new Event('load'));

    await expect(promise).resolves.toBeUndefined();
  });

  it('should wait for error event on an unloaded image', async () => {
    const element = buildElement({
      attributes: {
        complete: false,
        naturalWidth: 0
      },
      tag: 'img'
    });

    const promise = ensureLoaded(element);
    element.dispatchEvent(new Event('error'));

    await expect(promise).resolves.toBeUndefined();
  });

  it('should recursively ensure all loadable children are loaded for generic elements', async () => {
    const script = buildElement({ tag: 'script' });
    const element = buildElement();
    element.append(script);
    await expect(ensureLoaded(element)).resolves.toBeUndefined();
  });

  it('should recursively wait for unloaded children inside a generic element', async () => {
    const img = buildElement({
      attributes: {
        complete: false,
        naturalWidth: 0
      },
      tag: 'img'
    });
    const element = buildElement();
    element.append(img);

    const promise = ensureLoaded(element);
    img.dispatchEvent(new Event('load'));

    await expect(promise).resolves.toBeUndefined();
  });

  it('should wait for load on an unloaded iframe', async () => {
    const element = buildElement({
      attributes: {
        contentDocument: null
      },
      tag: 'iframe'
    });

    const promise = ensureLoaded(element);
    element.dispatchEvent(new Event('load'));

    await expect(promise).resolves.toBeUndefined();
  });

  it('should wait for load on an unloaded style element', async () => {
    const element = buildElement({
      attributes: {
        sheet: null
      },
      tag: 'style'
    });

    const promise = ensureLoaded(element);
    element.dispatchEvent(new Event('load'));

    await expect(promise).resolves.toBeUndefined();
  });
});

describe('waitUntilConnected', () => {
  afterEach(() => {
    for (const element of snapshot(activeDocument.body.children)) {
      element.remove();
    }
  });

  it('should resolve immediately when the element is already connected', async () => {
    const element = buildElement({ parent: activeDocument.body });
    expect(element.isConnected).toBe(true);
    await expect(waitUntilConnected(element)).resolves.toBeUndefined();
  });

  it('should resolve when a disconnected element is later inserted', async () => {
    const element = buildElement();
    expect(element.isConnected).toBe(false);

    let isResolved = false;
    const promise = waitUntilConnected(element).then(() => {
      isResolved = true;
    });

    // An unrelated mutation fires the observer while the element is still disconnected (it must not resolve yet).
    activeDocument.body.append(buildElement());
    await flushMutations();
    expect(isResolved).toBe(false);

    activeDocument.body.append(element);
    await promise;
    expect(isResolved).toBe(true);
  });
});

interface BuildElementParams {
  readonly attributes?: GenericObject;
  readonly parent?: HTMLElement | undefined;
  readonly tag?: keyof HTMLElementTagNameMap;
}

function buildElement(params: BuildElementParams = {}): HTMLElement {
  const { attributes = {}, parent, tag = 'div' } = params;
  const element = createEl(tag);
  const record = ensureGenericObject(element);
  for (const [key, value] of Object.entries(attributes)) {
    Object.defineProperty(record, key, { configurable: true, value, writable: true });
  }
  if (parent) {
    parent.append(element);
  }
  return element;
}

async function flushMutations(): Promise<void> {
  // MutationObserver callbacks are microtasks; a macrotask turn guarantees they have run.
  await new Promise<void>((resolve) => {
    window.setTimeout(resolve, 0);
  });
}
