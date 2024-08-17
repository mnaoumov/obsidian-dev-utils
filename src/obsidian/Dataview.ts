import type { DataviewInlineApi as DataviewInlineApiOriginal } from "obsidian-dataview/inline-api";
import type {
  DataArray,
  DataviewApi,
  DateTime,
  Link,
  SMarkdownPage
} from "obsidian-dataview";

import {
  convertAsyncToSync,
  type MaybePromise
} from "../Async.ts";
import { relativePathToResourceUrl } from "../obsidian/ResourceUrl.ts";
import { errorToString } from "../Error.ts";

declare global {
  // eslint-disable-next-line no-var
  var DataviewAPI: DataviewApi | undefined;
}

export type {
  DateTime,
  Link
};

export interface DataviewInlineApi<CustomPage = SMarkdownPage> extends DataviewInlineApiOriginal {
  current: () => Page<CustomPage>;
  array<T>(arr: T[]): DataArray<T>;
  pages(query?: string): DataArray<Page<CustomPage>>;
  paragraph(text: unknown, options?: DomElementInfo & { container?: HTMLElement }): HTMLParagraphElement;
}

export async function reloadCurrentFileCache(dv: DataviewInlineApi): Promise<void> {
  await DataviewAPI?.index.reload(dv.app.vault.getFileByPath(dv.current().file.path)!);
}

export type Page<T = SMarkdownPage> = SMarkdownPage & T;

type PageFile = Page["file"];
export type PageFiles = DataArray<PageFile> | PageFile[];

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

export async function renderPaginatedList<T>({
  dv,
  rows,
  itemsPerPageOptions = [10, 20, 50, 100]
}: {
  dv: DataviewInlineApi,
  rows: ArrayOrDataArray<T>,
  itemsPerPageOptions?: number[]
}): Promise<void> {
  await renderPaginated({
    dv,
    rows,
    itemsPerPageOptions,
    renderer: async (rows: ArrayOrDataArray<T>): Promise<void> => {
      await dv.list(rows);
    }
  });
}

export async function renderPaginatedTable<T extends unknown[]>({
  dv,
  headers,
  rows,
  itemsPerPageOptions = [10, 20, 50, 100]
}: {
  dv: DataviewInlineApi,
  headers: string[],
  rows: ArrayOrDataArray<T>,
  itemsPerPageOptions?: number[]
}): Promise<void> {
  await renderPaginated({
    dv,
    rows,
    itemsPerPageOptions,
    renderer: async (rows: ArrayOrDataArray<T>): Promise<void> => {
      await dv.table(headers, rows);
    }
  });
}

async function renderPaginated<T>({
  dv,
  rows,
  itemsPerPageOptions = [10, 20, 50, 100],
  renderer
}: {
  dv: DataviewInlineApi,
  rows: ArrayOrDataArray<T>,
  itemsPerPageOptions: number[],
  renderer: (rows: ArrayOrDataArray<T>) => MaybePromise<void>
}): Promise<void> {
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

export function renderIframe({
  dv,
  relativePath,
  width = "100%",
  height = "600px"
}: {
  dv: DataviewInlineApi,
  relativePath: string,
  width: string,
  height: string
}): void {
  dv.el("iframe", "", {
    attr: {
      src: relativePathToResourceUrl(dv.app, relativePath, dv.current().file.path),
      width,
      height
    }
  });
}
