// @vitest-environment jsdom

import type { PartialDeep } from 'type-fest';

import {
  afterAll,
  beforeEach,
  describe,
  expect,
  it,
  vi
} from 'vitest';

import type { DataviewInlineApi } from './dataview.ts';

import { noop } from '../function.ts';
import { castTo } from '../object-utils.ts';
import { strictProxy } from '../test-helpers/mock-implementation.ts';
import { assertNonNullable } from '../type-guards.ts';
import {
  getRenderedContainer,
  insertCodeBlock,
  reloadCurrentFileCache,
  renderIframe,
  renderPaginatedList,
  renderPaginatedTable
} from './dataview.ts';
import { getFile } from './file-system.ts';

interface PathHolder {
  path: string;
}

vi.mock('../async.ts', () => ({
  convertAsyncToSync: vi.fn((fn: (...args: unknown[]) => Promise<unknown>) => fn)
}));

vi.mock('../error.ts', () => ({
  errorToString: vi.fn((e: unknown) => String(e)),
  throwExpression: vi.fn((msg: unknown) => {
    throw msg;
  })
}));

vi.mock('../obsidian/file-system.ts', () => ({
  getFile: vi.fn((_app: unknown, path: unknown) => ({ path })),
  getPath: vi.fn((_app: unknown, path: unknown) => typeof path === 'string' ? path : (path as PathHolder).path)
}));

vi.mock('../obsidian/resource-url.ts', () => ({
  relativePathToResourceUrl: vi.fn(
    (_app: unknown, path: string, _notePath: string) => `app://resource/${path}`
  )
}));

vi.mock('../obsidian/i18n/i18n.ts', () => ({
  t: vi.fn((fn: (...args: unknown[]) => unknown, options?: unknown) => {
    try {
      const translations = {
        obsidianDevUtils: {
          dataview: {
            itemsPerPage: 'Items per page:',
            jumpToPage: 'Jump to page:',
            pageHeader: 'Page info'
          }
        }
      };
      return fn(translations, options);
    } catch {
      return 'mock-translation';
    }
  })
}));

interface ElOptions {
  attr?: Record<string, string>;
}

interface ParagraphOptions {
  container?: HTMLElement;
}

function createMockDv(): DataviewInlineApi {
  const container = createDiv();
  document.body.appendChild(container);

  return strictProxy<DataviewInlineApi>({
    app: { metadataCache: {}, vault: { adapter: {} } },
    container: castTo<PartialDeep<HTMLElement>>(container),
    current: castTo<DataviewInlineApi['current']>(vi.fn(() => ({ file: { path: 'current.md' } }))),
    el: castTo<DataviewInlineApi['el']>(vi.fn(
      (
        tag: string,
        _text: string,
        options?: ElOptions
      ) => {
        const el = createEl(tag as keyof HTMLElementTagNameMap);
        if (options?.attr) {
          for (const [k, v] of Object.entries(options.attr)) {
            el.setAttribute(k, v);
          }
        }
        container.appendChild(el);
        return el;
      }
    )),
    list: vi.fn(async () => {
      noop();
    }),
    paragraph: vi.fn(
      (text: unknown, options?: ParagraphOptions) => {
        const p = createEl('p');
        if (typeof text === 'string') {
          p.textContent = text;
        }
        (options?.container ?? container).appendChild(p);
        return p;
      }
    ),
    table: vi.fn(async () => {
      noop();
    })
  });
}

afterAll(() => {
  vi.restoreAllMocks();
});

describe('getRenderedContainer', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should render content and return temp container', async () => {
    const dv = createMockDv();
    const renderer = vi.fn();

    const result = await getRenderedContainer(dv, renderer);

    expect(renderer).toHaveBeenCalledOnce();
    expect(result).toBeInstanceOf(HTMLParagraphElement);
  });

  it('should restore the original container after rendering', async () => {
    const dv = createMockDv();
    const originalContainer = dv.container;

    await getRenderedContainer(dv, vi.fn());

    expect(dv.container).toBe(originalContainer);
  });

  it('should call paragraph to create temp container', async () => {
    const dv = createMockDv();

    await getRenderedContainer(dv, vi.fn());

    // eslint-disable-next-line @typescript-eslint/unbound-method -- Valid usage.
    expect(dv.paragraph).toHaveBeenCalledWith('');
  });

  it('should handle errors in renderer and display error message', async () => {
    const dv = createMockDv();
    const error = new Error('test error');
    const renderer = vi.fn(() => {
      throw error;
    });

    const result = await getRenderedContainer(dv, renderer);

    // eslint-disable-next-line @typescript-eslint/unbound-method -- Valid usage.
    expect(dv.paragraph).toHaveBeenCalledWith(expect.stringContaining('Error: test error'));
    expect(result).toBeInstanceOf(HTMLParagraphElement);
  });

  it('should restore original container even if renderer throws', async () => {
    const dv = createMockDv();
    const originalContainer = dv.container;

    await getRenderedContainer(dv, () => {
      throw new Error('fail');
    });

    expect(dv.container).toBe(originalContainer);
  });

  it('should remove temp container from DOM after rendering', async () => {
    const dv = createMockDv();
    const originalContainer = dv.container;

    const result = await getRenderedContainer(dv, vi.fn());

    expect(originalContainer.contains(result)).toBe(false);
  });

  it('should set dv.container to the temp container during rendering', async () => {
    const dv = createMockDv();
    let containerDuringRender: HTMLElement | undefined;

    await getRenderedContainer(dv, () => {
      containerDuringRender = dv.container;
    });

    expect(containerDuringRender).toBeInstanceOf(HTMLParagraphElement);
  });

  it('should handle async renderer', async () => {
    const dv = createMockDv();
    let resolved = false;
    async function renderer(): Promise<void> {
      await Promise.resolve();
      resolved = true;
    }

    await getRenderedContainer(dv, renderer);

    expect(resolved).toBe(true);
  });
});

describe('insertCodeBlock', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should create a paragraph with fenced code block', () => {
    const dv = createMockDv();

    insertCodeBlock(dv, 'js', 'const x = 1;');

    // eslint-disable-next-line @typescript-eslint/unbound-method -- Valid usage.
    expect(dv.paragraph).toHaveBeenCalledWith('```js\nconst x = 1;\n```');
  });

  it('should use 3 backticks for code without backtick fences', () => {
    const dv = createMockDv();

    insertCodeBlock(dv, 'python', 'print("hello")');

    // eslint-disable-next-line @typescript-eslint/unbound-method -- Valid usage.
    const call = vi.mocked(dv.paragraph).mock.calls[0];
    const text = call?.[0] as string;
    expect(text.startsWith('```python')).toBe(true);
    expect(text.endsWith('```')).toBe(true);
  });

  it('should use longer fence when code contains triple backticks', () => {
    const dv = createMockDv();
    const codeWithFence = '```\ninner code\n```';

    insertCodeBlock(dv, 'md', codeWithFence);

    // eslint-disable-next-line @typescript-eslint/unbound-method -- Valid usage.
    const call = vi.mocked(dv.paragraph).mock.calls[0];
    const text = call?.[0] as string;
    expect(text.startsWith('````md')).toBe(true);
    expect(text.endsWith('````')).toBe(true);
  });

  it('should use even longer fence when code contains 4 backtick fences', () => {
    const dv = createMockDv();
    const codeWithFence = '````\ninner code\n````';

    insertCodeBlock(dv, 'md', codeWithFence);

    // eslint-disable-next-line @typescript-eslint/unbound-method -- Valid usage.
    const call = vi.mocked(dv.paragraph).mock.calls[0];
    const text = call?.[0] as string;
    expect(text.startsWith('`````md')).toBe(true);
    expect(text.endsWith('`````')).toBe(true);
  });

  it('should handle empty code string', () => {
    const dv = createMockDv();

    insertCodeBlock(dv, 'text', '');

    // eslint-disable-next-line @typescript-eslint/unbound-method -- Valid usage.
    expect(dv.paragraph).toHaveBeenCalledWith('```text\n\n```');
  });

  it('should handle code with mixed fence lengths', () => {
    const dv = createMockDv();
    const codeWithMixedFences = '```\nshort\n```\n`````\nlong\n`````';

    insertCodeBlock(dv, 'md', codeWithMixedFences);

    // eslint-disable-next-line @typescript-eslint/unbound-method -- Valid usage.
    const call = vi.mocked(dv.paragraph).mock.calls[0];
    const text = call?.[0] as string;
    // The longest fence in the code is 5 backticks, so the result should be 6
    expect(text.startsWith('``````md')).toBe(true);
    expect(text.endsWith('``````')).toBe(true);
  });
});

describe('renderIframe', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should create an iframe element with default dimensions', () => {
    const dv = createMockDv();

    renderIframe({ dv, relativePathOrFile: 'test.html' });

    // eslint-disable-next-line @typescript-eslint/unbound-method -- Valid usage.
    expect(dv.el).toHaveBeenCalledWith('iframe', '', {
      attr: {
        height: '600px',
        src: 'app://resource/test.html',
        width: '100%'
      }
    });
  });

  it('should create an iframe element with custom dimensions', () => {
    const dv = createMockDv();

    renderIframe({
      dv,
      height: '400px',
      relativePathOrFile: 'page.html',
      width: '50%'
    });

    // eslint-disable-next-line @typescript-eslint/unbound-method -- Valid usage.
    expect(dv.el).toHaveBeenCalledWith('iframe', '', {
      attr: {
        height: '400px',
        src: 'app://resource/page.html',
        width: '50%'
      }
    });
  });

  it('should call current() to get the note path', () => {
    const dv = createMockDv();

    renderIframe({ dv, relativePathOrFile: 'file.html' });

    // eslint-disable-next-line @typescript-eslint/unbound-method -- Valid usage.
    expect(dv.current).toHaveBeenCalled();
  });
});

describe('renderPaginatedList', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should show "No items found" for empty rows', async () => {
    const dv = createMockDv();

    await renderPaginatedList({ dv, rows: [] });

    // eslint-disable-next-line @typescript-eslint/unbound-method -- Valid usage.
    expect(dv.paragraph).toHaveBeenCalledWith('No items found');
  });

  it('should call dv.list for non-empty rows', async () => {
    const dv = createMockDv();
    const rows = ['item1', 'item2', 'item3'];

    await renderPaginatedList({ dv, rows });

    // eslint-disable-next-line @typescript-eslint/unbound-method -- Valid usage.
    expect(dv.list).toHaveBeenCalled();
  });

  it('should render pagination controls for non-empty rows', async () => {
    const dv = createMockDv();
    const rows = ['item1', 'item2', 'item3'];

    await renderPaginatedList({ dv, rows });

    // Pagination controls should be in the container
    const paginationDiv = dv.container.querySelector('.pagination');
    expect(paginationDiv).not.toBeNull();
  });

  it('should render only first page items with default items per page', async () => {
    const dv = createMockDv();
    const rows = Array.from({ length: 25 }, (_, i) => `item${String(i)}`);

    await renderPaginatedList({ dv, rows });

    // Default is 10 items per page, dv.list should be called with first 10 items

    // eslint-disable-next-line @typescript-eslint/unbound-method -- Valid usage.
    const listCall = vi.mocked(dv.list).mock.calls[0];
    expect(listCall).toBeDefined();
    const passedRows = listCall?.[0] as string[];
    expect(passedRows).toHaveLength(10);
  });

  it('should use custom itemsPerPageOptions', async () => {
    const dv = createMockDv();
    const rows = Array.from({ length: 10 }, (_, i) => `item${String(i)}`);

    await renderPaginatedList({ dv, itemsPerPageOptions: [5, 15], rows });

    // Should use first option (5) as items per page

    // eslint-disable-next-line @typescript-eslint/unbound-method -- Valid usage.
    const listCall = vi.mocked(dv.list).mock.calls[0];
    const passedRows = listCall?.[0] as string[];
    expect(passedRows).toHaveLength(5);
  });

  it('should create page navigation links', async () => {
    const dv = createMockDv();
    const rows = Array.from({ length: 25 }, (_, i) => `item${String(i)}`);

    await renderPaginatedList({ dv, rows });

    const links = dv.container.querySelectorAll('.page-link');
    // Should have First, Prev, page numbers, Next, Last
    expect(links.length).toBeGreaterThan(0);
  });

  it('should disable First and Prev links on first page', async () => {
    const dv = createMockDv();
    const rows = Array.from({ length: 25 }, (_, i) => `item${String(i)}`);

    await renderPaginatedList({ dv, rows });

    const links = dv.container.querySelectorAll('.page-link');
    const firstLink = links[0];
    const prevLink = links[1];
    expect(firstLink?.classList.contains('disabled')).toBe(true);
    expect(prevLink?.classList.contains('disabled')).toBe(true);
  });

  it('should mark current page link as current', async () => {
    const dv = createMockDv();
    const rows = Array.from({ length: 25 }, (_, i) => `item${String(i)}`);

    await renderPaginatedList({ dv, rows });

    const currentLink = dv.container.querySelector('.page-link.current');
    expect(currentLink).not.toBeNull();
    expect(currentLink?.textContent).toBe('1');
  });

  it('should create items-per-page select dropdown', async () => {
    const dv = createMockDv();
    const rows = ['item1', 'item2'];

    await renderPaginatedList({ dv, rows });

    const select = dv.container.querySelector('select');
    expect(select).not.toBeNull();
  });

  it('should create jump-to-page input', async () => {
    const dv = createMockDv();
    const rows = ['item1', 'item2'];

    await renderPaginatedList({ dv, rows });

    const input = dv.container.querySelector('input[type="number"]');
    expect(input).not.toBeNull();
  });

  it('should include a style element with pagination CSS', async () => {
    const dv = createMockDv();
    const rows = ['item1'];

    await renderPaginatedList({ dv, rows });

    const style = dv.container.querySelector('style');
    expect(style).not.toBeNull();
    expect(style?.textContent).toContain('.pagination');
  });

  it('should create select options matching itemsPerPageOptions', async () => {
    const dv = createMockDv();
    const rows = Array.from({ length: 50 }, (_, i) => `item${String(i)}`);

    await renderPaginatedList({
      dv,
      itemsPerPageOptions: [5, 10, 25],
      rows
    });

    const options = dv.container.querySelectorAll('select option');
    expect(options).toHaveLength(3);
    expect(options[0]?.textContent).toBe('5');
    expect(options[1]?.textContent).toBe('10');
    expect(options[2]?.textContent).toBe('25');
  });
});

describe('renderPaginatedTable', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should show "No items found" for empty rows', async () => {
    const dv = createMockDv();

    await renderPaginatedTable({ dv, headers: ['Name'], rows: [] });

    // eslint-disable-next-line @typescript-eslint/unbound-method -- Valid usage.
    expect(dv.paragraph).toHaveBeenCalledWith('No items found');
  });

  it('should call dv.table with headers for non-empty rows', async () => {
    const dv = createMockDv();
    const rows: string[][] = [['Alice'], ['Bob']];

    await renderPaginatedTable({ dv, headers: ['Name'], rows });

    // eslint-disable-next-line @typescript-eslint/unbound-method -- Valid usage.
    expect(dv.table).toHaveBeenCalledWith(['Name'], expect.anything());
  });

  it('should render pagination controls for non-empty rows', async () => {
    const dv = createMockDv();
    const rows: string[][] = [['Alice'], ['Bob']];

    await renderPaginatedTable({ dv, headers: ['Name'], rows });

    const paginationDiv = dv.container.querySelector('.pagination');
    expect(paginationDiv).not.toBeNull();
  });

  it('should slice rows to first page with default items per page', async () => {
    const dv = createMockDv();
    const rows: string[][] = Array.from({ length: 25 }, (_, i) => [
      `Person${String(i)}`
    ]);

    await renderPaginatedTable({ dv, headers: ['Name'], rows });

    // eslint-disable-next-line @typescript-eslint/unbound-method -- Valid usage.
    const tableCall = vi.mocked(dv.table).mock.calls[0];
    const passedRows = tableCall?.[1] as string[][];
    expect(passedRows).toHaveLength(10);
  });

  it('should use custom itemsPerPageOptions', async () => {
    const dv = createMockDv();
    const rows: string[][] = Array.from({ length: 20 }, (_, i) => [
      `Person${String(i)}`
    ]);

    await renderPaginatedTable({
      dv,
      headers: ['Name'],
      itemsPerPageOptions: [3, 6, 12],
      rows
    });

    // eslint-disable-next-line @typescript-eslint/unbound-method -- Valid usage.
    const tableCall = vi.mocked(dv.table).mock.calls[0];
    const passedRows = tableCall?.[1] as string[][];
    expect(passedRows).toHaveLength(3);
  });
});

describe('reloadCurrentFileCache', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should call DataviewAPI.index.reload', async () => {
    const dv = createMockDv();
    const reloadFn = vi.fn(async () => {
      noop();
    });
    vi.stubGlobal('DataviewAPI', {
      index: { reload: reloadFn }
    });

    await reloadCurrentFileCache(dv);

    expect(reloadFn).toHaveBeenCalled();
    vi.unstubAllGlobals();
  });

  it('should not throw when DataviewAPI is undefined', async () => {
    const dv = createMockDv();
    vi.stubGlobal('DataviewAPI', undefined);

    await expect(reloadCurrentFileCache(dv)).resolves.toBeUndefined();

    vi.unstubAllGlobals();
  });

  it('should pass the file from dv.current().file.path to getFile', async () => {
    const dv = createMockDv();
    const reloadFn = vi.fn(async () => {
      noop();
    });
    vi.stubGlobal('DataviewAPI', {
      index: { reload: reloadFn }
    });

    await reloadCurrentFileCache(dv);

    expect(getFile).toHaveBeenCalledWith(dv.app, 'current.md');
    vi.unstubAllGlobals();
  });
});

describe('renderPaginated page navigation', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should navigate to next page when Next link is clicked', async () => {
    const dv = createMockDv();
    const rows = Array.from({ length: 25 }, (_, i) => `item${String(i)}`);

    await renderPaginatedList({ dv, itemsPerPageOptions: [10], rows });

    // Find the "Next" link
    const links = dv.container.querySelectorAll('.page-link');
    let nextLink: HTMLAnchorElement | undefined;
    for (const link of links) {
      if (link.textContent === 'Next') {
        nextLink = link as HTMLAnchorElement;
      }
    }
    expect(nextLink).toBeDefined();

    // Click the Next link

    // eslint-disable-next-line @typescript-eslint/unbound-method -- Valid usage.
    vi.mocked(dv.list).mockClear();
    const event = new PointerEvent('click', { bubbles: true, cancelable: true });
    // The convertAsyncToSync mock makes the handler the async function itself,
    // So the click handler is attached via addEventListener
    // eslint-disable-next-line @typescript-eslint/await-thenable -- dispatchEvent may trigger async handlers.
    await nextLink?.dispatchEvent(event);

    // The handler is async (because our convertAsyncToSync mock returns the async fn),
    // So we need to let it settle before asserting.
    await new Promise((resolve) => {
      setTimeout(resolve, 0);
    });

    // eslint-disable-next-line @typescript-eslint/unbound-method -- Valid usage.
    expect(dv.list).toHaveBeenCalledOnce();

    // eslint-disable-next-line @typescript-eslint/unbound-method -- Valid usage.
    expect(dv.list).toHaveBeenCalledWith(rows.slice(10, 20));
  });

  it('should show ellipsis when there are many pages and current page is far from start', async () => {
    const dv = createMockDv();
    // 100 items with 10 per page = 10 pages
    const rows = Array.from({ length: 100 }, (_, i) => `item${String(i)}`);

    await renderPaginatedList({ dv, itemsPerPageOptions: [10], rows });

    // On page 1, there should be no leading ellipsis, but there might be a trailing one
    const spans = dv.container.querySelectorAll('.pagination span');
    const texts = Array.from(spans).map((s) => s.textContent);
    // For page 1 with 10 pages, there should be trailing "..." because page 1 < totalPages - 2
    expect(texts.some((t) => t === '...')).toBe(true);
  });

  it('should disable Last and Next links on the last page when single page', async () => {
    const dv = createMockDv();
    // 5 items with 10 per page = 1 page
    const rows = Array.from({ length: 5 }, (_, i) => `item${String(i)}`);

    await renderPaginatedList({ dv, itemsPerPageOptions: [10], rows });

    const links = dv.container.querySelectorAll('.page-link');
    // All nav links should be disabled on single page
    // First, Prev, "1" (current), Next, Last
    const firstLink = links[0];
    const prevLink = links[1];
    const nextLink = links[3];
    const lastLink = links[4];
    expect(firstLink?.classList.contains('disabled')).toBe(true);
    expect(prevLink?.classList.contains('disabled')).toBe(true);
    expect(nextLink?.classList.contains('disabled')).toBe(true);
    expect(lastLink?.classList.contains('disabled')).toBe(true);
  });

  it('should prevent default on disabled link click', async () => {
    const dv = createMockDv();
    const rows = Array.from({ length: 5 }, (_, i) => `item${String(i)}`);

    await renderPaginatedList({ dv, itemsPerPageOptions: [10], rows });

    const firstLink = dv.container.querySelector(
      '.page-link.disabled'
    );
    expect(firstLink).not.toBeNull();

    const event = new PointerEvent('click', { bubbles: true, cancelable: true });
    vi.spyOn(event, 'preventDefault');
    (firstLink as HTMLAnchorElement | null)?.onclick?.(event);
    // eslint-disable-next-line @typescript-eslint/unbound-method -- Valid usage.
    expect(vi.mocked(event.preventDefault)).toHaveBeenCalled();
  });

  it('should restore dv.container after rendering page content', async () => {
    const dv = createMockDv();
    const originalContainer = dv.container;
    const rows = ['item1', 'item2'];

    await renderPaginatedList({ dv, rows });

    expect(dv.container).toBe(originalContainer);
  });

  it('should handle renderer error in paginated rendering', async () => {
    const dv = createMockDv();

    // eslint-disable-next-line @typescript-eslint/unbound-method -- Valid usage.
    vi.mocked(dv.list).mockRejectedValueOnce(new Error('render error'));
    const rows = ['item1', 'item2'];

    await renderPaginatedList({ dv, rows });

    // The error should be caught and displayed via dv.paragraph
    // eslint-disable-next-line @typescript-eslint/unbound-method -- Valid usage.
    expect(dv.paragraph).toHaveBeenCalledWith(
      expect.stringContaining('Error: render error')
    );
  });

  it('should restore container even when renderer throws in paginated rendering', async () => {
    const dv = createMockDv();
    const originalContainer = dv.container;

    // eslint-disable-next-line @typescript-eslint/unbound-method -- Valid usage.
    vi.mocked(dv.list).mockRejectedValueOnce(new Error('render error'));
    const rows = ['item1'];

    await renderPaginatedList({ dv, rows });

    expect(dv.container).toBe(originalContainer);
  });

  it('should re-render page 1 when items-per-page select changes', async () => {
    const dv = createMockDv();
    const rows = Array.from({ length: 30 }, (_, i) => `item${String(i)}`);

    await renderPaginatedList({ dv, itemsPerPageOptions: [10, 20], rows });

    const select = dv.container.querySelector('select');
    expect(select).not.toBeNull();

    // Change items per page to 20

    // eslint-disable-next-line @typescript-eslint/unbound-method -- Valid usage.
    vi.mocked(dv.list).mockClear();
    assertNonNullable(select);
    select.value = '20';
    const changeEvent = new Event('change', { bubbles: true });
    // The handler is async, dispatch triggers it; we await a microtick for it to complete
    select.dispatchEvent(changeEvent);
    await new Promise((resolve) => {
      setTimeout(resolve, 0);
    });

    // Dv.list should have been called again with 20 items (all 30 items sliced to first 20)

    // eslint-disable-next-line @typescript-eslint/unbound-method -- Valid usage.
    expect(dv.list).toHaveBeenCalled();

    // eslint-disable-next-line @typescript-eslint/unbound-method -- Valid usage.
    const listCall = vi.mocked(dv.list).mock.calls[0];
    const passedRows = listCall?.[0] as string[];
    expect(passedRows).toHaveLength(20);
  });

  it('should jump to page when Enter is pressed in jump-to-page input', async () => {
    const dv = createMockDv();
    const rows = Array.from({ length: 30 }, (_, i) => `item${String(i)}`);

    await renderPaginatedList({ dv, itemsPerPageOptions: [10], rows });

    const input = dv.container.querySelector('input[type="number"]');
    expect(input).not.toBeNull();

    // Set value to page 2 and press Enter

    // eslint-disable-next-line @typescript-eslint/unbound-method -- Valid usage.
    vi.mocked(dv.list).mockClear();
    (input as HTMLInputElement).value = '2';
    const keydownEvent = new KeyboardEvent('keydown', { key: 'Enter' });
    assertNonNullable(input);
    input.dispatchEvent(keydownEvent);
    await new Promise((resolve) => {
      setTimeout(resolve, 0);
    });

    // Dv.list should have been called with second page items (items 10-19)

    // eslint-disable-next-line @typescript-eslint/unbound-method -- Valid usage.
    expect(dv.list).toHaveBeenCalled();

    // eslint-disable-next-line @typescript-eslint/unbound-method -- Valid usage.
    const listCall = vi.mocked(dv.list).mock.calls[0];
    const passedRows = listCall?.[0] as string[];
    expect(passedRows).toHaveLength(10);
    expect(passedRows[0]).toBe('item10');
  });

  it('should not jump to page when a non-Enter key is pressed', async () => {
    const dv = createMockDv();
    const rows = Array.from({ length: 30 }, (_, i) => `item${String(i)}`);

    await renderPaginatedList({ dv, itemsPerPageOptions: [10], rows });

    const input = dv.container.querySelector('input[type="number"]');
    expect(input).not.toBeNull();

    // eslint-disable-next-line @typescript-eslint/unbound-method -- Valid usage.
    vi.mocked(dv.list).mockClear();
    (input as HTMLInputElement).value = '2';
    const keydownEvent = new KeyboardEvent('keydown', { key: 'Tab' });
    assertNonNullable(input);
    input.dispatchEvent(keydownEvent);
    await new Promise((resolve) => {
      setTimeout(resolve, 0);
    });

    // Dv.list should NOT have been called again

    // eslint-disable-next-line @typescript-eslint/unbound-method -- Valid usage.
    expect(dv.list).not.toHaveBeenCalled();
  });

  it('should show leading ellipsis when navigating to page 4 or beyond', async () => {
    const dv = createMockDv();
    // 100 items with 10 per page = 10 pages
    const rows = Array.from({ length: 100 }, (_, i) => `item${String(i)}`);

    await renderPaginatedList({ dv, itemsPerPageOptions: [10], rows });

    // Jump to page 5
    const input = dv.container.querySelector('input[type="number"]');
    expect(input).not.toBeNull();
    (input as HTMLInputElement).value = '5';
    const keydownEvent = new KeyboardEvent('keydown', { key: 'Enter' });
    assertNonNullable(input);
    input.dispatchEvent(keydownEvent);
    await new Promise((resolve) => {
      setTimeout(resolve, 0);
    });

    // On page 5, there should be a leading "..." since pageNumber (5) > MORE_PAGE_NUMBER (3)
    const spans = dv.container.querySelectorAll('.pagination span');
    const texts = Array.from(spans).map((s) => s.textContent);
    expect(texts.filter((t) => t === '...').length).toBeGreaterThanOrEqual(1);
  });

  it('should throw when itemsPerPageOptions is empty and rows are non-empty', async () => {
    const dv = createMockDv();
    const rows = ['item1'];

    await expect(
      renderPaginatedList({ dv, itemsPerPageOptions: [], rows })
    ).rejects.toThrow('Items per page options are empty');
  });

  it('should not jump to an invalid page number', async () => {
    const dv = createMockDv();
    const rows = Array.from({ length: 30 }, (_, i) => `item${String(i)}`);

    await renderPaginatedList({ dv, itemsPerPageOptions: [10], rows });

    const input = dv.container.querySelector('input[type="number"]');
    expect(input).not.toBeNull();

    // eslint-disable-next-line @typescript-eslint/unbound-method -- Valid usage.
    vi.mocked(dv.list).mockClear();
    (input as HTMLInputElement).value = '99';
    const keydownEvent = new KeyboardEvent('keydown', { key: 'Enter' });
    assertNonNullable(input);
    input.dispatchEvent(keydownEvent);
    await new Promise((resolve) => {
      setTimeout(resolve, 0);
    });

    // Dv.list should NOT have been called because page 99 is out of range
    // eslint-disable-next-line @typescript-eslint/unbound-method -- Valid usage.
    expect(dv.list).not.toHaveBeenCalled();
  });
});
