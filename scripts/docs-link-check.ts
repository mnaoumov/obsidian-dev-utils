/**
 * @file
 *
 * Validates the links emitted by the built documentation site.
 *
 * Internal links are resolved offline against the build output; external links are validated
 * over the network, deduplicated so each unique URL is fetched at most once. See
 * {@link ./docs-gen/helpers/link-check.ts} for the reusable, unit-tested core.
 */

import {
  readdir,
  readFile
} from 'node:fs/promises';
import { resolve } from 'node:path';

import type {
  DocumentationPage,
  LinkCheckFileSystem
} from './docs-gen/helpers/link-check.ts';

import { wrapCliTask } from '../src/script-utils/cli-utils.ts';
import {
  checkExternalTargets,
  checkLinks,
  collectExternalTargets,
  extractIds,
  formatBrokenLinks,
  NETWORK_FAILURE_STATUS,
  resolveWithinRoot
} from './docs-gen/helpers/link-check.ts';

const DOCS_OUTPUT_PATH = resolve('docs/dist').replaceAll('\\', '/');
const SITE_BASE_URL = 'https://mnaoumov.dev/obsidian-dev-utils/';
const EXTERNAL_LINK_TIMEOUT_IN_MILLISECONDS = 10_000;
const EXTERNAL_LINK_CONCURRENCY = 20;
const HTML_FILE_EXTENSION = '.html';

// The host serves this page as the fallback for any missing path (with a 404 status), so it is not a
// Real navigable route: Starlight gives it a self-`rel="canonical"` of `/404/` that inherently cannot
// Resolve, and its body links (nav, logo) are identical to every real page we already validate.
const FALLBACK_PAGE_RELATIVE_PATH = '404.html';

await wrapCliTask(async () => {
  const allFiles = await getAllFiles(DOCS_OUTPUT_PATH);
  const pages = await readPages(DOCS_OUTPUT_PATH, allFiles);

  const internalBrokenLinks = checkLinks(pages, createFileSystem(allFiles, pages), SITE_BASE_URL);

  const externalTargets = collectExternalTargets(pages, SITE_BASE_URL);
  const externalBrokenLinks = await checkExternalTargets(externalTargets, checkExternalUrl, EXTERNAL_LINK_CONCURRENCY);

  const brokenLinks = [...internalBrokenLinks, ...externalBrokenLinks];
  if (brokenLinks.length > 0) {
    throw new Error(`Detected ${String(brokenLinks.length)} broken documentation link(s):\n${formatBrokenLinks(brokenLinks)}`);
  }
});

async function checkExternalUrl(url: string): Promise<number> {
  const controller = new AbortController();
  const timeoutId = globalThis.setTimeout(() => {
    controller.abort();
  }, EXTERNAL_LINK_TIMEOUT_IN_MILLISECONDS);

  try {
    const response = await fetch(url, { redirect: 'follow', signal: controller.signal });
    // Cancel the unread body so undici releases the connection immediately.
    // Without this the per-host connection pool stalls and same-host requests
    // Serialize, turning a ~3s run into minutes.
    await response.body?.cancel();
    return response.status;
  } catch {
    return NETWORK_FAILURE_STATUS;
  } finally {
    globalThis.clearTimeout(timeoutId);
  }
}

function createFileSystem(allFiles: Set<string>, pages: DocumentationPage[]): LinkCheckFileSystem {
  const htmlByRelativePath = new Map(pages.map((page) => [page.relativePath, page.html]));
  const idsCache = new Map<string, Set<string>>();

  return {
    readIds: (pageKey): Set<string> => {
      let ids = idsCache.get(pageKey);
      if (ids === undefined) {
        const html = htmlByRelativePath.get(pageKey);
        ids = html === undefined ? new Set<string>() : extractIds(html);
        idsCache.set(pageKey, ids);
      }

      return ids;
    },
    resolveExistingPage: (outputRelativePath): null | string => {
      if (resolveWithinRoot(DOCS_OUTPUT_PATH, outputRelativePath) === null) {
        return null;
      }

      const trimmed = outputRelativePath.replace(/\/$/u, '');
      const candidates = trimmed === '' ? ['index.html'] : [trimmed, `${trimmed}/index.html`];
      return candidates.find((candidate) => allFiles.has(candidate)) ?? null;
    }
  };
}

async function getAllFiles(outputRootPath: string): Promise<Set<string>> {
  const entries = await readdir(outputRootPath, { recursive: true, withFileTypes: true });
  const files = new Set<string>();
  for (const entry of entries) {
    if (!entry.isFile()) {
      continue;
    }

    const absolutePath = resolve(entry.parentPath, entry.name).replaceAll('\\', '/');
    files.add(absolutePath.slice(`${outputRootPath}/`.length));
  }

  return files;
}

async function readPages(outputRootPath: string, allFiles: Set<string>): Promise<DocumentationPage[]> {
  const pages: DocumentationPage[] = [];
  for (const relativePath of allFiles) {
    if (!relativePath.endsWith(HTML_FILE_EXTENSION) || relativePath === FALLBACK_PAGE_RELATIVE_PATH) {
      continue;
    }

    const html = await readFile(resolve(outputRootPath, relativePath), 'utf8');
    pages.push({ html, relativePath });
  }

  return pages;
}
