// @vitest-environment jsdom
import type { PartialDeep } from 'type-fest';

import {
  beforeEach,
  describe,
  expect,
  it,
  vi
} from 'vitest';

import type { GenericObject } from '../type-guards.ts';
import type { AddToQueueParams } from './queue.ts';

import { noopAsync } from '../function.ts';
import { castTo } from '../object-utils.ts';
import { strictProxy } from '../test-helpers/mock-implementation.ts';
import { assertNonNullable } from '../type-guards.ts';
import {
  CalloutMode,
  renderCallout,
  wrapForCallout
} from './callout.ts';

describe('wrapForCallout', () => {
  it('should wrap a single line with blockquote prefix', () => {
    expect(wrapForCallout('hello')).toBe('> hello');
  });

  it('should wrap multiple lines with blockquote prefix on each line', () => {
    expect(wrapForCallout('line1\nline2\nline3')).toBe('> line1\n> line2\n> line3');
  });

  it('should handle an empty string by returning a single blockquote prefix', () => {
    expect(wrapForCallout('')).toBe('> ');
  });

  it('should handle a string with only a newline', () => {
    expect(wrapForCallout('\n')).toBe('> \n> ');
  });

  it('should handle content that already has blockquote prefixes', () => {
    expect(wrapForCallout('> nested')).toBe('> > nested');
  });

  it('should preserve leading and trailing whitespace within lines', () => {
    expect(wrapForCallout('  indented  ')).toBe('>   indented  ');
  });

  it('should handle multiple empty lines', () => {
    expect(wrapForCallout('\n\n')).toBe('> \n> \n> ');
  });

  it('should wrap multiline markdown content', () => {
    const content = '# Heading\n\nSome paragraph text.\n- item 1\n- item 2';
    const expected = '> # Heading\n> \n> Some paragraph text.\n> - item 1\n> - item 2';
    expect(wrapForCallout(content)).toBe(expected);
  });
});

describe('CalloutMode', () => {
  it('should have a Default mode with value 0', () => {
    expect(CalloutMode.Default).toBe(0);
  });

  it('should have a FoldableCollapsed mode with value 1', () => {
    expect(CalloutMode.FoldableCollapsed).toBe(1);
  });

  it('should have a FoldableExpanded mode with value 2', () => {
    expect(CalloutMode.FoldableExpanded).toBe(2);
  });
});

const mocks = vi.hoisted(() => ({
  addToQueue: vi.fn()
}));

vi.mock('../object-utils.ts', async (importOriginal) => ({
  ...await importOriginal<typeof import('../object-utils.ts')>(),
  normalizeOptionalProperties: vi.fn((obj: unknown) => obj)
}));

vi.mock('../value-provider.ts', () => ({
  resolveValue: vi.fn(async (provider: unknown) => {
    await noopAsync();
    if (typeof provider === 'function') {
      return (provider as () => unknown)();
    }
    return provider;
  })
}));

vi.mock('../obsidian/dataview.ts', () => ({
  getRenderedContainer: vi.fn(async (_dv: unknown, renderer: () => Promise<void>) => {
    await renderer();
    return createEl('p');
  })
}));

vi.mock('../obsidian/i18n/i18n.ts', () => ({
  t: vi.fn((selector: unknown) => {
    if (typeof selector === 'function') {
      const proxy: unknown = new Proxy({}, { get: (): unknown => proxy });
      (selector as (root: unknown) => unknown)(proxy);
    }
    return 'mock-translation';
  })
}));

vi.mock('../obsidian/queue.ts', () => ({
  addToQueue: mocks.addToQueue
}));

interface MockDv {
  app: GenericObject;
  container: HTMLDivElement;
  paragraph: ReturnType<typeof vi.fn>;
}

interface ParagraphOptions {
  container?: HTMLElement;
}

function createMockDv(): MockDv {
  const container = createDiv();
  return {
    app: {},
    container,
    paragraph: vi.fn((text: unknown, options?: ParagraphOptions) => {
      const p = createEl('p');
      if (typeof text === 'string') {
        // eslint-disable-next-line @microsoft/sdl/no-inner-html -- test setup
        p.innerHTML = text;
      } else if (text instanceof Node) {
        p.appendChild(text);
      }
      const target = options?.container ?? container;
      target.appendChild(p);
      return p;
    })
  };
}

let intersectionCallback: IntersectionObserverCallback;
const mockObserve = vi.fn();
const mockUnobserve = vi.fn();
const mockDisconnect = vi.fn();

describe('renderCallout', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    globalThis.IntersectionObserver = castTo<typeof IntersectionObserver>(
      vi.fn(function MockIntersectionObserver(this: IntersectionObserver, callback: IntersectionObserverCallback) {
        intersectionCallback = callback;
        Object.assign(this, {
          disconnect: mockDisconnect,
          observe: mockObserve,
          root: null,
          rootMargin: '0px',
          takeRecords: vi.fn(() => []),
          thresholds: [0],
          unobserve: mockUnobserve
        });
      })
    );

    // Obsidian extends HTMLElement with .empty()
    HTMLElement.prototype.empty = function empty(this: HTMLElement): void {
      this.innerHTML = '';
    };
  });

  it('should create a callout paragraph with FoldableCollapsed modifier by default', async () => {
    await noopAsync();
    const dv = createMockDv();

    renderCallout({ dv: dv as never });

    const firstCallArgs = dv.paragraph.mock.calls[0] as unknown[];
    expect(firstCallArgs[0]).toBe('> [!NOTE]- \n>\n> <div class="content"></div>');
  });

  it('should create a callout paragraph with Default mode (no modifier)', async () => {
    await noopAsync();
    const dv = createMockDv();

    renderCallout({ dv: dv as never, mode: CalloutMode.Default });

    const firstCallArgs = dv.paragraph.mock.calls[0] as unknown[];
    expect(firstCallArgs[0]).toBe('> [!NOTE] \n>\n> <div class="content"></div>');
  });

  it('should create a callout paragraph with FoldableExpanded modifier', async () => {
    await noopAsync();
    const dv = createMockDv();

    renderCallout({ dv: dv as never, mode: CalloutMode.FoldableExpanded });

    const firstCallArgs = dv.paragraph.mock.calls[0] as unknown[];
    expect(firstCallArgs[0]).toBe('> [!NOTE]+ \n>\n> <div class="content"></div>');
  });

  it('should use the specified type in the callout', async () => {
    await noopAsync();
    const dv = createMockDv();

    renderCallout({ dv: dv as never, type: 'WARNING' });

    const firstCallArgs = dv.paragraph.mock.calls[0] as unknown[];
    expect(firstCallArgs[0]).toBe('> [!WARNING]- \n>\n> <div class="content"></div>');
  });

  it('should use the specified header in the callout', async () => {
    await noopAsync();
    const dv = createMockDv();

    renderCallout({ dv: dv as never, header: 'My Header' });

    const firstCallArgs = dv.paragraph.mock.calls[0] as unknown[];
    expect(firstCallArgs[0]).toBe('> [!NOTE]- My Header\n>\n> <div class="content"></div>');
  });

  it('should show "Loading..." initially in the content div', async () => {
    await noopAsync();
    const dv = createMockDv();

    renderCallout({ dv: dv as never });

    // The second call to dv.paragraph should be the loading text
    expect(dv.paragraph).toHaveBeenCalledTimes(2);
    const secondCall = dv.paragraph.mock.calls[1] as unknown[];
    expect(secondCall[0]).toBe('Loading... ⏳');
    expect(secondCall[1]).toHaveProperty('container');
  });

  it('should set up an IntersectionObserver and observe the content div', async () => {
    await noopAsync();
    const dv = createMockDv();

    renderCallout({ dv: dv as never });

    expect(IntersectionObserver).toHaveBeenCalledWith(expect.any(Function));
    expect(mockObserve).toHaveBeenCalledTimes(1);
    // The observed element should be the .content div
    const firstObserveCall = mockObserve.mock.calls[0];
    assertNonNullable(firstObserveCall);
    const observedEl = firstObserveCall[0] as HTMLElement;
    expect(observedEl.className).toBe('content');
  });

  it('should call addToQueue when IntersectionObserver fires with isIntersecting', async () => {
    await noopAsync();
    const dv = createMockDv();

    renderCallout({ dv: dv as never });

    const firstObserveCall = mockObserve.mock.calls[0];
    assertNonNullable(firstObserveCall);
    const observedEl = firstObserveCall[0] as HTMLElement;

    // Simulate intersection
    intersectionCallback(
      [strictProxy<IntersectionObserverEntry>({ isIntersecting: true, target: castTo<PartialDeep<Element>>(observedEl) })],
      strictProxy<IntersectionObserver>({})
    );

    expect(mockUnobserve).toHaveBeenCalledWith(observedEl);
    expect(mocks.addToQueue).toHaveBeenCalledTimes(1);
    expect(mocks.addToQueue).toHaveBeenCalledWith(
      expect.objectContaining({
        app: dv.app,
        operationFn: expect.any(Function) as unknown,
        operationName: 'mock-translation'
      })
    );
  });

  it('should not call addToQueue when entry is not intersecting', async () => {
    await noopAsync();
    const dv = createMockDv();

    renderCallout({ dv: dv as never });

    const firstObserveCall = mockObserve.mock.calls[0];
    assertNonNullable(firstObserveCall);
    const observedEl = firstObserveCall[0] as HTMLElement;

    intersectionCallback(
      [strictProxy<IntersectionObserverEntry>({ isIntersecting: false, target: castTo<PartialDeep<Element>>(observedEl) })],
      strictProxy<IntersectionObserver>({})
    );

    expect(mockUnobserve).not.toHaveBeenCalled();
    expect(mocks.addToQueue).not.toHaveBeenCalled();
  });

  it('should pass abortSignal to addToQueue when provided', async () => {
    await noopAsync();
    const dv = createMockDv();
    const abortController = new AbortController();

    renderCallout({ abortSignal: abortController.signal, dv: dv as never });

    const firstObserveCall = mockObserve.mock.calls[0];
    assertNonNullable(firstObserveCall);
    const observedEl = firstObserveCall[0] as HTMLElement;

    intersectionCallback(
      [strictProxy<IntersectionObserverEntry>({ isIntersecting: true, target: castTo<PartialDeep<Element>>(observedEl) })],
      strictProxy<IntersectionObserver>({})
    );

    expect(mocks.addToQueue).toHaveBeenCalledWith(
      expect.objectContaining({
        abortSignal: abortController.signal
      })
    );
  });

  it('should render string content when loadContent is invoked', async () => {
    const dv = createMockDv();

    // eslint-disable-next-line obsidian-dev-utils/no-async-callback-to-unsafe-return -- Mocking async function.
    mocks.addToQueue.mockImplementationOnce(async (params: AddToQueueParams) => {
      const abortController = new AbortController();
      await params.operationFn(abortController.signal);
    });

    renderCallout({ contentProvider: 'Hello World', dv: dv as never });

    const firstObserveCall1 = mockObserve.mock.calls[0];
    assertNonNullable(firstObserveCall1);
    const observedEl = firstObserveCall1[0] as HTMLElement;

    intersectionCallback(
      [strictProxy<IntersectionObserverEntry>({ isIntersecting: true, target: castTo<PartialDeep<Element>>(observedEl) })],
      strictProxy<IntersectionObserver>({})
    );

    // Wait for async loadContent to settle
    await vi.waitFor(() => {
      // After loadContent runs, dv.paragraph should have been called with the content
      // Calls: 1st = callout paragraph, 2nd = loading text, 3rd = final content
      expect(dv.paragraph.mock.calls.length).toBeGreaterThanOrEqual(3);
    });

    const lastCall = dv.paragraph.mock.calls[dv.paragraph.mock.calls.length - 1] as unknown[];
    expect(lastCall[0]).toBe('Hello World');
  });

  it('should render content from a function contentProvider', async () => {
    const dv = createMockDv();
    const contentFn = vi.fn(() => 'Dynamic Content');

    // eslint-disable-next-line obsidian-dev-utils/no-async-callback-to-unsafe-return -- Mocking async function.
    mocks.addToQueue.mockImplementationOnce(async (params: AddToQueueParams) => {
      const abortController = new AbortController();
      await params.operationFn(abortController.signal);
    });

    renderCallout({ contentProvider: contentFn, dv: dv as never });

    const firstObserveCall2 = mockObserve.mock.calls[0];
    assertNonNullable(firstObserveCall2);
    const observedEl = firstObserveCall2[0] as HTMLElement;

    intersectionCallback(
      [strictProxy<IntersectionObserverEntry>({ isIntersecting: true, target: castTo<PartialDeep<Element>>(observedEl) })],
      strictProxy<IntersectionObserver>({})
    );

    await vi.waitFor(() => {
      expect(dv.paragraph.mock.calls.length).toBeGreaterThanOrEqual(3);
    });

    const lastCall = dv.paragraph.mock.calls[dv.paragraph.mock.calls.length - 1] as unknown[];
    expect(lastCall[0]).toBe('Dynamic Content');
  });

  it('should use the rendered paragraph as fallback when contentProvider returns undefined', async () => {
    const dv = createMockDv();

    // eslint-disable-next-line obsidian-dev-utils/no-async-callback-to-unsafe-return -- Mocking async function.
    mocks.addToQueue.mockImplementationOnce(async (options: AddToQueueParams) => {
      const abortController = new AbortController();
      await options.operationFn(abortController.signal);
    });

    // Use a function that returns undefined so resolveValue returns undefined,
    // Triggering the content ??= paragraph fallback path
    renderCallout({ contentProvider: () => undefined, dv: dv as never });

    const firstObserveCall3 = mockObserve.mock.calls[0];
    assertNonNullable(firstObserveCall3);
    const observedEl = firstObserveCall3[0] as HTMLElement;

    intersectionCallback(
      [strictProxy<IntersectionObserverEntry>({ isIntersecting: true, target: castTo<PartialDeep<Element>>(observedEl) })],
      strictProxy<IntersectionObserver>({})
    );

    await vi.waitFor(() => {
      expect(dv.paragraph.mock.calls.length).toBeGreaterThanOrEqual(3);
    });

    // When contentProvider resolves to undefined, content ??= paragraph (the getRenderedContainer result)
    const lastCall = dv.paragraph.mock.calls[dv.paragraph.mock.calls.length - 1] as unknown[];
    expect(lastCall[0]).toBeInstanceOf(HTMLParagraphElement);
  });

  it('should combine custom type, header, and FoldableExpanded mode correctly', async () => {
    await noopAsync();
    const dv = createMockDv();

    renderCallout({
      dv: dv as never,
      header: 'Important',
      mode: CalloutMode.FoldableExpanded,
      type: 'TIP'
    });

    const firstCallArgs = dv.paragraph.mock.calls[0] as unknown[];
    expect(firstCallArgs[0]).toBe('> [!TIP]+ Important\n>\n> <div class="content"></div>');
  });
});

describe('getModifier (tested indirectly through renderCallout)', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    globalThis.IntersectionObserver = castTo<typeof IntersectionObserver>(vi.fn(function MockIntersectionObserver(this: IntersectionObserver) {
      Object.assign(this, {
        disconnect: vi.fn(),
        observe: vi.fn(),
        root: null,
        rootMargin: '0px',
        takeRecords: vi.fn(() => []),
        thresholds: [0],
        unobserve: vi.fn()
      });
    }));

    HTMLElement.prototype.empty = function empty(this: HTMLElement): void {
      this.innerHTML = '';
    };
  });

  it('should produce "-" modifier for FoldableCollapsed mode', async () => {
    await noopAsync();
    const dv = createMockDv();

    renderCallout({ dv: dv as never, mode: CalloutMode.FoldableCollapsed });

    const firstParagraphCall1 = dv.paragraph.mock.calls[0];
    assertNonNullable(firstParagraphCall1);
    const calloutText = firstParagraphCall1[0] as string;
    expect(calloutText).toContain('[!NOTE]-');
  });

  it('should produce "+" modifier for FoldableExpanded mode', async () => {
    await noopAsync();
    const dv = createMockDv();

    renderCallout({ dv: dv as never, mode: CalloutMode.FoldableExpanded });

    const firstParagraphCall2 = dv.paragraph.mock.calls[0];
    assertNonNullable(firstParagraphCall2);
    const calloutText = firstParagraphCall2[0] as string;
    expect(calloutText).toContain('[!NOTE]+');
  });

  it('should produce no modifier for Default mode', async () => {
    await noopAsync();
    const dv = createMockDv();

    renderCallout({ dv: dv as never, mode: CalloutMode.Default });

    const firstParagraphCall3 = dv.paragraph.mock.calls[0];
    assertNonNullable(firstParagraphCall3);
    const calloutText = firstParagraphCall3[0] as string;
    // Default mode: no modifier between ] and space
    expect(calloutText).toMatch(/\[!NOTE\] /);
    expect(calloutText).not.toMatch(/\[!NOTE\][+-]/);
  });
});
