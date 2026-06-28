/**
 * @file
 *
 * This module provides utility functions for working with Dataview in Obsidian.
 */

import type { Promisable } from 'type-fest';

import type { DataviewInlineApi as DataviewInlineApiOriginal } from './@types/dataview/api/inline-api.d.ts';
import type {
  DataArray,
  DataviewApi,
  SMarkdownPage
} from './@types/dataview/index.d.ts';
import type { PathOrFile } from './file-system.ts';
import type { CombinedFrontmatter } from './frontmatter.ts';

import { convertAsyncToSync } from '../async.ts';
import { errorToString } from '../error.ts';
import { ensureNonNullable } from '../type-guards.ts';
import {
  getFile,
  getPath
} from './file-system.ts';
import { t } from './i18n/i18n.ts';
import { relativePathToResourceUrl } from './resource-url.ts';

/**
 * Export DateTime and Link types from the Dataview API.
 */
export type {
  DateTime,
  Link
} from './@types/dataview/index.d.ts';

declare global {
  /**
   * A {@link DataviewApi} object represents the API for interacting with Dataview in Obsidian.
   */
  // eslint-disable-next-line vars-on-top -- It is a `var` in module declaration. ESLint mistakenly confuses it with `var` as a variable declaration.
  var DataviewAPI: DataviewApi | undefined;
}

/**
 * A combined page type, which includes the front matter and the SMarkdownPage.
 *
 * @typeParam CustomFrontmatter - The type of the custom front matter.
 */
export type CombinedPage<CustomFrontmatter = unknown> = CombinedFrontmatter<CustomFrontmatter> & SMarkdownPage;

/**
 * Extended interface for the Dataview Inline API, providing additional methods for custom page types and array handling.
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
export type DomElementInfoWithContainer = ContainerInfo & DomElementInfo;

/**
 * A combined file type, which includes the front matter and the SMarkdownFile.
 */
export type PageFile = SMarkdownPage['file'];

/**
 * List of page files.
 */
export type PageFiles = ArrayOrDataArray<PageFile>;

interface ContainerInfo {
  container?: HTMLElement;
}

/**
 * Reloads the current file cache using the Dataview API.
 *
 * @param dv - The DataviewInlineApi instance.
 * @returns A {@link Promise} that resolves when the cache is reloaded.
 */
export async function reloadCurrentFileCache(dv: DataviewInlineApi): Promise<void> {
  await activeWindow.DataviewAPI?.index.reload(getFile({
    app: dv.app,
    pathOrFile: dv.current().file.path
  }));
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
 *
 * @typeParam T - The type of the elements.
 */
export type ArrayOrDataArray<T> = DataArray<T> | T[];

/**
 * Parameters for {@link insertCodeBlock}.
 */
export interface InsertCodeBlockParams {
  /**
   * The code content to be inserted into the code block.
   */
  readonly code: string;

  /**
   * The DataviewInlineApi instance to insert the code block into.
   */
  readonly dv: DataviewInlineApi;

  /**
   * The language identifier for the code block.
   */
  readonly language: string;
}

/**
 * Options for {@link renderIframe}.
 */
export interface RenderIframeParams {
  /**
   * A {@link DataviewInlineApi} instance.
   */
  readonly dv: DataviewInlineApi;

  /**
   * A height of the iframe.
   *
   * @default `'600px'`
   */
  readonly height?: string;

  /**
   * A relative path to the resource to be displayed in the iframe.
   */
  readonly relativePathOrFile: PathOrFile;

  /**
   * A width of the iframe.
   *
   * @default `'100%'`
   */
  readonly width?: string;
}

/**
 * Options for {@link renderPaginatedList}.
 *
 * @typeParam T - The type of the list items.
 */
export interface RenderPaginatedListParams<T> {
  /**
   * A {@link DataviewInlineApi} instance.
   */
  readonly dv: DataviewInlineApi;

  /**
   * Options for items per page.
   *
   * @default `[10, 20, 50, 100]`
   */
  readonly itemsPerPageOptions?: number[];

  /**
   * A list of items to paginate.
   */
  readonly rows: ArrayOrDataArray<T>;
}

/**
 * Options for {@link renderPaginated}.
 *
 * @typeParam T - The type of the items to paginate.
 */
export interface RenderPaginatedParams<T> {
  /**
   * A {@link DataviewInlineApi} instance.
   */
  readonly dv: DataviewInlineApi;

  /**
   * Options for items per page.
   *
   * @default `[10, 20, 50, 100]`
   */
  readonly itemsPerPageOptions?: number[];

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
  readonly rows: ArrayOrDataArray<T>;
}

/**
 * Options for {@link renderPaginatedTable}.
 *
 * @typeParam T - The type of the table row data.
 */
export interface RenderPaginatedTableParams<T> {
  /**
   * A {@link DataviewInlineApi} instance.
   */
  readonly dv: DataviewInlineApi;

  /**
   * A headers of the table.
   */
  readonly headers: string[];

  /**
   * Options for items per page.
   *
   * @default `[10, 20, 50, 100]`
   */
  readonly itemsPerPageOptions?: number[];

  /**
   * Rows of the table to paginate.
   */
  readonly rows: ArrayOrDataArray<T>;
}

/**
 * Parameters for {@link createPageLink}.
 */
interface CreatePageLinkParams {
  /**
   * The page number the link points to.
   */
  readonly currentPageNumber: number;

  /**
   * Whether the link is disabled.
   */
  readonly disabled?: boolean;

  /**
   * The text to display for the link.
   */
  readonly text: string;
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
 * @param params - The parameters for inserting the code block.
 */
export function insertCodeBlock(params: InsertCodeBlockParams): void {
  const {
    code,
    dv,
    language
  } = params;
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
 * @param params - The parameters for rendering the iframe.
 */
export function renderIframe(params: RenderIframeParams): void {
  const {
    dv,
    height = '600px',
    relativePathOrFile,
    width = '100%'
  } = params;
  dv.el('iframe', '', {
    attr: {
      height,
      src: relativePathToResourceUrl({
        app: dv.app,
        notePath: dv.current().file.path,
        relativePath: getPath(dv.app, relativePathOrFile)
      }),
      width
    }
  });
}

/**
 * Renders a paginated list using the provided DataviewInlineApi instance.
 *
 * @typeParam T - The type of items in the list.
 *
 * @param params - The parameters for rendering the paginated list.
 *
 * @returns A {@link Promise} that resolves when the list is rendered.
 */
export async function renderPaginatedList<T>(params: RenderPaginatedListParams<T>): Promise<void> {
  const {
    dv,
    // eslint-disable-next-line no-magic-numbers -- Extracting magic number as a constant would be repetitive, as the value is used only once and its name would be the same as the property.
    itemsPerPageOptions = [10, 20, 50, 100],
    rows
  } = params;
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
 * @param params - The parameters for rendering the paginated table.
 *
 * @returns A {@link Promise} that resolves when the table is rendered.
 */
export async function renderPaginatedTable<T extends unknown[]>(params: RenderPaginatedTableParams<T>): Promise<void> {
  const {
    dv,
    headers,
    // eslint-disable-next-line no-magic-numbers -- Extracting magic number as a constant would be repetitive, as the value is used only once and its name would be the same as the property.
    itemsPerPageOptions = [10, 20, 50, 100],
    rows
  } = params;
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
 * @param params - The parameters for rendering the paginated content.
 *
 * @returns A {@link Promise} that resolves when the content is rendered.
 */
async function renderPaginated<T>(params: RenderPaginatedParams<T>): Promise<void> {
  const SECOND_PAGE_NUMBER = 2;
  const MORE_PAGE_NUMBER = 3;
  const {
    dv,
    // eslint-disable-next-line no-magic-numbers -- Extracting magic number as a constant would be repetitive, as the value is used only once and its name would be the same as the property.
    itemsPerPageOptions = [10, 20, 50, 100],
    rows
  } = params;
  if (rows.length === 0) {
    dv.paragraph('No items found');
    return;
  }
  const container = dv.container;
  let itemsPerPage = ensureNonNullable(itemsPerPageOptions[0], 'Items per page options are empty');
  let totalPages = Math.ceil(rows.length / itemsPerPage);
  await renderPage(1);

  function createPaginationControls(pageNumber: number): void {
    const paginationDiv = container.createDiv({ cls: 'pagination' });
    const paginationRow1Div = paginationDiv.createDiv();

    createPageLink({ currentPageNumber: 1, disabled: pageNumber === 1, text: 'First' });
    createPageLink({ currentPageNumber: pageNumber - 1, disabled: pageNumber === 1, text: 'Prev' });

    if (pageNumber > MORE_PAGE_NUMBER) {
      paginationRow1Div.createSpan({ text: '...' });
    }

    for (let i = Math.max(1, pageNumber - SECOND_PAGE_NUMBER); i <= Math.min(totalPages, pageNumber + SECOND_PAGE_NUMBER); i++) {
      const pageLink = createPageLink({ currentPageNumber: i, disabled: i === pageNumber, text: String(i) });
      if (i === pageNumber) {
        pageLink.addClass('current');
      }
    }

    if (pageNumber < totalPages - SECOND_PAGE_NUMBER) {
      paginationRow1Div.createSpan({ text: '...' });
    }

    createPageLink({ currentPageNumber: pageNumber + 1, disabled: pageNumber === totalPages, text: 'Next' });
    createPageLink({ currentPageNumber: totalPages, disabled: pageNumber === totalPages, text: 'Last' });

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

    function createPageLink(params2: CreatePageLinkParams): HTMLAnchorElement {
      const {
        currentPageNumber,
        disabled = false,
        text
      } = params2;
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
      await params.renderer(rowsForCurrentPage);
    } catch (e) {
      dv.paragraph(`❌${errorToString(e)}`);
    } finally {
      // eslint-disable-next-line require-atomic-updates -- Yes, it is a potential race condition, but I don't an elegant way to fix it.
      dv.container = oldContainer;
    }

    createPaginationControls(pageNumber);
  }
}
