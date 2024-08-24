/**
 * @packageDocumentation Dataview
 * This module provides utility functions for working with Dataview in Obsidian.
 */

import "../@types/compare-versions.d.ts";

import type { DataviewInlineApi as DataviewInlineApiOriginal } from "./@types/Dataview/api/inline-api.d.ts";
import type {
  DataArray,
  DataviewApi,
  DateTime,
  Link,
  SMarkdownPage
} from "./@types/Dataview/index.d.ts";

import {
  convertAsyncToSync,
  type MaybePromise
} from "../Async.ts";
import { relativePathToResourceUrl } from "../obsidian/ResourceUrl.ts";
import { errorToString } from "../Error.ts";
import type { PathOrFile } from "./TFile.ts";
import { getPath } from "./TAbstractFile.ts";
import type { CombinedFrontMatter } from "./FrontMatter.ts";

declare global {
  /**
   * The DataviewAPI object represents the API for interacting with Dataview in Obsidian.
   */
  // eslint-disable-next-line no-var
  var DataviewAPI: DataviewApi | undefined;
}

export type {
  DateTime,
  Link
};

/**
 * Extended interface for the Dataview Inline API, providing additional methods for custom page types and array handling.
 *
 * @typeParam CustomPage - The type of the custom page. Defaults to `SMarkdownPage`.
 */
export interface DataviewInlineApi extends DataviewInlineApiOriginal {
  /**
   * Retrieves the current page, with an optional custom page type.
   *
   * @typeParam CustomPage - The type of the custom page. Defaults to `SMarkdownPage`.
   * @returns The current page.
   */
  current<CustomFrontMatter = unknown>(): CombinedPage<CustomFrontMatter>;

  /**
   * Wraps an array of items into a `DataArray` object.
   *
   * @typeParam T - The type of the items in the array.
   * @param arr - The array of items to wrap.
   * @returns A `DataArray` containing the items.
   */
  array<T>(arr: T[]): DataArray<T>;

  /**
   * Retrieves pages based on an optional query, with an optional custom page type.
   *
   * @typeParam CustomPage - The type of the custom page. Defaults to `SMarkdownPage`.
   * @param query - An optional string query to filter the pages.
   * @returns A `DataArray` of pages matching the query.
   */
  pages<CustomFrontMatter = unknown>(query?: string): DataArray<CombinedPage<CustomFrontMatter>>;

  /**
   * Creates a paragraph HTML element with the provided text and optional DOM element options.
   *
   * @param text - The content of the paragraph.
   * @param options - Optional DOM element options, including an optional container.
   * @returns The created HTML paragraph element.
   */
  paragraph(
    text: unknown,
    options?: DomElementInfo & { container?: HTMLElement }
  ): HTMLParagraphElement;
}

/**
 * Reloads the current file cache using the Dataview API.
 *
 * @param dv - The DataviewInlineApi instance.
 * @returns A promise that resolves when the cache is reloaded.
 */
export async function reloadCurrentFileCache(dv: DataviewInlineApi): Promise<void> {
  await DataviewAPI?.index.reload(dv.app.vault.getFileByPath(dv.current().file.path)!);
}

export type CombinedPage<CustomFrontMatter = unknown> = SMarkdownPage & CombinedFrontMatter<CustomFrontMatter>;

type PageFile = SMarkdownPage["file"];
export type PageFiles = ArrayOrDataArray<PageFile>;

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

type ArrayOrDataArray<T> = T[] | DataArray<T>;

/**
 * Options for rendering a paginated list using the Dataview API.
 */
type RenderPaginatedListOptions<T> = {
  /**
   * The DataviewInlineApi instance.
   */
  dv: DataviewInlineApi;

  /**
   * The list of items to paginate.
   */
  rows: ArrayOrDataArray<T>;

  /**
   * Options for items per page. Defaults to `[10, 20, 50, 100]`.
   */
  itemsPerPageOptions?: number[];
};

/**
 * Renders a paginated list using the provided DataviewInlineApi instance.
 *
 * @typeParam T - The type of items in the list.
 *
 * @param options - The options for rendering the paginated list.
 *
 * @returns A promise that resolves when the list is rendered.
 */
export async function renderPaginatedList<T>(options: RenderPaginatedListOptions<T>): Promise<void> {
  const {
    dv,
    rows,
    itemsPerPageOptions = [10, 20, 50, 100]
  } = options;
  await renderPaginated({
    dv,
    rows,
    itemsPerPageOptions,
    renderer: async (rows: ArrayOrDataArray<T>): Promise<void> => {
      await dv.list(rows);
    }
  });
}

/**
 * Options for rendering a paginated table using the Dataview API.
 */
type RenderPaginatedTableOptions<T> = {
  /**
   * The DataviewInlineApi instance.
   */
  dv: DataviewInlineApi;

  /**
   * The headers of the table.
   */
  headers: string[];

  /**
   * The rows of the table to paginate.
   */
  rows: ArrayOrDataArray<T>;

  /**
   * Options for items per page. Defaults to `[10, 20, 50, 100]`.
   */
  itemsPerPageOptions?: number[];
};

/**
 * Renders a paginated table using the provided DataviewInlineApi instance.
 *
 * @typeParam T - The type of items in the table rows.
 *
 * @param options - The options for rendering the paginated table.
 *
 * @returns A promise that resolves when the table is rendered.
 */
export async function renderPaginatedTable<T extends unknown[]>(options: RenderPaginatedTableOptions<T>): Promise<void> {
  const {
    dv,
    headers,
    rows,
    itemsPerPageOptions = [10, 20, 50, 100]
  } = options;
  await renderPaginated({
    dv,
    rows,
    itemsPerPageOptions,
    renderer: async (rows: ArrayOrDataArray<T>): Promise<void> => {
      await dv.table(headers, rows);
    }
  });
}

/**
 * Options for rendering a paginated element using the Dataview API.
 */
type RenderPaginatedOptions<T> = {
  /**
   * The DataviewInlineApi instance.
   */
  dv: DataviewInlineApi;

  /**
   * The rows to paginate.
   */
  rows: ArrayOrDataArray<T>;

  /**
   * Options for items per page.
   */
  itemsPerPageOptions: number[];

  /**
   * The renderer function to display the paginated content.
   * @param rows - The rows to render.
   * @returns A promise that resolves when the content is rendered.
   */
  renderer: (rows: ArrayOrDataArray<T>) => MaybePromise<void>;
};

/**
 * Helper function to render paginated content using the specified renderer.
 *
 * @typeParam T - The type of items to paginate.
 *
 * @param options - The options for rendering the paginated content.
 *
 * @returns A promise that resolves when the content is rendered.
 */
async function renderPaginated<T>(options: RenderPaginatedOptions<T>): Promise<void> {
  const {
    dv,
    rows,
    itemsPerPageOptions = [10, 20, 50, 100],
    renderer
  } = options;
  if (rows.length === 0) {
    dv.paragraph("No items found");
    return;
  }
  const container = dv.container;
  let itemsPerPage = itemsPerPageOptions[0]!;
  let totalPages = Math.ceil(rows.length / itemsPerPage);
  await renderPage(1);

  function createPaginationControls(pageNumber: number): void {
    const paginationDiv = container.createEl("div", { cls: "pagination" });
    const paginationRow1Div = paginationDiv.createDiv();

    createPageLink("First", 1, pageNumber === 1);
    createPageLink("Prev", pageNumber - 1, pageNumber === 1);

    if (pageNumber > 3) {
      paginationRow1Div.createEl("span", { text: "..." });
    }

    for (let i = Math.max(1, pageNumber - 2); i <= Math.min(totalPages, pageNumber + 2); i++) {
      const pageLink = createPageLink(i.toString(), i, i === pageNumber);
      if (i === pageNumber) {
        pageLink.addClass("current");
      }
    }

    if (pageNumber < totalPages - 2) {
      paginationRow1Div.createEl("span", { text: "..." });
    }

    createPageLink("Next", pageNumber + 1, pageNumber === totalPages);
    createPageLink("Last", totalPages, pageNumber === totalPages);

    const paginationRow2Div = paginationDiv.createDiv();

    paginationRow2Div.createEl("span", { text: " Items per page: " });

    const itemsPerPageSelect = paginationRow2Div.createEl("select");
    itemsPerPageOptions.forEach((option: number): void => {
      itemsPerPageSelect.createEl("option", { text: option.toString(), value: option.toString() });
    });
    itemsPerPageSelect.value = itemsPerPage.toString();
    itemsPerPageSelect.addEventListener("change", convertAsyncToSync(async (): Promise<void> => {
      itemsPerPage = parseInt(itemsPerPageSelect.value);
      totalPages = Math.ceil(rows.length / itemsPerPage);
      await renderPage(1);
    }));

    paginationRow2Div.createEl("span", { text: "  Jump to page: " });

    const jumpToPageInput = paginationRow2Div.createEl("input", { type: "number", attr: { min: 1, max: totalPages } });
    jumpToPageInput.addEventListener("keydown", convertAsyncToSync(async (event: KeyboardEvent): Promise<void> => {
      if (event.key === "Enter") {
        const page = parseInt(jumpToPageInput.value);
        if (page >= 1 && page <= totalPages) {
          await renderPage(page);
        }
      }
    }));

    paginationRow2Div.createEl("span", { text: `  Page ${pageNumber} of ${totalPages}, Total items: ${rows.length}` });

    function createPageLink(text: string, pageNumber: number, disabled = false): HTMLAnchorElement {
      const link = paginationRow1Div.createEl("a", { cls: "page-link", text: text, href: `#${pageNumber}` });
      if (disabled) {
        link.addClass("disabled");
        link.onclick = (event: MouseEvent): void => event.preventDefault();
      } else {
        link.addEventListener("click", convertAsyncToSync(async (event: MouseEvent): Promise<void> => {
          event.preventDefault();
          await renderPage(pageNumber);
        }));
      }
      return link;
    }
  }

  async function renderPage(pageNumber: number): Promise<void> {
    container.empty();
    container.createEl("style", { text: paginationCss });

    const startIndex = (pageNumber - 1) * itemsPerPage;
    const endIndex = startIndex + itemsPerPage;
    const rowsForCurrentPage = rows.slice(startIndex, endIndex);

    const oldContainer = dv.container;

    dv.container = container;
    try {
      await renderer(rowsForCurrentPage);
    } catch (e) {
      dv.paragraph("❌" + errorToString(e));
    } finally {
      dv.container = oldContainer;
    }

    createPaginationControls(pageNumber);
  }
}

/**
 * Renders the content using the provided renderer function in a temporary container,
 * and then returns the container.
 *
 * @param dv - The DataviewInlineApi instance.
 * @param renderer - The function responsible for rendering the content.
 * @returns A promise that resolves to the HTML paragraph element
 * that was used as the temporary container.
 */
export async function getRenderedContainer(dv: DataviewInlineApi, renderer: () => MaybePromise<void>): Promise<HTMLParagraphElement> {
  const tempContainer = dv.paragraph("");
  dv.container = tempContainer;
  dv.container.empty();

  try {
    await renderer();
  } catch (e) {
    dv.paragraph("❌" + errorToString(e));
  } finally {
    dv.container = tempContainer.parentElement!;
    tempContainer.remove();
  }

  return tempContainer;
}

/**
 * Options for rendering an iframe in the Dataview container.
 */
type RenderIframeOptions = {
  /**
   * The DataviewInlineApi instance.
   */
  dv: DataviewInlineApi;

  /**
   * The relative path to the resource to be displayed in the iframe.
   */
  relativePathOrFile: PathOrFile;

  /**
   * The width of the iframe.
   */
  width: string;

  /**
   * The height of the iframe.
   */
  height: string;
};

/**
 * Renders an iframe in the Dataview container with the specified relative path, width, and height.
 *
 * @param options - The options for rendering the iframe.
 *
 * @returns This function does not return a value.
 */
export function renderIframe(options: RenderIframeOptions): void {
  const {
    dv,
    relativePathOrFile,
    width = "100%",
    height = "600px"
  } = options;
  dv.el("iframe", "", {
    attr: {
      src: relativePathToResourceUrl(dv.app, getPath(relativePathOrFile), dv.current().file.path),
      width,
      height
    }
  });
}

/**
 * Inserts a code block into the specified Dataview instance using the provided language and code.
 *
 * @param dv - The DataviewInlineApi instance to insert the code block into.
 * @param language - The language identifier for the code block.
 * @param code - The code content to be inserted into the code block.
 * @returns This function does not return a value.
 */
export function insertCodeBlock(dv: DataviewInlineApi, language: string, code: string): void {
  const fenceMatches = code.matchAll(/^`{3,}/gm);
  const fenceLengths = Array.from(fenceMatches).map((fenceMatch) => fenceMatch[0].length);
  const maxFenceLength = Math.max(0, ...fenceLengths);
  const resultFenceLength = Math.max(3, maxFenceLength + 1);
  const resultFence = "`".repeat(resultFenceLength);

  dv.paragraph(`${resultFence}${language}
${code}
${resultFence}`);
}
