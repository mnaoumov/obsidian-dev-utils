import type { App } from 'obsidian';

import {
  describe,
  expect,
  it
} from 'vitest';

import type { GenericObject } from '../type-guards.ts';

import { castTo } from '../object-utils.ts';
import { strictProxy } from '../strict-proxy.ts';
import {
  getNewLinkFormat,
  isSpellcheckEnabled,
  isSpellcheckEnabledForMode,
  shouldUseWikilinks,
  SpellcheckMode
} from './obsidian-settings.ts';

function createMockApp(config: GenericObject): App {
  return strictProxy<App>({
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

describe('isSpellcheckEnabled', () => {
  it('should return true when spellcheck is true', () => {
    const app = createMockApp({ spellcheck: true });
    expect(isSpellcheckEnabled(app)).toBe(true);
  });

  it('should return false when spellcheck is false', () => {
    const app = createMockApp({ spellcheck: false });
    expect(isSpellcheckEnabled(app)).toBe(false);
  });

  it('should return false when spellcheck is undefined', () => {
    const app = createMockApp({});
    expect(isSpellcheckEnabled(app)).toBe(false);
  });
});

describe('isSpellcheckEnabledForMode', () => {
  it('should return true for AlwaysOn even when spellcheck is disabled', () => {
    const app = createMockApp({ spellcheck: false });
    expect(isSpellcheckEnabledForMode(app, SpellcheckMode.AlwaysOn)).toBe(true);
  });

  it('should return false for Off even when spellcheck is enabled', () => {
    const app = createMockApp({ spellcheck: true });
    expect(isSpellcheckEnabledForMode(app, SpellcheckMode.Off)).toBe(false);
  });

  it('should follow the vault setting for FollowObsidianSetting', () => {
    expect(isSpellcheckEnabledForMode(createMockApp({ spellcheck: true }), SpellcheckMode.FollowObsidianSetting)).toBe(true);
    expect(isSpellcheckEnabledForMode(createMockApp({ spellcheck: false }), SpellcheckMode.FollowObsidianSetting)).toBe(false);
  });

  it('should throw for an invalid SpellcheckMode', () => {
    const app = createMockApp({ spellcheck: true });
    expect(() => {
      isSpellcheckEnabledForMode(app, castTo<SpellcheckMode>('invalid'));
    }).toThrow('Unhandled value: invalid');
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
