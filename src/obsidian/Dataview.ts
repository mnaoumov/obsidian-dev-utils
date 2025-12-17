/**
 * @packageDocumentation
 *
 * This module provides utility functions for working with Dataview in Obsidian.
 */

import type { Promisable } from 'type-fest';

import type { DataviewInlineApi as DataviewInlineApiOriginal } from './@types/Dataview/api/inline-api.d.ts';
import type {
  DataArray,
  DataviewApi,
  SMarkdownPage
} from './@types/Dataview/index.d.ts';
import type { PathOrFile } from './FileSystem.ts';
import type { CombinedFrontmatter } from './Frontmatter.ts';

import { convertAsyncToSync } from '../Async.ts';
import {
  errorToString,
  throwExpression
} from '../Error.ts';
import {
  getFile,
  getPath
} from './FileSystem.ts';
import { t } from './i18n/i18n.ts';
import { relativePathToResourceUrl } from './ResourceUrl.ts';

/**
 * Export DateTime and Link types from the Dataview API.
 */
export type {
  DateTime,
  Link
} from './@types/Dataview/index.d.ts';

declare global {
  /**
   * A {@link DataviewApi} object represents the API for interacting with Dataview in Obsidian.
   */
  // eslint-disable-next-line vars-on-top -- It is a `var` in module declaration. ESLint mistakenly confuses it with `var` as a variable declaration.
  var DataviewAPI: DataviewApi | undefined;
}

/**
 * A combined page type, which includes the front matter and the SMarkdownPage.
 */
export type CombinedPage<CustomFrontmatter = unknown> = CombinedFrontmatter<CustomFrontmatter> & SMarkdownPage;

/**
 * Extended interface for the Dataview Inline API, providing additional methods for custom page types and array handling.
 *
 * @typeParam CustomPage - The type of the custom page. Defaults to `SMarkdownPage`.
 */
export interface DataviewInlineApi extends DataviewInlineApiOriginal {
  /**
   * Wraps an array of items into a {@link DataArray} object.
   *
   * @typeParam T - The type of the items in the array.
   * @param arr - The array of items to wrap.
   * @returns A {@link DataArray} containing the items.
   */
  array<T>(arr: T[]): DataArray<T>;

  /**
   * Retrieves the current page, with an optional custom page type.
   *
   * @typeParam CustomPage - The type of the custom page. Defaults to `SMarkdownPage`.
   * @returns The current page.
   */
  current<CustomFrontmatter = unknown>(): CombinedPage<CustomFrontmatter>;

  /**
   * Retrieves pages based on an optional query, with an optional custom page type.
   *
   * @typeParam CustomPage - The type of the custom page. Defaults to `SMarkdownPage`.
   * @param query - An optional string query to filter the pages.
   * @returns A {@link DataArray} of pages matching the query.
   */
  pages<CustomFrontmatter = unknown>(query?: string): DataArray<CombinedPage<CustomFrontmatter>>;

  /**
   * Creates a paragraph HTML element with the provided text and optional DOM element options.
   *
   * @param text - The content of the paragraph.
   * @param options - Optional DOM element options, including an optional container.
   * @returns The created HTML paragraph element.
   */
  paragraph(
    text: unknown,
    options?: DomElementInfoWithContainer
  ): HTMLParagraphElement;
}

/**
 * DomElementInfo with an optional container.
 */
export type DomElementInfoWithContainer = { container?: HTMLElement } & DomElementInfo;

/**
 * A combined file type, which includes the front matter and the SMarkdownFile.
 */
export type PageFile = SMarkdownPage['file'];

/**
 * List of page files.
 */
export type PageFiles = ArrayOrDataArray<PageFile>;

/**
 * Reloads the current file cache using the Dataview API.
 *
 * @param dv - The DataviewInlineApi instance.
 * @returns A {@link Promise} that resolves when the cache is reloaded.
 */
export async function reloadCurrentFileCache(dv: DataviewInlineApi): Promise<void> {
  await window.DataviewAPI?.index.reload(getFile(dv.app, dv.current().file.path));
}

const paginationCss = `
.pagination .page-link.disabled {
  pointer-events: none;
  color: gray;
}

.pagination .page-link {
  margin: 0 5px;
  cursor: pointer;
  text-decoration: none;
  color: blue;
}

.pagination .page-link:hover:not(.disabled) {
  text-decoration: underline;
}
.pagination .page-link.current {
  font-weight: bold;
  text-decoration: underline;
}

.pagination select,
.pagination input {
  margin: 0 5px;
}
`;

/**
 * Array or DataArray type.
 */
export type ArrayOrDataArray<T> = DataArray<T> | T[];

/**
 * Options for {@link renderIframe}.
 */
export interface RenderIframeOptions {
  /**
   * A {@link DataviewInlineApi} instance.
   */
  dv: DataviewInlineApi;

  /**
   * A height of the iframe.
   */
  height?: string;

  /**
   * A relative path to the resource to be displayed in the iframe.
   */
  relativePathOrFile: PathOrFile;

  /**
   * A width of the iframe.
   */
  width?: string;
}

/**
 * Options for {@link renderPaginatedList}.
 */
export interface RenderPaginatedListOptions<T> {
  /**
   * A {@link DataviewInlineApi} instance.
   */
  dv: DataviewInlineApi;

  /**
   * Options for items per page. Defaults to `[10, 20, 50, 100]`.
   */
  itemsPerPageOptions?: number[];

  /**
   * A list of items to paginate.
   */
  rows: ArrayOrDataArray<T>;
}

/**
 * Options for {@link renderPaginated}.
 */
export interface RenderPaginatedOptions<T> {
  /**
   * A {@link DataviewInlineApi} instance.
   */
  dv: DataviewInlineApi;

  /**
   * Options for items per page.
   */
  itemsPerPageOptions?: number[];

  /**
   * Display the paginated content.
   *
   * @param rowsForOnePage - The rows to render.
   * @returns A {@link Promise} that resolves when the content is rendered.
   */
  renderer(rowsForOnePage: ArrayOrDataArray<T>): Promisable<void>;

  /**
   * Rows to paginate.
   */
  rows: ArrayOrDataArray<T>;
}

/**
 * Options for {@link renderPaginatedTable}.
 */
export interface RenderPaginatedTableOptions<T> {
  /**
   * A {@link DataviewInlineApi} instance.
   */
  dv: DataviewInlineApi;

  /**
   * A headers of the table.
   */
  headers: string[];

  /**
   * Options for items per page. Defaults to `[10, 20, 50, 100]`.
   */
  itemsPerPageOptions?: number[];

  /**
   * Rows of the table to paginate.
   */
  rows: ArrayOrDataArray<T>;
}

/**
 * Renders the content using the provided renderer function in a temporary container,
 * and then returns the container.
 *
 * @param dv - The DataviewInlineApi instance.
 * @param renderer - The function responsible for rendering the content.
 * @returns A {@link Promise} that resolves to the HTML paragraph element
 * that was used as the temporary container.
 */
export async function getRenderedContainer(dv: DataviewInlineApi, renderer: () => Promisable<void>): Promise<HTMLParagraphElement> {
  const oldContainer = dv.container;
  const tempContainer = dv.paragraph('');
  dv.container = tempContainer;
  dv.container.empty();

  try {
    await renderer();
  } catch (e) {
    dv.paragraph(`❌${errorToString(e)}`);
  } finally {
    // eslint-disable-next-line require-atomic-updates -- Yes, it is a potential race condition, but I don't an elegant way to fix it.
    dv.container = oldContainer;
    tempContainer.remove();
  }

  return tempContainer;
}

/**
 * Inserts a code block into the specified Dataview instance using the provided language and code.
 *
 * @param dv - The DataviewInlineApi instance to insert the code block into.
 * @param language - The language identifier for the code block.
 * @param code - The code content to be inserted into the code block.
 */
export function insertCodeBlock(dv: DataviewInlineApi, language: string, code: string): void {
  const MIN_FENCE_LENGTH = 3;
  const fenceRegExp = new RegExp(`^\`{${String(MIN_FENCE_LENGTH)},}`, 'gm');
  const fenceMatches = code.matchAll(fenceRegExp);
  const fenceLengths = Array.from(fenceMatches).map((fenceMatch) => fenceMatch[0].length);
  const maxFenceLength = Math.max(0, ...fenceLengths);
  const resultFenceLength = Math.max(MIN_FENCE_LENGTH, maxFenceLength + 1);
  const resultFence = '`'.repeat(resultFenceLength);

  dv.paragraph(`${resultFence}${language}
${code}
${resultFence}`);
}

/**
 * Renders an iframe in the Dataview container with the specified relative path, width, and height.
 *
 * @param options - The options for rendering the iframe.
 */
export function renderIframe(options: RenderIframeOptions): void {
  const {
    dv,
    height = '600px',
    relativePathOrFile,
    width = '100%'
  } = options;
  dv.el('iframe', '', {
    attr: {
      height,
      src: relativePathToResourceUrl(dv.app, getPath(dv.app, relativePathOrFile), dv.current().file.path),
      width
    }
  });
}

/**
 * Renders a paginated list using the provided DataviewInlineApi instance.
 *
 * @typeParam T - The type of items in the list.
 *
 * @param options - The options for rendering the paginated list.
 *
 * @returns A {@link Promise} that resolves when the list is rendered.
 */
export async function renderPaginatedList<T>(options: RenderPaginatedListOptions<T>): Promise<void> {
  const {
    dv,
    // eslint-disable-next-line no-magic-numbers -- Extracting magic number as a constant would be repetitive, as the value is used only once and its name would be the same as the property.
    itemsPerPageOptions = [10, 20, 50, 100],
    rows
  } = options;
  await renderPaginated({
    dv,
    itemsPerPageOptions,
    renderer: async (rowsForOnePage: ArrayOrDataArray<T>): Promise<void> => {
      await dv.list(rowsForOnePage);
    },
    rows
  });
}

/**
 * Renders a paginated table using the provided DataviewInlineApi instance.
 *
 * @typeParam T - The type of items in the table rows.
 *
 * @param options - The options for rendering the paginated table.
 *
 * @returns A {@link Promise} that resolves when the table is rendered.
 */
export async function renderPaginatedTable<T extends unknown[]>(options: RenderPaginatedTableOptions<T>): Promise<void> {
  const {
    dv,
    headers,
    // eslint-disable-next-line no-magic-numbers -- Extracting magic number as a constant would be repetitive, as the value is used only once and its name would be the same as the property.
    itemsPerPageOptions = [10, 20, 50, 100],
    rows
  } = options;
  await renderPaginated({
    dv,
    itemsPerPageOptions,
    renderer: async (rowsForOnePage: ArrayOrDataArray<T>): Promise<void> => {
      await dv.table(headers, rowsForOnePage);
    },
    rows
  });
}

/**
 * Helper function to render paginated content using the specified renderer.
 *
 * @typeParam T - The type of items to paginate.
 *
 * @param options - The options for rendering the paginated content.
 *
 * @returns A {@link Promise} that resolves when the content is rendered.
 */
async function renderPaginated<T>(options: RenderPaginatedOptions<T>): Promise<void> {
  const SECOND_PAGE_NUMBER = 2;
  const MORE_PAGE_NUMBER = 3;
  const {
    dv,
    // eslint-disable-next-line no-magic-numbers -- Extracting magic number as a constant would be repetitive, as the value is used only once and its name would be the same as the property.
    itemsPerPageOptions = [10, 20, 50, 100],
    rows
  } = options;
  if (rows.length === 0) {
    dv.paragraph('No items found');
    return;
  }
  const container = dv.container;
  let itemsPerPage = itemsPerPageOptions[0] ?? throwExpression(new Error('Items per page options are empty'));
  let totalPages = Math.ceil(rows.length / itemsPerPage);
  await renderPage(1);

  function createPaginationControls(pageNumber: number): void {
    const paginationDiv = container.createDiv({ cls: 'pagination' });
    const paginationRow1Div = paginationDiv.createDiv();

    createPageLink('First', 1, pageNumber === 1);
    createPageLink('Prev', pageNumber - 1, pageNumber === 1);

    if (pageNumber > MORE_PAGE_NUMBER) {
      paginationRow1Div.createSpan({ text: '...' });
    }

    for (let i = Math.max(1, pageNumber - SECOND_PAGE_NUMBER); i <= Math.min(totalPages, pageNumber + SECOND_PAGE_NUMBER); i++) {
      const pageLink = createPageLink(String(i), i, i === pageNumber);
      if (i === pageNumber) {
        pageLink.addClass('current');
      }
    }

    if (pageNumber < totalPages - SECOND_PAGE_NUMBER) {
      paginationRow1Div.createSpan({ text: '...' });
    }

    createPageLink('Next', pageNumber + 1, pageNumber === totalPages);
    createPageLink('Last', totalPages, pageNumber === totalPages);

    const paginationRow2Div = paginationDiv.createDiv();

    paginationRow2Div.createSpan({ text: ` ${t(($) => $.obsidianDevUtils.dataview.itemsPerPage)} ` });

    const itemsPerPageSelect = paginationRow2Div.createEl('select');
    itemsPerPageOptions.forEach((option: number): void => {
      itemsPerPageSelect.createEl('option', { text: String(option), value: String(option) });
    });
    itemsPerPageSelect.value = String(itemsPerPage);
    itemsPerPageSelect.addEventListener(
      'change',
      convertAsyncToSync(async (): Promise<void> => {
        itemsPerPage = parseInt(itemsPerPageSelect.value, 10);
        totalPages = Math.ceil(rows.length / itemsPerPage);
        await renderPage(1);
      })
    );

    paginationRow2Div.createSpan({ text: ` ${t(($) => $.obsidianDevUtils.dataview.jumpToPage)} ` });

    const jumpToPageInput = paginationRow2Div.createEl('input', { attr: { max: totalPages, min: 1 }, type: 'number' });
    jumpToPageInput.addEventListener(
      'keydown',
      convertAsyncToSync(async (event: KeyboardEvent): Promise<void> => {
        if (event.key === 'Enter') {
          const page = parseInt(jumpToPageInput.value, 10);
          if (page >= 1 && page <= totalPages) {
            await renderPage(page);
          }
        }
      })
    );

    paginationRow2Div.createSpan({ text: t(($) => $.obsidianDevUtils.dataview.pageHeader, { pageNumber, totalItems: rows.length, totalPages }) });

    function createPageLink(text: string, currentPageNumber: number, disabled = false): HTMLAnchorElement {
      const link = paginationRow1Div.createEl('a', { cls: 'page-link', href: `#${String(currentPageNumber)}`, text });
      if (disabled) {
        link.addClass('disabled');
        link.onclick = (event: MouseEvent): void => {
          event.preventDefault();
        };
      } else {
        link.addEventListener(
          'click',
          convertAsyncToSync(async (event: MouseEvent): Promise<void> => {
            event.preventDefault();
            await renderPage(currentPageNumber);
          })
        );
      }
      return link;
    }
  }

  async function renderPage(pageNumber: number): Promise<void> {
    container.empty();
    // eslint-disable-next-line obsidianmd/no-forbidden-elements -- We need to create a style element to apply the pagination CSS.
    container.createEl('style', { text: paginationCss });

    const startIndex = (pageNumber - 1) * itemsPerPage;
    const endIndex = startIndex + itemsPerPage;
    const rowsForCurrentPage = rows.slice(startIndex, endIndex);

    const oldContainer = dv.container;

    dv.container = container;
    try {
      await options.renderer(rowsForCurrentPage);
    } catch (e) {
      dv.paragraph(`❌${errorToString(e)}`);
    } finally {
      // eslint-disable-next-line require-atomic-updates -- Yes, it is a potential race condition, but I don't an elegant way to fix it.
      dv.container = oldContainer;
    }

    createPaginationControls(pageNumber);
  }
}
