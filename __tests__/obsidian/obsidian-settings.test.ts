import type { App } from 'obsidian';

import {
  describe,
  expect,
  it
} from 'vitest';

import type { GenericObject } from '../../src/type-guards.ts';

import { castTo } from '../../src/object-utils.ts';
import {
  getNewLinkFormat,
  shouldUseWikilinks
} from '../../src/obsidian/obsidian-settings.ts';

function createMockApp(config: GenericObject): App {
  return castTo<App>({
    vault: {
      getConfig: (key: string): unknown => config[key]
    }
  });
}

describe('getNewLinkFormat', () => {
  it('should return shortest when configured', () => {
    const app = createMockApp({ newLinkFormat: 'shortest' });
    expect(getNewLinkFormat(app)).toBe('shortest');
  });

  it('should return relative when configured', () => {
    const app = createMockApp({ newLinkFormat: 'relative' });
    expect(getNewLinkFormat(app)).toBe('relative');
  });

  it('should return absolute when configured', () => {
    const app = createMockApp({ newLinkFormat: 'absolute' });
    expect(getNewLinkFormat(app)).toBe('absolute');
  });
});

describe('shouldUseWikilinks', () => {
  it('should return true when useMarkdownLinks is false', () => {
    const app = createMockApp({ useMarkdownLinks: false });
    expect(shouldUseWikilinks(app)).toBe(true);
  });

  it('should return true when useMarkdownLinks is undefined', () => {
    const app = createMockApp({});
    expect(shouldUseWikilinks(app)).toBe(true);
  });

  it('should return false when useMarkdownLinks is true', () => {
    const app = createMockApp({ useMarkdownLinks: true });
    expect(shouldUseWikilinks(app)).toBe(false);
  });
});
