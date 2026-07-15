/**
 * @file
 *
 * Validation of the links emitted by the built documentation HTML.
 *
 * Internal (same-site) links are validated offline: every `href`/`src` must resolve to a real
 * file in the build output, and every `#fragment` must resolve to a real element id on the
 * target page.
 *
 * External links can only be validated over the network, so those requests are heavily
 * deduplicated — each unique external URL is fetched at most once regardless of how many of the
 * thousands of generated pages reference it — and run through a bounded concurrency pool.
 */

import { normalize } from 'node:path/posix';

import { assertNever } from '../../../src/type-guards.ts';

const LINK_ATTRIBUTE_REGEX = /\b(?:href|src)=(?<quote>['"])(?<value>.*?)\k<quote>/giu;
const ID_ATTRIBUTE_REGEX = /\bid=(?<quote>['"])(?<value>.*?)\k<quote>/giu;
const HTTP_OK_STATUS = 200;

/**
 * The {@link BrokenLink.httpStatus} sentinel for a network-level failure (timeout, DNS,
 * connection refused) where no HTTP response was received.
 */
export const NETWORK_FAILURE_STATUS = 0;

/**
 * A single link that does not resolve.
 */
export interface BrokenLink {
  /**
   * The HTTP status returned by an external link, when {@link BrokenLink.reason} is
   * `external-error`. `0` denotes a network-level failure (timeout, DNS, connection refused).
   */
  httpStatus?: number;

  /**
   * The absolute URL of the page that contains the broken link.
   */
  pageUrl: string;

  /**
   * Why the link is considered broken.
   */
  reason: 'external-error' | 'missing-fragment' | 'missing-page';

  /**
   * The resolved absolute URL the link points at.
   */
  targetUrl: string;
}

/**
 * A single built documentation page to validate.
 */
export interface DocumentationPage {
  /**
   * The page's rendered HTML.
   */
  html: string;

  /**
   * The page's path relative to the build-output root, e.g. `api/foo/index.html`.
   */
  relativePath: string;
}

/**
 * Filesystem access the link checker needs, injected so the pure decision logic can be tested
 * against an in-memory stub instead of a real build output.
 */
export interface LinkCheckFileSystem {
  /**
   * Reads the element ids present on an already-resolved page.
   *
   * @param pageKey - The key returned by {@link LinkCheckFileSystem.resolveExistingPage}.
   * @returns The set of element ids on that page.
   */
  readIds(pageKey: string): Set<string>;

  /**
   * Resolves an output-relative path to an existing page.
   *
   * @param outputRelativePath - The decoded path relative to the build-output root.
   * @returns A stable key (e.g. the resolved absolute file path) for the existing page, or
   *   `null` when nothing exists at that path or the path escapes the build-output root.
   */
  resolveExistingPage(outputRelativePath: string): null | string;
}

/**
 * Validates the deduplicated external URLs over the network through a bounded concurrency pool.
 *
 * @param targets - The unique external URL → referencing page map from {@link collectExternalTargets}.
 * @param checkUrl - Injected probe returning the HTTP status for a URL (`0` for a network failure).
 * @param concurrency - The maximum number of in-flight probes.
 * @returns Every external URL that did not return HTTP `200`, in the map's iteration order.
 */
export async function checkExternalTargets(
  targets: Map<string, string>,
  checkUrl: (url: string) => Promise<number>,
  concurrency: number
): Promise<BrokenLink[]> {
  const entries = [...targets];
  const results = new Array<BrokenLink | null>(entries.length).fill(null);
  let nextIndex = 0;

  async function runWorker(): Promise<void> {
    while (nextIndex < entries.length) {
      const index = nextIndex;
      nextIndex++;
      const entry = entries[index];
      if (entry === undefined) {
        continue;
      }

      const [externalUrl, pageUrl] = entry;
      const httpStatus = await checkUrl(externalUrl);
      if (httpStatus !== HTTP_OK_STATUS) {
        results[index] = { httpStatus, pageUrl, reason: 'external-error', targetUrl: externalUrl };
      }
    }
  }

  const workerCount = Math.max(1, Math.min(concurrency, entries.length));
  await Promise.all(Array.from({ length: workerCount }, () => runWorker()));

  // Indexed assignment above keeps failures in the map's iteration order; drop the successful gaps.
  return results.filter((brokenLink): brokenLink is BrokenLink => brokenLink !== null);
}

/**
 * Finds every internal link across the built documentation pages that does not resolve.
 *
 * External and non-HTTP links are ignored. Each internal link must resolve to an existing page,
 * and each `#fragment` must resolve to an existing element id on the target page.
 *
 * @param pages - The built documentation pages to validate.
 * @param fileSystem - Injected access to the build output.
 * @param siteBaseUrl - The absolute base URL the site is served from (with a trailing slash).
 * @returns Every broken internal link, in page-then-document order.
 */
export function checkLinks(pages: DocumentationPage[], fileSystem: LinkCheckFileSystem, siteBaseUrl: string): BrokenLink[] {
  const brokenLinks: BrokenLink[] = [];

  for (const page of pages) {
    const pageUrl = getPageUrl(page.relativePath, siteBaseUrl);
    for (const rawLink of extractLinks(page.html)) {
      const targetUrl = new URL(rawLink, pageUrl);
      if (!isInternalDocUrl(targetUrl, siteBaseUrl)) {
        continue;
      }

      const pageKey = fileSystem.resolveExistingPage(getOutputRelativePath(targetUrl, siteBaseUrl));
      if (pageKey === null) {
        brokenLinks.push({ pageUrl, reason: 'missing-page', targetUrl: targetUrl.href });
        continue;
      }

      const fragment = targetUrl.hash.slice(1);
      if (fragment.length > 0 && !fileSystem.readIds(pageKey).has(fragment)) {
        brokenLinks.push({ pageUrl, reason: 'missing-fragment', targetUrl: targetUrl.href });
      }
    }
  }

  return brokenLinks;
}

/**
 * Collects every unique external URL referenced across the built pages, deduplicated.
 *
 * Only HTTP(S) links that are not {@link isInternalDocUrl} are returned. Each unique URL maps to
 * the first page that referenced it, so a later failure can be reported with a concrete example
 * page even though the URL is fetched only once.
 *
 * @param pages - The built documentation pages to scan.
 * @param siteBaseUrl - The absolute base URL the site is served from (with a trailing slash).
 * @returns A map from each unique external URL to one referencing page URL.
 */
export function collectExternalTargets(pages: DocumentationPage[], siteBaseUrl: string): Map<string, string> {
  const targets = new Map<string, string>();

  for (const page of pages) {
    const pageUrl = getPageUrl(page.relativePath, siteBaseUrl);
    for (const rawLink of extractLinks(page.html)) {
      const targetUrl = new URL(rawLink, pageUrl);
      if (targetUrl.protocol !== 'http:' && targetUrl.protocol !== 'https:') {
        continue;
      }

      if (isInternalDocUrl(targetUrl, siteBaseUrl)) {
        continue;
      }

      const externalUrl = `${targetUrl.origin}${targetUrl.pathname}${targetUrl.search}`;
      if (!targets.has(externalUrl)) {
        targets.set(externalUrl, pageUrl);
      }
    }
  }

  return targets;
}

/**
 * Extracts the values of every `id` attribute in a chunk of HTML.
 *
 * @param html - The HTML to scan.
 * @returns The set of element ids.
 */
export function extractIds(html: string): Set<string> {
  return new Set([...html.matchAll(ID_ATTRIBUTE_REGEX)].map((match) => match.groups?.['value'] ?? ''));
}

/**
 * Extracts the values of every `href`/`src` attribute in a chunk of HTML.
 *
 * @param html - The HTML to scan.
 * @returns The raw link values, in document order (duplicates preserved).
 */
export function extractLinks(html: string): string[] {
  return [...html.matchAll(LINK_ATTRIBUTE_REGEX)].map((match) => match.groups?.['value'] ?? '');
}

/**
 * Formats broken links into a human-readable multi-line report.
 *
 * @param brokenLinks - The broken links to describe.
 * @returns One line per broken link.
 */
export function formatBrokenLinks(brokenLinks: BrokenLink[]): string {
  return brokenLinks
    .map((brokenLink) => {
      switch (brokenLink.reason) {
        case 'external-error':
          return `${brokenLink.pageUrl} links to external URL ${brokenLink.targetUrl} that returned ${describeHttpStatus(brokenLink.httpStatus)}.`;
        case 'missing-fragment':
          return `${brokenLink.pageUrl} links to missing fragment ${brokenLink.targetUrl}.`;
        case 'missing-page':
          return `${brokenLink.pageUrl} links to missing page ${brokenLink.targetUrl}.`;
        default:
          return assertNever(brokenLink.reason);
      }
    })
    .join('\n');
}

/**
 * Computes the build-output-relative path for an internal documentation URL.
 *
 * @param targetUrl - The resolved absolute link URL (must be {@link isInternalDocUrl}).
 * @param siteBaseUrl - The absolute base URL the site is served from (with a trailing slash).
 * @returns The decoded path relative to the build-output root.
 */
export function getOutputRelativePath(targetUrl: URL, siteBaseUrl: string): string {
  const base = new URL(siteBaseUrl);
  return decodeURIComponent(targetUrl.pathname.slice(base.pathname.length));
}

/**
 * Computes the absolute URL a built page is served at.
 *
 * @param relativePath - The page's path relative to the build-output root.
 * @param siteBaseUrl - The absolute base URL the site is served from (with a trailing slash).
 * @returns The page's absolute URL.
 */
export function getPageUrl(relativePath: string, siteBaseUrl: string): string {
  const normalized = relativePath.replaceAll('\\', '/');
  const urlPath = normalized === 'index.html' ? '' : normalized.replace(/index\.html$/u, '');
  return new URL(urlPath, siteBaseUrl).href;
}

/**
 * Determines whether a resolved link points at a page hosted by this documentation site.
 *
 * @param targetUrl - The resolved absolute link URL.
 * @param siteBaseUrl - The absolute base URL the site is served from (with a trailing slash).
 * @returns `true` when the link is same-origin and under the site base path.
 */
export function isInternalDocUrl(targetUrl: URL, siteBaseUrl: string): boolean {
  const base = new URL(siteBaseUrl);
  return targetUrl.origin === base.origin && targetUrl.pathname.startsWith(base.pathname);
}

/**
 * Resolves an output-relative path to an absolute path inside the build-output root, rejecting
 * paths that escape it via `..` segments.
 *
 * @param outputRootPath - The absolute build-output root path.
 * @param outputRelativePath - The decoded output-relative path.
 * @returns The joined path when it stays within the root, otherwise `null`.
 */
export function resolveWithinRoot(outputRootPath: string, outputRelativePath: string): null | string {
  const root = normalize(outputRootPath.replaceAll('\\', '/')).replace(/\/$/u, '');
  let joined = normalize(`${root}/${outputRelativePath.replaceAll('\\', '/')}`);
  if (joined.length > 1) {
    joined = joined.replace(/\/$/u, '');
  }

  if (joined !== root && !joined.startsWith(`${root}/`)) {
    return null;
  }

  return joined;
}

function describeHttpStatus(httpStatus: number | undefined): string {
  return httpStatus === undefined || httpStatus === NETWORK_FAILURE_STATUS ? 'a network failure' : `HTTP ${String(httpStatus)}`;
}
