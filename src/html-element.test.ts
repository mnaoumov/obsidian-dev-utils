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

import {
  getZIndex,
  isElementVisibleInOffsetParent,
  toPx
} from './html-element.ts';
import { strictProxy } from './strict-proxy.ts';
import { ensureGenericObject } from './type-guards.ts';

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

describe('getZIndex', () => {
  beforeEach(() => {
    vi.stubGlobal('getComputedStyle', vi.fn());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('should return the z-index from computed style when set', () => {
    const el = buildElement();
    vi.mocked(getComputedStyle).mockReturnValue(strictProxy<CSSStyleDeclaration>({ zIndex: '10' }));
    expect(getZIndex(el)).toBe(10);
  });

  it('should return 0 for an element with auto z-index and no parent', () => {
    const el = buildElement();
    vi.mocked(getComputedStyle).mockReturnValue(strictProxy<CSSStyleDeclaration>({ zIndex: 'auto' }));
    expect(getZIndex(el)).toBe(0);
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
    const el = buildElement();
    vi.mocked(getComputedStyle).mockReturnValue(strictProxy<CSSStyleDeclaration>({ zIndex: '-3' }));
    expect(getZIndex(el)).toBe(-3);
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

describe('isElementVisibleInOffsetParent', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('should return false when offsetParent is null', () => {
    const el = buildElement({ attrs: { offsetParent: null }, tag: 'div' });
    expect(isElementVisibleInOffsetParent(el)).toBe(false);
  });

  it('should return true when element is fully within offset parent', () => {
    const parent = buildElement();
    parent.getBoundingClientRect = vi.fn((): DOMRect => ({ bottom: 200, height: 200, left: 0, right: 200, toJSON: vi.fn(), top: 0, width: 200, x: 0, y: 0 }));
    const el = buildElement({ attrs: { offsetParent: parent }, tag: 'div' });
    el.getBoundingClientRect = vi.fn((): DOMRect => ({ bottom: 100, height: 90, left: 10, right: 100, toJSON: vi.fn(), top: 10, width: 90, x: 10, y: 10 }));
    expect(isElementVisibleInOffsetParent(el)).toBe(true);
  });

  it('should return false when element extends above offset parent', () => {
    const parent = buildElement();
    parent.getBoundingClientRect = vi.fn((): DOMRect => ({ bottom: 200, height: 150, left: 0, right: 200, toJSON: vi.fn(), top: 50, width: 200, x: 0, y: 50 }));
    const el = buildElement({ parent });
    el.getBoundingClientRect = vi.fn((): DOMRect => ({ bottom: 100, height: 90, left: 10, right: 100, toJSON: vi.fn(), top: 10, width: 90, x: 10, y: 10 }));
    expect(isElementVisibleInOffsetParent(el)).toBe(false);
  });

  it('should return false when element extends below offset parent', () => {
    const parent = buildElement();
    parent.getBoundingClientRect = vi.fn((): DOMRect => ({ bottom: 100, height: 100, left: 0, right: 200, toJSON: vi.fn(), top: 0, width: 200, x: 0, y: 0 }));
    const el = buildElement({ attrs: { offsetParent: parent }, tag: 'div' });
    el.getBoundingClientRect = vi.fn((): DOMRect => ({ bottom: 150, height: 140, left: 10, right: 100, toJSON: vi.fn(), top: 10, width: 90, x: 10, y: 10 }));
    expect(isElementVisibleInOffsetParent(el)).toBe(false);
  });

  it('should return false when element extends left of offset parent', () => {
    const parent = buildElement();
    parent.getBoundingClientRect = vi.fn((): DOMRect => ({ bottom: 200, height: 150, left: 50, right: 200, toJSON: vi.fn(), top: 0, width: 150, x: 50, y: 0 }));
    const el = buildElement({ attrs: { offsetParent: parent }, tag: 'div' });
    el.getBoundingClientRect = vi.fn((): DOMRect => ({ bottom: 100, height: 90, left: 10, right: 100, toJSON: vi.fn(), top: 10, width: 90, x: 10, y: 10 }));
    expect(isElementVisibleInOffsetParent(el)).toBe(false);
  });

  it('should return false when element extends right of offset parent', () => {
    const parent = buildElement();
    parent.getBoundingClientRect = vi.fn((): DOMRect => ({ bottom: 200, height: 100, left: 0, right: 100, toJSON: vi.fn(), top: 0, width: 100, x: 0, y: 0 }));
    const el = buildElement({ attrs: { offsetParent: parent }, tag: 'div' });
    el.getBoundingClientRect = vi.fn((): DOMRect => ({ bottom: 100, height: 90, left: 10, right: 150, toJSON: vi.fn(), top: 10, width: 140, x: 10, y: 10 }));
    expect(isElementVisibleInOffsetParent(el)).toBe(false);
  });

  it('should return true when element exactly matches offset parent bounds', () => {
    const parent = buildElement();
    parent.getBoundingClientRect = vi.fn((): DOMRect => ({ bottom: 100, height: 100, left: 0, right: 100, toJSON: vi.fn(), top: 0, width: 100, x: 0, y: 0 }));
    const el = buildElement({ attrs: { offsetParent: parent }, tag: 'div' });
    el.getBoundingClientRect = vi.fn((): DOMRect => ({ bottom: 100, height: 100, left: 0, right: 100, toJSON: vi.fn(), top: 0, width: 100, x: 0, y: 0 }));
    expect(isElementVisibleInOffsetParent(el)).toBe(true);
  });
});

interface BuildElementParams {
  readonly attrs?: GenericObject;
  readonly parent?: HTMLElement | undefined;
  readonly tag?: keyof HTMLElementTagNameMap;
}

function buildElement(params: BuildElementParams = {}): HTMLElement {
  const { attrs = {}, parent, tag = 'div' } = params;
  const el = createEl(tag);
  const record = ensureGenericObject(el);
  for (const [key, value] of Object.entries(attrs)) {
    Object.defineProperty(record, key, { configurable: true, value, writable: true });
  }
  if (parent) {
    parent.appendChild(el);
  }
  return el;
}
