// @vitest-environment jsdom

import type { App as AppOriginal } from 'obsidian';

import { App } from 'obsidian-test-mocks/obsidian';
import {
  beforeEach,
  describe,
  expect,
  it
} from 'vitest';

import { assertNonNullable } from '../type-guards.ts';
import {
  appendCodeBlock,
  applySpellcheckMode
} from './html-element.ts';
import { SpellcheckMode } from './obsidian-settings.ts';

let app: AppOriginal;

beforeEach(() => {
  app = App.createConfigured__().asOriginalType__();
});

describe('appendCodeBlock', () => {
  it('should append a strong.markdown-rendered.code wrapping a code element with the text', () => {
    const element = createDiv();
    appendCodeBlock(element, 'console.log("hello")');
    const strong = element.querySelector('strong');
    assertNonNullable(strong);
    expect(strong.className).toBe('markdown-rendered code');
    const code = strong.querySelector('code');
    assertNonNullable(code);
    expect(code.textContent).toBe('console.log("hello")');
  });

  it('should work on a DocumentFragment', () => {
    const fragment = createFragment();
    appendCodeBlock(fragment, 'const x = 42;');
    expect(fragment.querySelector('code')?.textContent).toBe('const x = 42;');
  });
});

describe('applySpellcheckMode', () => {
  it('should default to Off, leaving the element unchecked whatever the vault setting says', () => {
    app.vault.setConfig('spellcheck', true);
    const element = createDiv();
    applySpellcheckMode({
      app,
      element
    });
    expect(element.getAttribute('spellcheck')).toBe('false');
  });

  it('should follow the vault setting for FollowObsidianSetting', () => {
    const element = createDiv();
    app.vault.setConfig('spellcheck', true);
    applySpellcheckMode({
      app,
      element,
      spellcheckMode: SpellcheckMode.FollowObsidianSetting
    });
    expect(element.getAttribute('spellcheck')).toBe('true');

    app.vault.setConfig('spellcheck', false);
    applySpellcheckMode({
      app,
      element,
      spellcheckMode: SpellcheckMode.FollowObsidianSetting
    });
    expect(element.getAttribute('spellcheck')).toBe('false');
  });

  it('should set the attribute for AlwaysOn even when the vault setting is disabled', () => {
    app.vault.setConfig('spellcheck', false);
    const element = createDiv();
    applySpellcheckMode({
      app,
      element,
      spellcheckMode: SpellcheckMode.AlwaysOn
    });
    expect(element.getAttribute('spellcheck')).toBe('true');
  });

  it('should clear the attribute for Off even when the vault setting is enabled', () => {
    app.vault.setConfig('spellcheck', true);
    const element = createDiv();
    element.setAttribute('spellcheck', 'true');
    applySpellcheckMode({
      app,
      element,
      spellcheckMode: SpellcheckMode.Off
    });
    expect(element.getAttribute('spellcheck')).toBe('false');
  });
});
