import {
  describe,
  expect,
  it
} from 'vitest';

import redirects from '../old-site-redirects.json' with { type: 'json' };
import {
  getMovedPages,
  getNoScriptRefreshHtml,
  toMovedPage
} from './moved-pages.ts';

describe('toMovedPage', () => {
  it('should describe an API page', () => {
    expect(toMovedPage('/api/abort-controller/abortSignalAny/', 'https://mnaoumov.dev/typescript-lib/api/abort-controller/abortSignalAny/'))
      .toEqual({
        packageName: '@mnaoumov/typescript-lib',
        pageName: 'abortSignalAny',
        routeParameter: 'api/abort-controller/abortSignalAny',
        targetUrl: 'https://mnaoumov.dev/typescript-lib/api/abort-controller/abortSignalAny/'
      });
  });

  it('should name a package API root', () => {
    expect(toMovedPage('/api/gone/', 'https://mnaoumov.dev/typescript-dev-toolkit/api/').pageName).toBe('API');
  });

  it('should name a package home page', () => {
    expect(toMovedPage('/guides/gone/', 'https://mnaoumov.dev/obsidian-lib/').pageName).toBe('home');
  });

  it('should refuse an old path without its slashes', () => {
    expect(() => toMovedPage('api/x', 'https://mnaoumov.dev/obsidian-lib/')).toThrow('leading and a trailing slash');
    expect(() => toMovedPage('/', 'https://mnaoumov.dev/obsidian-lib/')).toThrow('leading and a trailing slash');
  });

  it('should refuse a target that is not on a package site', () => {
    expect(() => toMovedPage('/api/x/', 'https://mnaoumov.dev/')).toThrow('package site');
  });
});

describe('getMovedPages', () => {
  it('should cover every entry of the frozen map with a distinct route', () => {
    const movedPages = getMovedPages(redirects);
    expect(movedPages).toHaveLength(Object.keys(redirects).length);
    expect(new Set(movedPages.map((page) => page.routeParameter)).size).toBe(movedPages.length);
  });
});

describe('getNoScriptRefreshHtml', () => {
  it('should refresh after the delay and escape the URL', () => {
    expect(getNoScriptRefreshHtml('https://mnaoumov.dev/a/?x=1&y="2"')).toBe(
      '<meta http-equiv="refresh" content="10;url=https://mnaoumov.dev/a/?x=1&amp;y=&quot;2&quot;">'
    );
  });
});
