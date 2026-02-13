import {
  afterEach,
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

interface MockElement {
  addEventListener: ReturnType<typeof vi.fn>;
  complete?: boolean;
  contentDocument?: unknown;
  getBoundingClientRect: ReturnType<typeof vi.fn>;
  getSVGDocument?: ReturnType<typeof vi.fn>;
  naturalWidth?: number;
  offsetParent: MockElement | null;
  parentElement: MockElement | null;
  parentNode: MockElement | null;
  querySelectorAll: ReturnType<typeof vi.fn>;
  readyState?: number;
  rel?: string;
  removeEventListener: ReturnType<typeof vi.fn>;
  sheet?: unknown;
}

function createMockElement(overrides: Partial<MockElement> = {}): MockElement {
  return {
    addEventListener: vi.fn(),
    getBoundingClientRect: vi.fn(() => ({ bottom: 100, left: 0, right: 100, top: 0 })),
    offsetParent: null,
    parentElement: null,
    parentNode: null,
    querySelectorAll: vi.fn(() => []),
    removeEventListener: vi.fn(),
    ...overrides
  };
}

function createMockHTMLClass(name: string): ReturnType<typeof vi.fn> {
  const ctor = vi.fn();
  Object.defineProperty(ctor, 'name', { value: name });
  return ctor;
}

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
  let mockDiv: Record<string, unknown>;

  beforeEach(() => {
    mockDiv = { tagName: 'DIV' };
    vi.stubGlobal('createDiv', vi.fn(() => mockDiv));
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('should return the created div', async () => {
    const result = await createDivAsync();
    expect(result).toBe(mockDiv);
  });

  it('should call createDiv with the provided options', async () => {
    await createDivAsync('my-class');
    expect(createDiv).toHaveBeenCalledWith('my-class');
  });

  it('should work without a callback', async () => {
    const result = await createDivAsync();
    expect(result).toBe(mockDiv);
  });

  it('should call the sync callback with the div', async () => {
    const callback = vi.fn();
    await createDivAsync(undefined, callback);
    expect(callback).toHaveBeenCalledWith(mockDiv);
  });

  it('should call the async callback with the div', async () => {
    const callback = vi.fn(async () => {
      await Promise.resolve();
    });
    await createDivAsync(undefined, callback);
    expect(callback).toHaveBeenCalledWith(mockDiv);
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
  let mockParagraph: Record<string, unknown>;

  beforeEach(() => {
    mockParagraph = { tagName: 'P' };
    vi.stubGlobal('createEl', vi.fn(() => mockParagraph));
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('should return the created element', async () => {
    const result = await createElAsync('p');
    expect(result).toBe(mockParagraph);
  });

  it('should call createEl with the tag and options', async () => {
    await createElAsync('p', 'my-class');
    expect(createEl).toHaveBeenCalledWith('p', 'my-class');
  });

  it('should work without a callback', async () => {
    const result = await createElAsync('p');
    expect(result).toBe(mockParagraph);
  });

  it('should call the sync callback with the element', async () => {
    const callback = vi.fn();
    await createElAsync('p', undefined, callback);
    expect(callback).toHaveBeenCalledWith(mockParagraph);
  });

  it('should call the async callback with the element', async () => {
    const callback = vi.fn(async () => {
      await Promise.resolve();
    });
    await createElAsync('p', undefined, callback);
    expect(callback).toHaveBeenCalledWith(mockParagraph);
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
  let mockSpan: Record<string, unknown>;

  beforeEach(() => {
    mockSpan = { tagName: 'SPAN' };
    vi.stubGlobal('createSpan', vi.fn(() => mockSpan));
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('should return the created span', async () => {
    const result = await createSpanAsync();
    expect(result).toBe(mockSpan);
  });

  it('should call createSpan with the provided options', async () => {
    await createSpanAsync('my-class');
    expect(createSpan).toHaveBeenCalledWith('my-class');
  });

  it('should work without a callback', async () => {
    const result = await createSpanAsync();
    expect(result).toBe(mockSpan);
  });

  it('should call the sync callback with the span', async () => {
    const callback = vi.fn();
    await createSpanAsync(undefined, callback);
    expect(callback).toHaveBeenCalledWith(mockSpan);
  });

  it('should call the async callback with the span', async () => {
    const callback = vi.fn(async () => {
      await Promise.resolve();
    });
    await createSpanAsync(undefined, callback);
    expect(callback).toHaveBeenCalledWith(mockSpan);
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
  let mockFragment: Record<string, unknown>;

  beforeEach(() => {
    mockFragment = { nodeType: 11 };
    vi.stubGlobal('createFragment', vi.fn(() => mockFragment));
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('should return the created fragment', async () => {
    const result = await createFragmentAsync();
    expect(result).toBe(mockFragment);
  });

  it('should work without a callback', async () => {
    const result = await createFragmentAsync();
    expect(result).toBe(mockFragment);
  });

  it('should call the sync callback with the fragment', async () => {
    const callback = vi.fn();
    await createFragmentAsync(callback);
    expect(callback).toHaveBeenCalledWith(mockFragment);
  });

  it('should call the async callback with the fragment', async () => {
    const callback = vi.fn(async () => {
      await Promise.resolve();
    });
    await createFragmentAsync(callback);
    expect(callback).toHaveBeenCalledWith(mockFragment);
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
  let mockSvg: Record<string, unknown>;

  beforeEach(() => {
    mockSvg = { tagName: 'svg' };
    vi.stubGlobal('createSvg', vi.fn(() => mockSvg));
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('should return the created svg element', async () => {
    const result = await createSvgAsync('svg');
    expect(result).toBe(mockSvg);
  });

  it('should call createSvg with the tag and options', async () => {
    await createSvgAsync('svg', 'my-class');
    expect(createSvg).toHaveBeenCalledWith('svg', 'my-class');
  });

  it('should work without a callback', async () => {
    const result = await createSvgAsync('svg');
    expect(result).toBe(mockSvg);
  });

  it('should call the sync callback with the svg element', async () => {
    const callback = vi.fn();
    await createSvgAsync('svg', undefined, callback);
    expect(callback).toHaveBeenCalledWith(mockSvg);
  });

  it('should call the async callback with the svg element', async () => {
    const callback = vi.fn(async () => {
      await Promise.resolve();
    });
    await createSvgAsync('svg', undefined, callback);
    expect(callback).toHaveBeenCalledWith(mockSvg);
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
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('should call createEl on the element with strong tag and correct options', () => {
    const mockCreateEl = vi.fn();
    const el = { createEl: mockCreateEl } as unknown as HTMLElement;
    appendCodeBlock(el, 'console.log("hello")');
    expect(mockCreateEl).toHaveBeenCalledWith(
      'strong',
      { cls: 'markdown-rendered code' },
      expect.any(Function)
    );
  });

  it('should call createEl on the strong element with code tag inside the callback', () => {
    const innerCreateEl = vi.fn();
    const mockStrong = { createEl: innerCreateEl } as unknown as HTMLElement;
    const mockCreateEl = vi.fn((_tag: string, _opts: unknown, cb: (el: HTMLElement) => void) => {
      cb(mockStrong);
    });
    const el = { createEl: mockCreateEl } as unknown as HTMLElement;
    appendCodeBlock(el, 'my-code');
    expect(innerCreateEl).toHaveBeenCalledWith('code', { text: 'my-code' });
  });

  it('should pass the code text correctly', () => {
    const innerCreateEl = vi.fn();
    const mockStrong = { createEl: innerCreateEl } as unknown as HTMLElement;
    const mockCreateEl = vi.fn((_tag: string, _opts: unknown, cb: (el: HTMLElement) => void) => {
      cb(mockStrong);
    });
    const el = { createEl: mockCreateEl } as unknown as HTMLElement;
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
    expect(getZIndex(el as unknown as Element)).toBe(10);
  });

  it('should return 0 for an element with auto z-index and no parent', () => {
    const el = createMockElement();
    vi.mocked(getComputedStyle).mockReturnValue({ zIndex: 'auto' } as CSSStyleDeclaration);
    expect(getZIndex(el as unknown as Element)).toBe(0);
  });

  it('should return parent z-index if child has auto', () => {
    const parent = createMockElement();
    const child = createMockElement({ parentElement: parent });
    const childAsElement = child as unknown as Element;
    const parentAsElement = parent as unknown as Element;
    vi.mocked(getComputedStyle).mockImplementation((target) => {
      if (target === childAsElement) {
        return { zIndex: 'auto' } as CSSStyleDeclaration;
      }
      if (target === parentAsElement) {
        return { zIndex: '5' } as CSSStyleDeclaration;
      }
      return { zIndex: 'auto' } as CSSStyleDeclaration;
    });
    expect(getZIndex(childAsElement)).toBe(5);
  });

  it('should return 0 if no ancestor has a numeric z-index', () => {
    const grandparent = createMockElement();
    const parent = createMockElement({ parentElement: grandparent });
    const child = createMockElement({ parentElement: parent });
    vi.mocked(getComputedStyle).mockReturnValue({ zIndex: 'auto' } as CSSStyleDeclaration);
    expect(getZIndex(child as unknown as Element)).toBe(0);
  });

  it('should return negative z-index values', () => {
    const el = createMockElement();
    vi.mocked(getComputedStyle).mockReturnValue({ zIndex: '-3' } as CSSStyleDeclaration);
    expect(getZIndex(el as unknown as Element)).toBe(-3);
  });

  it('should skip elements with empty z-index string', () => {
    const parent = createMockElement();
    const child = createMockElement({ parentElement: parent });
    const childAsElement = child as unknown as Element;
    vi.mocked(getComputedStyle).mockImplementation((target) => {
      if (target === childAsElement) {
        return { zIndex: '' } as CSSStyleDeclaration;
      }
      return { zIndex: '7' } as CSSStyleDeclaration;
    });
    expect(getZIndex(childAsElement)).toBe(7);
  });
});

describe('isLoaded', () => {
  const MockHTMLBodyElement = createMockHTMLClass('HTMLBodyElement');
  const MockHTMLImageElement = createMockHTMLClass('HTMLImageElement');
  const MockHTMLIFrameElement = createMockHTMLClass('HTMLIFrameElement');
  const MockHTMLEmbedElement = createMockHTMLClass('HTMLEmbedElement');
  const MockHTMLLinkElement = createMockHTMLClass('HTMLLinkElement');
  const MockHTMLObjectElement = createMockHTMLClass('HTMLObjectElement');
  const MockHTMLScriptElement = createMockHTMLClass('HTMLScriptElement');
  const MockHTMLStyleElement = createMockHTMLClass('HTMLStyleElement');
  const MockHTMLTrackElement = createMockHTMLClass('HTMLTrackElement');

  beforeEach(() => {
    vi.stubGlobal('HTMLBodyElement', MockHTMLBodyElement);
    vi.stubGlobal('HTMLImageElement', MockHTMLImageElement);
    vi.stubGlobal('HTMLIFrameElement', MockHTMLIFrameElement);
    vi.stubGlobal('HTMLEmbedElement', MockHTMLEmbedElement);
    vi.stubGlobal('HTMLLinkElement', MockHTMLLinkElement);
    vi.stubGlobal('HTMLObjectElement', MockHTMLObjectElement);
    vi.stubGlobal('HTMLScriptElement', MockHTMLScriptElement);
    vi.stubGlobal('HTMLStyleElement', MockHTMLStyleElement);
    vi.stubGlobal('HTMLTrackElement', MockHTMLTrackElement);
    vi.stubGlobal('document', { readyState: 'complete' });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  describe('HTMLBodyElement', () => {
    it('should return true when document.readyState is complete', () => {
      const el = Object.create(MockHTMLBodyElement.prototype) as Element;
      Object.assign(el, createMockElement());
      vi.stubGlobal('document', { readyState: 'complete' });
      expect(isLoaded(el)).toBe(true);
    });

    it('should return true when document.readyState is interactive', () => {
      const el = Object.create(MockHTMLBodyElement.prototype) as Element;
      Object.assign(el, createMockElement());
      vi.stubGlobal('document', { readyState: 'interactive' });
      expect(isLoaded(el)).toBe(true);
    });

    it('should return false when document.readyState is loading', () => {
      const el = Object.create(MockHTMLBodyElement.prototype) as Element;
      Object.assign(el, createMockElement());
      vi.stubGlobal('document', { readyState: 'loading' });
      expect(isLoaded(el)).toBe(false);
    });
  });

  describe('HTMLImageElement', () => {
    it('should return true when complete is true and naturalWidth > 0', () => {
      const el = Object.create(MockHTMLImageElement.prototype) as Element;
      Object.assign(el, createMockElement({ complete: true, naturalWidth: 100 }));
      expect(isLoaded(el)).toBe(true);
    });

    it('should return false when complete is false', () => {
      const el = Object.create(MockHTMLImageElement.prototype) as Element;
      Object.assign(el, createMockElement({ complete: false, naturalWidth: 100 }));
      expect(isLoaded(el)).toBe(false);
    });

    it('should return false when naturalWidth is 0', () => {
      const el = Object.create(MockHTMLImageElement.prototype) as Element;
      Object.assign(el, createMockElement({ complete: true, naturalWidth: 0 }));
      expect(isLoaded(el)).toBe(false);
    });
  });

  describe('HTMLIFrameElement', () => {
    it('should return true when contentDocument exists', () => {
      const el = Object.create(MockHTMLIFrameElement.prototype) as Element;
      Object.assign(el, createMockElement({ contentDocument: {} }));
      expect(isLoaded(el)).toBe(true);
    });

    it('should return false when contentDocument is null', () => {
      const el = Object.create(MockHTMLIFrameElement.prototype) as Element;
      Object.assign(el, createMockElement({ contentDocument: null }));
      expect(isLoaded(el)).toBe(false);
    });
  });

  describe('HTMLEmbedElement', () => {
    it('should return true when getSVGDocument returns truthy', () => {
      const el = Object.create(MockHTMLEmbedElement.prototype) as Element;
      Object.assign(el, createMockElement({ getSVGDocument: vi.fn(() => ({})) }));
      expect(isLoaded(el)).toBe(true);
    });

    it('should return false when getSVGDocument returns null', () => {
      const el = Object.create(MockHTMLEmbedElement.prototype) as Element;
      Object.assign(el, createMockElement({ getSVGDocument: vi.fn(() => null) }));
      expect(isLoaded(el)).toBe(false);
    });
  });

  describe('HTMLLinkElement', () => {
    it('should return true for stylesheet link with sheet set', () => {
      const el = Object.create(MockHTMLLinkElement.prototype) as Element;
      Object.assign(el, createMockElement({ rel: 'stylesheet', sheet: {} }));
      expect(isLoaded(el)).toBe(true);
    });

    it('should return false for stylesheet link with sheet null', () => {
      const el = Object.create(MockHTMLLinkElement.prototype) as Element;
      Object.assign(el, createMockElement({ rel: 'stylesheet', sheet: null }));
      expect(isLoaded(el)).toBe(false);
    });

    it('should return true for non-stylesheet link', () => {
      const el = Object.create(MockHTMLLinkElement.prototype) as Element;
      Object.assign(el, createMockElement({ rel: 'icon', sheet: null }));
      expect(isLoaded(el)).toBe(true);
    });
  });

  describe('HTMLObjectElement', () => {
    it('should return true when contentDocument exists', () => {
      const el = Object.create(MockHTMLObjectElement.prototype) as Element;
      Object.assign(el, createMockElement({ contentDocument: {}, getSVGDocument: vi.fn(() => null) }));
      expect(isLoaded(el)).toBe(true);
    });

    it('should return true when getSVGDocument returns truthy', () => {
      const el = Object.create(MockHTMLObjectElement.prototype) as Element;
      Object.assign(el, createMockElement({ contentDocument: null, getSVGDocument: vi.fn(() => ({})) }));
      expect(isLoaded(el)).toBe(true);
    });

    it('should return false when both contentDocument and getSVGDocument are falsy', () => {
      const el = Object.create(MockHTMLObjectElement.prototype) as Element;
      Object.assign(el, createMockElement({ contentDocument: null, getSVGDocument: vi.fn(() => null) }));
      expect(isLoaded(el)).toBe(false);
    });
  });

  describe('HTMLScriptElement', () => {
    it('should always return true', () => {
      const el = Object.create(MockHTMLScriptElement.prototype) as Element;
      Object.assign(el, createMockElement());
      expect(isLoaded(el)).toBe(true);
    });
  });

  describe('HTMLStyleElement', () => {
    it('should return true when sheet is set', () => {
      const el = Object.create(MockHTMLStyleElement.prototype) as Element;
      Object.assign(el, createMockElement({ sheet: {} }));
      expect(isLoaded(el)).toBe(true);
    });

    it('should return false when sheet is null', () => {
      const el = Object.create(MockHTMLStyleElement.prototype) as Element;
      Object.assign(el, createMockElement({ sheet: null }));
      expect(isLoaded(el)).toBe(false);
    });
  });

  describe('HTMLTrackElement', () => {
    it('should return true when readyState is 2 (loaded)', () => {
      const el = Object.create(MockHTMLTrackElement.prototype) as Element;
      Object.assign(el, createMockElement({ readyState: 2 }));
      expect(isLoaded(el)).toBe(true);
    });

    it('should return false when readyState is not 2', () => {
      const el = Object.create(MockHTMLTrackElement.prototype) as Element;
      Object.assign(el, createMockElement({ readyState: 0 }));
      expect(isLoaded(el)).toBe(false);
    });

    it('should return false when readyState is 1', () => {
      const el = Object.create(MockHTMLTrackElement.prototype) as Element;
      Object.assign(el, createMockElement({ readyState: 1 }));
      expect(isLoaded(el)).toBe(false);
    });
  });

  describe('generic element', () => {
    it('should return true when element has no loadable children', () => {
      const el = createMockElement();
      el.querySelectorAll.mockReturnValue([]);
      expect(isLoaded(el as unknown as Element)).toBe(true);
    });

    it('should return true when all loadable children are loaded', () => {
      const script = Object.create(MockHTMLScriptElement.prototype) as Record<string, unknown>;
      Object.assign(script, createMockElement());
      const el = createMockElement();
      el.querySelectorAll.mockReturnValue([script]);
      expect(isLoaded(el as unknown as Element)).toBe(true);
    });

    it('should return false when a loadable child is not loaded', () => {
      const img = Object.create(MockHTMLImageElement.prototype) as Record<string, unknown>;
      Object.assign(img, createMockElement({ complete: false, naturalWidth: 0 }));
      const el = createMockElement();
      el.querySelectorAll.mockReturnValue([img]);
      expect(isLoaded(el as unknown as Element)).toBe(false);
    });
  });
});

describe('isElementVisibleInOffsetParent', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('should return false when offsetParent is null', () => {
    const el = createMockElement({ offsetParent: null });
    expect(isElementVisibleInOffsetParent(el as unknown as HTMLElement)).toBe(false);
  });

  it('should return true when element is fully within offset parent', () => {
    const parent = createMockElement();
    parent.getBoundingClientRect.mockReturnValue({ bottom: 200, left: 0, right: 200, top: 0 });
    const el = createMockElement({ offsetParent: parent });
    el.getBoundingClientRect.mockReturnValue({ bottom: 100, left: 10, right: 100, top: 10 });
    expect(isElementVisibleInOffsetParent(el as unknown as HTMLElement)).toBe(true);
  });

  it('should return false when element extends above offset parent', () => {
    const parent = createMockElement();
    parent.getBoundingClientRect.mockReturnValue({ bottom: 200, left: 0, right: 200, top: 50 });
    const el = createMockElement({ offsetParent: parent });
    el.getBoundingClientRect.mockReturnValue({ bottom: 100, left: 10, right: 100, top: 10 });
    expect(isElementVisibleInOffsetParent(el as unknown as HTMLElement)).toBe(false);
  });

  it('should return false when element extends below offset parent', () => {
    const parent = createMockElement();
    parent.getBoundingClientRect.mockReturnValue({ bottom: 100, left: 0, right: 200, top: 0 });
    const el = createMockElement({ offsetParent: parent });
    el.getBoundingClientRect.mockReturnValue({ bottom: 150, left: 10, right: 100, top: 10 });
    expect(isElementVisibleInOffsetParent(el as unknown as HTMLElement)).toBe(false);
  });

  it('should return false when element extends left of offset parent', () => {
    const parent = createMockElement();
    parent.getBoundingClientRect.mockReturnValue({ bottom: 200, left: 50, right: 200, top: 0 });
    const el = createMockElement({ offsetParent: parent });
    el.getBoundingClientRect.mockReturnValue({ bottom: 100, left: 10, right: 100, top: 10 });
    expect(isElementVisibleInOffsetParent(el as unknown as HTMLElement)).toBe(false);
  });

  it('should return false when element extends right of offset parent', () => {
    const parent = createMockElement();
    parent.getBoundingClientRect.mockReturnValue({ bottom: 200, left: 0, right: 100, top: 0 });
    const el = createMockElement({ offsetParent: parent });
    el.getBoundingClientRect.mockReturnValue({ bottom: 100, left: 10, right: 150, top: 10 });
    expect(isElementVisibleInOffsetParent(el as unknown as HTMLElement)).toBe(false);
  });

  it('should return true when element exactly matches offset parent bounds', () => {
    const parent = createMockElement();
    parent.getBoundingClientRect.mockReturnValue({ bottom: 100, left: 0, right: 100, top: 0 });
    const el = createMockElement({ offsetParent: parent });
    el.getBoundingClientRect.mockReturnValue({ bottom: 100, left: 0, right: 100, top: 0 });
    expect(isElementVisibleInOffsetParent(el as unknown as HTMLElement)).toBe(true);
  });
});

interface MockEventTarget {
  addEventListener: ReturnType<typeof vi.fn>;
  removeEventListener: ReturnType<typeof vi.fn>;
}

describe('onAncestorScrollOrResize', () => {
  let mockDocument: MockEventTarget;
  let mockWindow: MockEventTarget;
  let rafCallback: (() => void) | null;

  beforeEach(() => {
    mockDocument = {
      addEventListener: vi.fn(),
      removeEventListener: vi.fn()
    };
    mockWindow = {
      addEventListener: vi.fn(),
      removeEventListener: vi.fn()
    };
    rafCallback = null;
    vi.stubGlobal('document', mockDocument);
    vi.stubGlobal('window', mockWindow);
    vi.stubGlobal(
      'requestAnimationFrame',
      vi.fn((cb: () => void) => {
        rafCallback = cb;
        return 0;
      })
    );
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('should return a cleanup function', () => {
    const node = createMockElement();
    const cleanup = onAncestorScrollOrResize(node as unknown as Node, vi.fn());
    expect(typeof cleanup).toBe('function');
  });

  it('should add scroll and resize listeners to document, window, and the node', () => {
    const node = createMockElement();
    onAncestorScrollOrResize(node as unknown as Node, vi.fn());

    expect(mockDocument.addEventListener).toHaveBeenCalledWith(
      'scroll',
      expect.any(Function),
      { capture: true }
    );
    expect(mockDocument.addEventListener).toHaveBeenCalledWith(
      'resize',
      expect.any(Function),
      { capture: true }
    );
    expect(mockWindow.addEventListener).toHaveBeenCalledWith(
      'scroll',
      expect.any(Function),
      { capture: true }
    );
    expect(mockWindow.addEventListener).toHaveBeenCalledWith(
      'resize',
      expect.any(Function),
      { capture: true }
    );
    expect(node.addEventListener).toHaveBeenCalledWith(
      'scroll',
      expect.any(Function),
      { capture: true }
    );
    expect(node.addEventListener).toHaveBeenCalledWith(
      'resize',
      expect.any(Function),
      { capture: true }
    );
  });

  it('should add listeners to ancestor nodes in the parent chain', () => {
    const grandparent = createMockElement();
    const parent = createMockElement({ parentNode: grandparent });
    const node = createMockElement({ parentNode: parent });

    onAncestorScrollOrResize(node as unknown as Node, vi.fn());

    expect(node.addEventListener).toHaveBeenCalledWith('scroll', expect.any(Function), { capture: true });
    expect(parent.addEventListener).toHaveBeenCalledWith('scroll', expect.any(Function), { capture: true });
    expect(grandparent.addEventListener).toHaveBeenCalledWith('scroll', expect.any(Function), { capture: true });
  });

  it('should remove all listeners when cleanup is called', () => {
    const node = createMockElement();
    const cleanup = onAncestorScrollOrResize(node as unknown as Node, vi.fn());

    cleanup();

    expect(mockDocument.removeEventListener).toHaveBeenCalledWith(
      'scroll',
      expect.any(Function),
      { capture: true }
    );
    expect(mockDocument.removeEventListener).toHaveBeenCalledWith(
      'resize',
      expect.any(Function),
      { capture: true }
    );
    expect(mockWindow.removeEventListener).toHaveBeenCalledWith(
      'scroll',
      expect.any(Function),
      { capture: true }
    );
    expect(mockWindow.removeEventListener).toHaveBeenCalledWith(
      'resize',
      expect.any(Function),
      { capture: true }
    );
    expect(node.removeEventListener).toHaveBeenCalledWith(
      'scroll',
      expect.any(Function),
      { capture: true }
    );
    expect(node.removeEventListener).toHaveBeenCalledWith(
      'resize',
      expect.any(Function),
      { capture: true }
    );
  });

  it('should invoke the callback via requestAnimationFrame when a scroll event fires', () => {
    const node = createMockElement();
    const callback = vi.fn();
    onAncestorScrollOrResize(node as unknown as Node, callback);

    // Extract the scroll handler that was registered on the node
    const scrollHandler = node.addEventListener.mock.calls.find(
      (call: unknown[]) => call[0] === 'scroll'
    )?.[1] as (() => void) | undefined;
    expect(scrollHandler).toBeDefined();
    scrollHandler?.();

    expect(requestAnimationFrame).toHaveBeenCalled();

    // Simulate requestAnimationFrame execution
    expect(rafCallback).not.toBeNull();
    rafCallback?.();
    expect(callback).toHaveBeenCalledTimes(1);
  });

  it('should debounce multiple rapid event triggers', () => {
    const node = createMockElement();
    const callback = vi.fn();
    onAncestorScrollOrResize(node as unknown as Node, callback);

    const scrollHandler = node.addEventListener.mock.calls.find(
      (call: unknown[]) => call[0] === 'scroll'
    )?.[1] as (() => void) | undefined;
    expect(scrollHandler).toBeDefined();

    // Trigger scroll multiple times before requestAnimationFrame fires
    scrollHandler?.();
    scrollHandler?.();
    scrollHandler?.();

    // RequestAnimationFrame should only be called once because isEventTriggered guards
    expect(requestAnimationFrame).toHaveBeenCalledTimes(1);
  });

  it('should allow new events after requestAnimationFrame callback completes', () => {
    const node = createMockElement();
    const callback = vi.fn();
    onAncestorScrollOrResize(node as unknown as Node, callback);

    const scrollHandler = node.addEventListener.mock.calls.find(
      (call: unknown[]) => call[0] === 'scroll'
    )?.[1] as (() => void) | undefined;
    expect(scrollHandler).toBeDefined();

    // First event
    scrollHandler?.();
    rafCallback?.();
    expect(callback).toHaveBeenCalledTimes(1);

    // Second event after first completes
    scrollHandler?.();
    expect(requestAnimationFrame).toHaveBeenCalledTimes(2);
    rafCallback?.();
    expect(callback).toHaveBeenCalledTimes(2);
  });

  it('should reset isEventTriggered even if callback throws', () => {
    const node = createMockElement();
    const callback = vi.fn(() => {
      throw new Error('callback error');
    });
    onAncestorScrollOrResize(node as unknown as Node, callback);

    const scrollHandler = node.addEventListener.mock.calls.find(
      (call: unknown[]) => call[0] === 'scroll'
    )?.[1] as (() => void) | undefined;
    expect(scrollHandler).toBeDefined();

    scrollHandler?.();
    expect(() => {
      rafCallback?.();
    }).toThrow('callback error');

    // Should be able to trigger again because isEventTriggered was reset in finally block
    scrollHandler?.();
    expect(requestAnimationFrame).toHaveBeenCalledTimes(2);
  });
});

describe('ensureLoaded', () => {
  const MockHTMLBodyElement = createMockHTMLClass('HTMLBodyElement');
  const MockHTMLImageElement = createMockHTMLClass('HTMLImageElement');
  const MockHTMLIFrameElement = createMockHTMLClass('HTMLIFrameElement');
  const MockHTMLEmbedElement = createMockHTMLClass('HTMLEmbedElement');
  const MockHTMLLinkElement = createMockHTMLClass('HTMLLinkElement');
  const MockHTMLObjectElement = createMockHTMLClass('HTMLObjectElement');
  const MockHTMLScriptElement = createMockHTMLClass('HTMLScriptElement');
  const MockHTMLStyleElement = createMockHTMLClass('HTMLStyleElement');
  const MockHTMLTrackElement = createMockHTMLClass('HTMLTrackElement');

  beforeEach(() => {
    vi.stubGlobal('HTMLBodyElement', MockHTMLBodyElement);
    vi.stubGlobal('HTMLImageElement', MockHTMLImageElement);
    vi.stubGlobal('HTMLIFrameElement', MockHTMLIFrameElement);
    vi.stubGlobal('HTMLEmbedElement', MockHTMLEmbedElement);
    vi.stubGlobal('HTMLLinkElement', MockHTMLLinkElement);
    vi.stubGlobal('HTMLObjectElement', MockHTMLObjectElement);
    vi.stubGlobal('HTMLScriptElement', MockHTMLScriptElement);
    vi.stubGlobal('HTMLStyleElement', MockHTMLStyleElement);
    vi.stubGlobal('HTMLTrackElement', MockHTMLTrackElement);
    vi.stubGlobal('document', { readyState: 'complete' });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('should resolve immediately when element is already loaded', async () => {
    const el = Object.create(MockHTMLScriptElement.prototype) as Element;
    Object.assign(el, createMockElement());
    await expect(ensureLoaded(el)).resolves.toBeUndefined();
  });

  it('should resolve immediately for a generic element with no loadable children', async () => {
    const el = createMockElement();
    el.querySelectorAll.mockReturnValue([]);
    await expect(ensureLoaded(el as unknown as Element)).resolves.toBeUndefined();
  });

  it('should wait for load event on an unloaded image', async () => {
    const el = Object.create(MockHTMLImageElement.prototype) as Record<string, unknown>;
    let loadHandler: (() => void) | undefined;
    Object.assign(
      el,
      createMockElement({
        addEventListener: vi.fn((event: string, handler: () => void) => {
          if (event === 'load') {
            loadHandler = handler;
          }
        }),
        complete: false,
        naturalWidth: 0
      })
    );

    const promise = ensureLoaded(el as unknown as Element);

    // Simulate the load event firing
    expect(loadHandler).toBeDefined();
    loadHandler?.();

    await expect(promise).resolves.toBeUndefined();
  });

  it('should wait for error event on an unloaded image', async () => {
    const el = Object.create(MockHTMLImageElement.prototype) as Record<string, unknown>;
    let errorHandler: (() => void) | undefined;
    Object.assign(
      el,
      createMockElement({
        addEventListener: vi.fn((event: string, handler: () => void) => {
          if (event === 'error') {
            errorHandler = handler;
          }
        }),
        complete: false,
        naturalWidth: 0
      })
    );

    const promise = ensureLoaded(el as unknown as Element);

    // Simulate the error event firing
    expect(errorHandler).toBeDefined();
    errorHandler?.();

    await expect(promise).resolves.toBeUndefined();
  });

  it('should recursively ensure all loadable children are loaded for generic elements', async () => {
    const script = Object.create(MockHTMLScriptElement.prototype) as Record<string, unknown>;
    Object.assign(script, createMockElement());

    const el = createMockElement();
    el.querySelectorAll.mockReturnValue([script]);

    await expect(ensureLoaded(el as unknown as Element)).resolves.toBeUndefined();
  });

  it('should wait for load on an unloaded iframe', async () => {
    const el = Object.create(MockHTMLIFrameElement.prototype) as Record<string, unknown>;
    let loadHandler: (() => void) | undefined;
    Object.assign(
      el,
      createMockElement({
        addEventListener: vi.fn((event: string, handler: () => void) => {
          if (event === 'load') {
            loadHandler = handler;
          }
        }),
        contentDocument: null
      })
    );

    const promise = ensureLoaded(el as unknown as Element);

    expect(loadHandler).toBeDefined();
    loadHandler?.();

    await expect(promise).resolves.toBeUndefined();
  });

  it('should wait for load on an unloaded style element', async () => {
    const el = Object.create(MockHTMLStyleElement.prototype) as Record<string, unknown>;
    let loadHandler: (() => void) | undefined;
    Object.assign(
      el,
      createMockElement({
        addEventListener: vi.fn((event: string, handler: () => void) => {
          if (event === 'load') {
            loadHandler = handler;
          }
        }),
        sheet: null
      })
    );

    const promise = ensureLoaded(el as unknown as Element);

    expect(loadHandler).toBeDefined();
    loadHandler?.();

    await expect(promise).resolves.toBeUndefined();
  });
});
