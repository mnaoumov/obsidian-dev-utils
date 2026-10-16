/**
 * @file
 *
 * Turns the frozen map of the retired site's pages into the "this page has moved" pages that replace them.
 */

/**
 * How long a moved page waits before taking the reader to the new page, so the notice asking them to update their
 * bookmark is read first.
 */
export const MOVED_PAGE_REDIRECT_DELAY_IN_SECONDS = 10;

/**
 * One page the retired site served, and the page that replaced it.
 */
export interface MovedPage {
  /**
   * The npm name of the package whose site holds the new page.
   */
  readonly packageName: string;

  /**
   * A short name of the new page: its last path segment, or `home` / `API` for a package's root pages.
   */
  readonly pageName: string;

  /**
   * The `[...old]` route parameter: the old path relative to the site base, without its outer slashes.
   */
  readonly routeParameter: string;

  /**
   * The absolute URL of the new page.
   */
  readonly targetUrl: string;
}

/**
 * Builds the moved pages from the redirect map.
 *
 * @param redirects - The old path, relative to the base, to the absolute URL of the page that replaced it.
 * @returns One moved page per entry, in the map's order.
 */
export function getMovedPages(redirects: Readonly<Record<string, string>>): MovedPage[] {
  return Object.entries(redirects).map(([oldPath, targetUrl]) => toMovedPage(oldPath, targetUrl));
}

/**
 * Builds the `<noscript>` content that redirects a reader whose browser runs no scripts.
 *
 * @param targetUrl - The absolute URL of the new page.
 * @returns The `<meta http-equiv="refresh">` element, as HTML.
 */
export function getNoScriptRefreshHtml(targetUrl: string): string {
  return `<meta http-equiv="refresh" content="${String(MOVED_PAGE_REDIRECT_DELAY_IN_SECONDS)};url=${escapeHtmlAttribute(targetUrl)}">`;
}

/**
 * Describes one entry of the redirect map.
 *
 * @param oldPath - The old path relative to the base, with a leading and a trailing slash.
 * @param targetUrl - The absolute URL of the page that replaced it.
 * @returns The moved page.
 */
export function toMovedPage(oldPath: string, targetUrl: string): MovedPage {
  if (!oldPath.startsWith('/') || !oldPath.endsWith('/') || oldPath === '/') {
    throw new Error(`Expected an old path with a leading and a trailing slash, got '${oldPath}'.`);
  }

  const pageSegments = new URL(targetUrl).pathname.split('/').filter(Boolean);
  const packageFolder = pageSegments.shift();
  if (packageFolder === undefined) {
    throw new Error(`Expected the new page '${targetUrl}' to sit on a package site.`);
  }

  return {
    packageName: `@mnaoumov/${packageFolder}`,
    pageName: getPageName(pageSegments),
    routeParameter: oldPath.slice(1, -1),
    targetUrl
  };
}

function escapeHtmlAttribute(value: string): string {
  return value.replaceAll('&', '&amp;').replaceAll('"', '&quot;').replaceAll('<', '&lt;').replaceAll('>', '&gt;');
}

function getPageName(pageSegments: readonly string[]): string {
  const lastSegment = pageSegments.at(-1);
  if (lastSegment === undefined) {
    return 'home';
  }

  return pageSegments.length === 1 && lastSegment === 'api' ? 'API' : lastSegment;
}
