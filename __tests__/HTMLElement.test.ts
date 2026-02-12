// @vitest-environment jsdom

import {
  describe,
  expect,
  it,
  vi
} from 'vitest';

import {
  getZIndex,
  isElementVisibleInOffsetParent,
  isLoaded,
  onAncestorScrollOrResize,
  toPx
} from '../src/HTMLElement.ts';

describe('toPx', () => {
  it.each([
    [0, '0px'],
    [42, '42px'],
    [-5, '-5px'],
    [3.14, '3.14px']
  ])('should convert %j to %j', (input: number, expected: string) => {
    expect(toPx(input)).toBe(expected);
  });
});

describe('getZIndex', () => {
  it('should return 0 for an element with no z-index', () => {
    const el = document.createElement('div');
    document.body.appendChild(el);
    expect(getZIndex(el)).toBe(0);
    el.remove();
  });

  it('should return the z-index from computed style when set', () => {
    const el = document.createElement('div');
    document.body.appendChild(el);
    vi.spyOn(window, 'getComputedStyle').mockReturnValue({ zIndex: '10' } as CSSStyleDeclaration);
    expect(getZIndex(el)).toBe(10);
    vi.restoreAllMocks();
    el.remove();
  });

  it('should return parent z-index if child has auto', () => {
    const parent = document.createElement('div');
    const child = document.createElement('div');
    parent.appendChild(child);
    document.body.appendChild(parent);
    vi.spyOn(window, 'getComputedStyle').mockImplementation((target) => {
      if (target === child) {
        return { zIndex: 'auto' } as CSSStyleDeclaration;
      }
      if (target === parent) {
        return { zIndex: '5' } as CSSStyleDeclaration;
      }
      return { zIndex: 'auto' } as CSSStyleDeclaration;
    });
    expect(getZIndex(child)).toBe(5);
    vi.restoreAllMocks();
    parent.remove();
  });

  it('should return 0 if no ancestor has a numeric z-index', () => {
    const parent = document.createElement('div');
    const child = document.createElement('div');
    parent.appendChild(child);
    document.body.appendChild(parent);
    vi.spyOn(window, 'getComputedStyle').mockReturnValue({ zIndex: 'auto' } as CSSStyleDeclaration);
    expect(getZIndex(child)).toBe(0);
    vi.restoreAllMocks();
    parent.remove();
  });
});

describe('isLoaded', () => {
  it('should return true for HTMLScriptElement', () => {
    const script = document.createElement('script');
    expect(isLoaded(script)).toBe(true);
  });

  it('should return true for HTMLImageElement with complete=true and naturalWidth>0', () => {
    const img = document.createElement('img');
    Object.defineProperty(img, 'complete', { value: true });
    Object.defineProperty(img, 'naturalWidth', { value: 100 });
    expect(isLoaded(img)).toBe(true);
  });

  it('should return false for HTMLImageElement with complete=false', () => {
    const img = document.createElement('img');
    Object.defineProperty(img, 'complete', { value: false });
    expect(isLoaded(img)).toBe(false);
  });

  it('should return true for HTMLIFrameElement with contentDocument', () => {
    const iframe = document.createElement('iframe');
    document.body.appendChild(iframe);
    expect(isLoaded(iframe)).toBe(true);
    iframe.remove();
  });

  it('should return false for HTMLIFrameElement without contentDocument', () => {
    const iframe = document.createElement('iframe');
    Object.defineProperty(iframe, 'contentDocument', { value: null, configurable: true });
    expect(isLoaded(iframe)).toBe(false);
  });

  it('should return false for HTMLLinkElement with rel=stylesheet and sheet=null', () => {
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    expect(isLoaded(link)).toBe(false);
  });

  it('should return true for HTMLLinkElement with rel=stylesheet and sheet set', () => {
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    Object.defineProperty(link, 'sheet', { value: {}, configurable: true });
    expect(isLoaded(link)).toBe(true);
  });

  it('should return true for a generic element with no loadable children', () => {
    const div = document.createElement('div');
    expect(isLoaded(div)).toBe(true);
  });
});

describe('isElementVisibleInOffsetParent', () => {
  it('should return false when offsetParent is null', () => {
    const el = document.createElement('div');
    expect(isElementVisibleInOffsetParent(el)).toBe(false);
  });
});

describe('onAncestorScrollOrResize', () => {
  it('should return a cleanup function', () => {
    const node = document.createElement('div');
    document.body.appendChild(node);
    const cleanup = onAncestorScrollOrResize(node, vi.fn());
    expect(typeof cleanup).toBe('function');
    cleanup();
    node.remove();
  });

  it('should allow calling the cleanup function without throwing', () => {
    const node = document.createElement('div');
    document.body.appendChild(node);
    const cleanup = onAncestorScrollOrResize(node, vi.fn());
    expect(() => cleanup()).not.toThrow();
    node.remove();
  });
});
