import {
  describe,
  expect,
  it,
  vi
} from 'vitest';

import type {
  DocumentationPage,
  LinkCheckFileSystem
} from './link-check.ts';

import {
  checkExternalTargets,
  checkLinks,
  collectExternalTargets,
  extractIds,
  extractLinks,
  formatBrokenLinks,
  getOutputRelativePath,
  getPageUrl,
  isInternalDocUrl,
  NETWORK_FAILURE_STATUS,
  resolveWithinRoot
} from './link-check.ts';

const SITE_BASE_URL = 'https://mnaoumov.dev/obsidian-dev-utils/';
const HTTP_OK = 200;
const HTTP_NOT_FOUND = 404;
const HTTP_SERVER_ERROR = 500;
const UNBOUNDED_CONCURRENCY = 20;
const UNIQUE_URL_COUNT = 3;
const CONCURRENCY_LIMIT = 3;
const TARGET_COUNT = 10;
const PROBE_DELAY_IN_MILLISECONDS = 5;

describe('link-check parsing helpers', () => {
  it('extracts href and src values while ignoring other attributes', () => {
    expect(extractLinks('<a href="/a">x</a><img src=\'/b.png\'><link rel="stylesheet" href="/c.css">')).toEqual(['/a', '/b.png', '/c.css']);
  });

  it('extracts element ids', () => {
    expect(extractIds('<h2 id="alpha">A</h2><h3 id=\'bravo\'>B</h3><p>none</p>')).toEqual(new Set(['alpha', 'bravo']));
  });

  it('derives the served URL from an index page and a leaf page', () => {
    expect(getPageUrl('index.html', SITE_BASE_URL)).toBe('https://mnaoumov.dev/obsidian-dev-utils/');
    expect(getPageUrl('api/foo/index.html', SITE_BASE_URL)).toBe('https://mnaoumov.dev/obsidian-dev-utils/api/foo/');
    expect(getPageUrl('guides\\bar.html', SITE_BASE_URL)).toBe('https://mnaoumov.dev/obsidian-dev-utils/guides/bar.html');
  });
});

describe('isInternalDocUrl / getOutputRelativePath', () => {
  it('treats same-origin under-base URLs as internal and decodes their output path', () => {
    const url = new URL('https://mnaoumov.dev/obsidian-dev-utils/api/abort%20controller/');
    expect(isInternalDocUrl(url, SITE_BASE_URL)).toBe(true);
    expect(getOutputRelativePath(url, SITE_BASE_URL)).toBe('api/abort controller/');
  });

  it('treats other origins and out-of-base paths as external', () => {
    expect(isInternalDocUrl(new URL('https://developer.mozilla.org/x'), SITE_BASE_URL)).toBe(false);
    expect(isInternalDocUrl(new URL('https://mnaoumov.dev/other/'), SITE_BASE_URL)).toBe(false);
  });
});

describe('resolveWithinRoot', () => {
  it('resolves paths that stay inside the output root', () => {
    expect(resolveWithinRoot('/repo/docs/dist', 'api/foo/index.html')).toBe('/repo/docs/dist/api/foo/index.html');
    expect(resolveWithinRoot('/repo/docs/dist', '')).toBe('/repo/docs/dist');
  });

  it('rejects paths that escape the output root', () => {
    expect(resolveWithinRoot('/repo/docs/dist', '../secret')).toBeNull();
    expect(resolveWithinRoot('/repo/docs/dist', 'api/../../secret')).toBeNull();
  });
});

describe('checkLinks (internal, offline)', () => {
  const pages: DocumentationPage[] = [{
    html: [
      '<a href="/obsidian-dev-utils/api/bravo/">ok page</a>',
      '<a href="../bravo/#known">ok fragment</a>',
      '<a href="/obsidian-dev-utils/api/bravo/#ghost">bad fragment</a>',
      '<a href="/obsidian-dev-utils/api/missing/">bad page</a>',
      '<a href="https://developer.mozilla.org/x">external ignored</a>',
      '<a href="mailto:me@example.com">mail ignored</a>'
    ].join(''),
    relativePath: 'api/alpha/index.html'
  }];

  const fileSystem: LinkCheckFileSystem = {
    readIds: (pageKey) => pageKey === 'api/bravo/index.html' ? new Set(['known']) : new Set(),
    resolveExistingPage: (outputRelativePath) => {
      const trimmed = outputRelativePath.replace(/\/$/u, '');
      return trimmed === 'api/bravo' ? 'api/bravo/index.html' : null;
    }
  };

  it('reports missing pages and missing fragments while ignoring external and non-http links', () => {
    expect(checkLinks(pages, fileSystem, SITE_BASE_URL)).toEqual([
      { pageUrl: 'https://mnaoumov.dev/obsidian-dev-utils/api/alpha/', reason: 'missing-fragment', targetUrl: 'https://mnaoumov.dev/obsidian-dev-utils/api/bravo/#ghost' },
      { pageUrl: 'https://mnaoumov.dev/obsidian-dev-utils/api/alpha/', reason: 'missing-page', targetUrl: 'https://mnaoumov.dev/obsidian-dev-utils/api/missing/' }
    ]);
  });
});

describe('collectExternalTargets (dedup)', () => {
  it('deduplicates external URLs across pages and records one referencing page', () => {
    const pages: DocumentationPage[] = [
      { html: '<a href="https://developer.mozilla.org/x">a</a><a href="https://github.com/y">b</a>', relativePath: 'p1/index.html' },
      { html: '<a href="https://developer.mozilla.org/x">dup</a><a href="/obsidian-dev-utils/internal/">skip</a><a href="mailto:x@y.z">skip</a>', relativePath: 'p2/index.html' }
    ];

    expect(collectExternalTargets(pages, SITE_BASE_URL)).toEqual(new Map([
      ['https://developer.mozilla.org/x', 'https://mnaoumov.dev/obsidian-dev-utils/p1/'],
      ['https://github.com/y', 'https://mnaoumov.dev/obsidian-dev-utils/p1/']
    ]));
  });
});

describe('checkExternalTargets (network, concurrency-bounded)', () => {
  it('probes each unique URL once and reports non-200 and network failures', async () => {
    const targets = new Map([
      ['https://down.example/', 'https://mnaoumov.dev/obsidian-dev-utils/p/'],
      ['https://missing.example/', 'https://mnaoumov.dev/obsidian-dev-utils/p/'],
      ['https://ok.example/', 'https://mnaoumov.dev/obsidian-dev-utils/p/']
    ]);
    const statusByUrl: Record<string, number> = {
      'https://down.example/': NETWORK_FAILURE_STATUS,
      'https://missing.example/': HTTP_NOT_FOUND,
      'https://ok.example/': HTTP_OK
    };
    const checkUrl = vi.fn((url: string) => Promise.resolve(statusByUrl[url] ?? HTTP_OK));

    const brokenLinks = await checkExternalTargets(targets, checkUrl, UNBOUNDED_CONCURRENCY);

    expect(checkUrl).toHaveBeenCalledTimes(UNIQUE_URL_COUNT);
    expect(brokenLinks).toEqual([
      { httpStatus: NETWORK_FAILURE_STATUS, pageUrl: 'https://mnaoumov.dev/obsidian-dev-utils/p/', reason: 'external-error', targetUrl: 'https://down.example/' },
      { httpStatus: HTTP_NOT_FOUND, pageUrl: 'https://mnaoumov.dev/obsidian-dev-utils/p/', reason: 'external-error', targetUrl: 'https://missing.example/' }
    ]);
  });

  it('never exceeds the configured concurrency', async () => {
    const targets = new Map(Array.from({ length: TARGET_COUNT }, (_unused, index) => [`https://host-${String(index)}.example/`, 'https://mnaoumov.dev/obsidian-dev-utils/p/']));
    let inFlight = 0;
    let maxInFlight = 0;

    function checkUrl(): Promise<number> {
      inFlight++;
      maxInFlight = Math.max(maxInFlight, inFlight);
      return new Promise((resolvePromise) => {
        globalThis.setTimeout(() => {
          inFlight--;
          resolvePromise(HTTP_OK);
        }, PROBE_DELAY_IN_MILLISECONDS);
      });
    }

    await checkExternalTargets(targets, checkUrl, CONCURRENCY_LIMIT);

    expect(maxInFlight).toBe(CONCURRENCY_LIMIT);
  });
});

describe('formatBrokenLinks', () => {
  it('describes each broken-link reason', () => {
    expect(formatBrokenLinks([
      { pageUrl: 'https://s/p1/', reason: 'missing-page', targetUrl: 'https://s/gone/' },
      { pageUrl: 'https://s/p2/', reason: 'missing-fragment', targetUrl: 'https://s/x/#f' },
      { httpStatus: HTTP_SERVER_ERROR, pageUrl: 'https://s/p3/', reason: 'external-error', targetUrl: 'https://ext/' },
      { httpStatus: NETWORK_FAILURE_STATUS, pageUrl: 'https://s/p4/', reason: 'external-error', targetUrl: 'https://dead/' }
    ])).toBe([
      'https://s/p1/ links to missing page https://s/gone/.',
      'https://s/p2/ links to missing fragment https://s/x/#f.',
      'https://s/p3/ links to external URL https://ext/ that returned HTTP 500.',
      'https://s/p4/ links to external URL https://dead/ that returned a network failure.'
    ].join('\n'));
  });
});
