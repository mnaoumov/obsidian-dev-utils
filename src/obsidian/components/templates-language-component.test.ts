/**
 * @file
 *
 * Tests for {@link TemplatesLanguageComponent}.
 */

import type {
  Grammar,
  PrismModule,
  PrismTokenObject
} from '@obsidian-typings/obsidian-public-latest';

import {
  beforeEach,
  describe,
  expect,
  it,
  vi
} from 'vitest';

import type { TemplatesLanguageComponentConstructorParams } from './templates-language-component.ts';

import { castTo } from '../../object-utils.ts';
import { TemplatesLanguageComponent } from './templates-language-component.ts';

/**
 * The two placeholder entries a built grammar may carry.
 *
 * Deliberately NOT declared as `extends Grammar`: that type intersects `GrammarRest`, whose `rest` member is
 * itself a `Grammar` and so does not satisfy the string index signature the intersection also declares
 * (TS2411). The tests only ever read these two entries, so naming just them is both sufficient and honest.
 */
interface PlaceholderEntries {
  expression: PrismTokenObject;
  expressionWithFormat: PrismTokenObject;
}

const { loadPrismMock } = vi.hoisted(() => ({
  loadPrismMock: vi.fn()
}));

vi.mock('@obsidian-typings/obsidian-public-latest/implementations', () => ({
  loadPrism: loadPrismMock
}));

const TEST_LANGUAGE = 'odu-test-template';
const JAVASCRIPT_GRAMMAR: Grammar = { keyword: /\bconst\b/ };
const FORMAT_OBJECT_PATTERN = /\{[^{}]*\}/;

/**
 * The grammar `obsidian-email-to-vault` registered before this component existed.
 *
 * Asserting against it is what makes "the shared component leaves a scalar consumer unchanged" a test rather
 * than a claim, so a future change to the default shape cannot land silently.
 */
const EMAIL_TO_VAULT_GRAMMAR: Grammar = {
  expression: {
    greedy: true,
    inside: {
      /* eslint-disable perfectionist/sort-objects -- Mirrors the order the plugin declared, which Prism treats as behavior. */
      prefix: {
        alias: 'regex',
        pattern: /\{\{/
      },
      token: {
        alias: 'number',
        pattern: /^[a-zA-Z0-9_]+/
      },
      formatDelimiter: {
        alias: 'regex',
        pattern: /:/
      },
      format: {
        alias: 'string',
        pattern: /[a-zA-Z0-9_-]+/
      },
      suffix: {
        alias: 'regex',
        pattern: /\}\}/
      }
      /* eslint-enable perfectionist/sort-objects -- Mirrors the order the plugin declared, which Prism treats as behavior. */
    },
    pattern: /\{\{.+?\}\}/
  }
};

/**
 * The grammar `obsidian-advanced-note-composer` registered before this component existed.
 *
 * The plugin spelled its closing delimiter `/}\}/`, leaving the first brace unescaped. That is the same
 * language as `/\}\}/` — an unescaped `}` outside a quantifier is a literal — so the component emits the
 * escaped form and this expectation follows it. The difference is in the pattern's source text only.
 */
const ADVANCED_NOTE_COMPOSER_GRAMMAR: Grammar = {
  expression: {
    greedy: true,
    inside: {
      /* eslint-disable perfectionist/sort-objects -- Mirrors the order the plugin declared, which Prism treats as behavior. */
      prefix: {
        alias: 'regex',
        pattern: /\{\{/
      },
      token: {
        alias: 'number',
        pattern: /^[a-zA-Z0-9_,]+/
      },
      formatDelimiter: {
        alias: 'regex',
        pattern: /:/
      },
      format: {
        alias: 'string',
        pattern: /[a-zA-Z0-9_,-]+/
      },
      suffix: {
        alias: 'regex',
        pattern: /\}\}/
      }
      /* eslint-enable perfectionist/sort-objects -- Mirrors the order the plugin declared, which Prism treats as behavior. */
    },
    pattern: /\{\{.+?\}\}/
  }
};

describe('TemplatesLanguageComponent', () => {
  let prism: PrismModule;

  beforeEach(() => {
    prism = castTo<PrismModule>({ languages: {} });
    loadPrismMock.mockReset();
    loadPrismMock.mockResolvedValue(prism);
  });

  describe('registration', () => {
    it('should register the language on load', async () => {
      await loadComponent({ language: TEST_LANGUAGE });

      expect(prism.languages[TEST_LANGUAGE]).toBeDefined();
    });

    it('should unregister the language on unload', async () => {
      const component = await loadComponent({ language: TEST_LANGUAGE });
      expect(prism.languages[TEST_LANGUAGE]).toBeDefined();

      component.unload();

      expect(Object.hasOwn(prism.languages, TEST_LANGUAGE)).toBe(false);
    });

    it('should restore a previously registered grammar on unload', async () => {
      const previousGrammar: Grammar = { comment: /#.*/ };
      prism.languages[TEST_LANGUAGE] = previousGrammar;

      const component = await loadComponent({ language: TEST_LANGUAGE });
      expect(prism.languages[TEST_LANGUAGE]).not.toBe(previousGrammar);

      component.unload();

      expect(prism.languages[TEST_LANGUAGE]).toBe(previousGrammar);
    });
  });

  describe('scalar format', () => {
    it('should reproduce the grammar the email-to-vault plugin registered', async () => {
      await loadComponent({ language: TEST_LANGUAGE });

      expect(prism.languages[TEST_LANGUAGE]).toEqual(EMAIL_TO_VAULT_GRAMMAR);
    });

    it('should reproduce the grammar the advanced-note-composer plugin registered', async () => {
      await loadComponent({
        formatSource: /[a-zA-Z0-9_,-]+/,
        language: TEST_LANGUAGE,
        tokenPattern: /^[a-zA-Z0-9_,]+/
      });

      expect(prism.languages[TEST_LANGUAGE]).toEqual(ADVANCED_NOTE_COMPOSER_GRAMMAR);
    });

    it('should match a placeholder with and without a format half', async () => {
      await loadComponent({ language: TEST_LANGUAGE });

      const grammar = castTo<PlaceholderEntries>(prism.languages[TEST_LANGUAGE]);
      expect(grammar.expression.pattern.test('{{subject}}')).toBe(true);
      expect(grammar.expression.pattern.test('{{date:YYYY-MM-DD}}')).toBe(true);
    });

    it('should emit no separate with-format entry', async () => {
      await loadComponent({ language: TEST_LANGUAGE });

      expect(Object.hasOwn(castTo<object>(prism.languages[TEST_LANGUAGE]), 'expressionWithFormat')).toBe(false);
    });
  });

  describe('structured format', () => {
    it('should nest a grammar built from the loaded Prism module', async () => {
      prism.languages['javascript'] = JAVASCRIPT_GRAMMAR;

      await loadComponent({
        formatSource: (params) => ({
          alias: 'language-javascript',
          inside: params.requirePrismLanguage('javascript'),
          pattern: FORMAT_OBJECT_PATTERN
        }),
        language: TEST_LANGUAGE
      });

      const grammar = castTo<PlaceholderEntries>(prism.languages[TEST_LANGUAGE]);
      expect(grammar.expressionWithFormat.inside?.['format']).toEqual({
        alias: 'language-javascript',
        inside: JAVASCRIPT_GRAMMAR,
        pattern: FORMAT_OBJECT_PATTERN
      });
    });

    it('should emit a separate entry for a placeholder carrying no format half', async () => {
      await loadComponent({
        formatSource: {
          alias: 'language-javascript',
          pattern: FORMAT_OBJECT_PATTERN
        },
        language: TEST_LANGUAGE
      });

      const grammar = castTo<PlaceholderEntries>(prism.languages[TEST_LANGUAGE]);
      expect(grammar.expression.pattern.source).toBe(String.raw`\{\{[a-zA-Z0-9_]+\}\}`);
      expect(Object.hasOwn(grammar.expression.inside ?? {}, 'format')).toBe(false);
    });

    it('should build the with-format extent from the format half own pattern', async () => {
      await loadComponent({
        formatSource: {
          alias: 'language-javascript',
          pattern: FORMAT_OBJECT_PATTERN
        },
        language: TEST_LANGUAGE
      });

      const grammar = castTo<PlaceholderEntries>(prism.languages[TEST_LANGUAGE]);
      expect(grammar.expressionWithFormat.pattern.test('{{date:{momentJsFormat:YYYY}}}')).toBe(true);
      expect(grammar.expressionWithFormat.pattern.test('{{date}}')).toBe(false);
    });
  });

  describe('extraGrammar', () => {
    it('should merge extra top-level entries into the grammar', async () => {
      await loadComponent({
        extraGrammar: {
          important: { pattern: /^\./ },
          operator: {
            alias: 'entity',
            pattern: /\//
          }
        },
        language: TEST_LANGUAGE
      });

      expect(prism.languages[TEST_LANGUAGE]).toEqual({
        ...EMAIL_TO_VAULT_GRAMMAR,
        important: { pattern: /^\./ },
        operator: {
          alias: 'entity',
          pattern: /\//
        }
      });
    });
  });
});

/**
 * Creates the component and awaits its asynchronous load, so the registration is observable.
 *
 * @param params - The parameters for the component.
 * @returns The loaded component.
 */
async function loadComponent(params: TemplatesLanguageComponentConstructorParams): Promise<TemplatesLanguageComponent> {
  const component = new TemplatesLanguageComponent(params);
  await component.loadWithPromises();
  return component;
}
