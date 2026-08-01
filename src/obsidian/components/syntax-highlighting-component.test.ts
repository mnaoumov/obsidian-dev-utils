/**
 * @file
 *
 * Tests for {@link SyntaxHighlightingComponent}.
 */

import type {
  Cm5EditorConfiguration,
  Cm5Mode,
  Cm5ModeFactory,
  CodeMirrorModule,
  Grammar,
  PrismModule
} from '@obsidian-typings/obsidian-public-latest';

import {
  beforeEach,
  describe,
  expect,
  it,
  vi
} from 'vitest';

import { SilentError } from '../../error.ts';
import { castTo } from '../../object-utils.ts';
import { SyntaxHighlightingComponent } from './syntax-highlighting-component.ts';

interface Mocks {
  getMode: ReturnType<typeof createGetModeMock>;
  modes: CodeMirrorModule['modes'];
  prism: PrismModule;
}

const { loadPrismMock } = vi.hoisted(() => ({
  loadPrismMock: vi.fn()
}));

vi.mock('@obsidian-typings/obsidian-public-latest/implementations', () => ({
  loadPrism: loadPrismMock
}));

const TEST_LANGUAGE = 'odu-test-language';
const EDITOR_MODE = 'text/typescript';
const TEST_GRAMMAR: Grammar = { comment: /#.*/ };
const TYPESCRIPT_GRAMMAR: Grammar = { keyword: /\bconst\b/ };

describe('SyntaxHighlightingComponent', () => {
  let mocks: Mocks;

  beforeEach(() => {
    mocks = createMocks();
  });

  describe('registerPrismLanguage', () => {
    it('should register the passed grammar', async () => {
      const component = createLoadedComponent();

      await component.registerPrismLanguage({
        grammar: TEST_GRAMMAR,
        language: TEST_LANGUAGE
      });

      expect(mocks.prism.languages[TEST_LANGUAGE]).toBe(TEST_GRAMMAR);
    });

    it('should alias an existing language when the grammar is a string', async () => {
      const component = createLoadedComponent();
      mocks.prism.languages['typescript'] = TYPESCRIPT_GRAMMAR;

      await component.registerPrismLanguage({
        grammar: 'typescript',
        language: TEST_LANGUAGE
      });

      expect(mocks.prism.languages[TEST_LANGUAGE]).toBe(TYPESCRIPT_GRAMMAR);
    });

    it('should throw when the aliased language is not registered', async () => {
      const component = createLoadedComponent();

      await expect(component.registerPrismLanguage({
        grammar: 'typescript',
        language: TEST_LANGUAGE
      })).rejects.toThrow('Prism language "typescript" is not registered.');
      expect(mocks.prism.languages[TEST_LANGUAGE]).toBeUndefined();
    });

    it('should build the grammar from a factory receiving the loaded Prism module', async () => {
      const component = createLoadedComponent();
      let factoryPrism: null | PrismModule = null;

      await component.registerPrismLanguage({
        grammar: ({ prism }): Grammar => {
          factoryPrism = prism;
          return TEST_GRAMMAR;
        },
        language: TEST_LANGUAGE
      });

      expect(factoryPrism).toBe(mocks.prism);
      expect(mocks.prism.languages[TEST_LANGUAGE]).toBe(TEST_GRAMMAR);
    });

    it('should let a factory require an existing language', async () => {
      const component = createLoadedComponent();
      mocks.prism.languages['javascript'] = TYPESCRIPT_GRAMMAR;

      await component.registerPrismLanguage({
        grammar: ({ requirePrismLanguage }): Grammar => ({
          expression: {
            inside: requirePrismLanguage('javascript'),
            pattern: /\$\{.+?\}/
          }
        }),
        language: TEST_LANGUAGE
      });

      expect(mocks.prism.languages[TEST_LANGUAGE]?.['expression']).toMatchObject({ inside: TYPESCRIPT_GRAMMAR });
    });

    it('should throw when a factory requires a language that is not registered', async () => {
      const component = createLoadedComponent();

      await expect(component.registerPrismLanguage({
        grammar: ({ requirePrismLanguage }): Grammar => ({
          expression: {
            inside: requirePrismLanguage('javascript'),
            pattern: /\$\{.+?\}/
          }
        }),
        language: TEST_LANGUAGE
      })).rejects.toThrow('Prism language "javascript" is not registered.');
    });

    it('should delete the registered language when unloaded', async () => {
      const component = createLoadedComponent();

      await component.registerPrismLanguage({
        grammar: TEST_GRAMMAR,
        language: TEST_LANGUAGE
      });
      component.unload();

      expect(TEST_LANGUAGE in mocks.prism.languages).toBe(false);
    });

    it('should restore the previously registered language when unloaded', async () => {
      const component = createLoadedComponent();
      mocks.prism.languages[TEST_LANGUAGE] = TYPESCRIPT_GRAMMAR;

      await component.registerPrismLanguage({
        grammar: TEST_GRAMMAR,
        language: TEST_LANGUAGE
      });
      expect(mocks.prism.languages[TEST_LANGUAGE]).toBe(TEST_GRAMMAR);

      component.unload();

      expect(mocks.prism.languages[TEST_LANGUAGE]).toBe(TYPESCRIPT_GRAMMAR);
    });

    it('should throw when the component is not loaded', async () => {
      const component = new SyntaxHighlightingComponent();

      await expect(component.registerPrismLanguage({
        grammar: TEST_GRAMMAR,
        language: TEST_LANGUAGE
      })).rejects.toThrow('Component is not loaded');
      expect(loadPrismMock).not.toHaveBeenCalled();
    });

    it('should unwind silently when the component is unloaded while Prism is loading', async () => {
      const component = createLoadedComponent();
      let resolveLoadPrism = null as ((prism: PrismModule) => void) | null;
      loadPrismMock.mockReturnValue(
        new Promise<PrismModule>((resolve) => {
          resolveLoadPrism = resolve;
        })
      );

      const registerPromise = component.registerPrismLanguage({
        grammar: TEST_GRAMMAR,
        language: TEST_LANGUAGE
      });
      component.unload();
      resolveLoadPrism?.(mocks.prism);

      await expect(registerPromise).rejects.toThrow(SilentError);
      expect(mocks.prism.languages[TEST_LANGUAGE]).toBeUndefined();
    });
  });

  describe('registerCodeBlockLanguage', () => {
    it('should define an editor mode delegating to the passed editor mode', async () => {
      const component = createLoadedComponent();

      await component.registerCodeBlockLanguage({
        editorMode: EDITOR_MODE,
        language: TEST_LANGUAGE
      });

      const config = castTo<Cm5EditorConfiguration>({});
      mocks.modes[TEST_LANGUAGE]?.(config);
      expect(mocks.getMode).toHaveBeenCalledWith(config, EDITOR_MODE);
    });

    it('should register the Prism grammar as well when it is passed', async () => {
      const component = createLoadedComponent();

      await component.registerCodeBlockLanguage({
        editorMode: EDITOR_MODE,
        language: TEST_LANGUAGE,
        prismGrammar: TEST_GRAMMAR
      });

      expect(mocks.prism.languages[TEST_LANGUAGE]).toBe(TEST_GRAMMAR);
    });

    it('should not touch Prism when no grammar is passed', async () => {
      const component = createLoadedComponent();

      await component.registerCodeBlockLanguage({
        editorMode: EDITOR_MODE,
        language: TEST_LANGUAGE
      });

      expect(loadPrismMock).not.toHaveBeenCalled();
      expect(mocks.prism.languages[TEST_LANGUAGE]).toBeUndefined();
    });

    it('should delete the editor mode and the Prism grammar when unloaded', async () => {
      const component = createLoadedComponent();

      await component.registerCodeBlockLanguage({
        editorMode: EDITOR_MODE,
        language: TEST_LANGUAGE,
        prismGrammar: TEST_GRAMMAR
      });
      component.unload();

      expect(TEST_LANGUAGE in mocks.modes).toBe(false);
      expect(TEST_LANGUAGE in mocks.prism.languages).toBe(false);
    });

    it('should restore the previously defined editor mode when unloaded', async () => {
      const component = createLoadedComponent();
      const previousModeFactory = createModeFactoryMock();
      mocks.modes[TEST_LANGUAGE] = previousModeFactory;

      await component.registerCodeBlockLanguage({
        editorMode: EDITOR_MODE,
        language: TEST_LANGUAGE
      });
      expect(mocks.modes[TEST_LANGUAGE]).not.toBe(previousModeFactory);

      component.unload();

      expect(mocks.modes[TEST_LANGUAGE]).toBe(previousModeFactory);
    });

    it('should throw when the component is not loaded', async () => {
      const component = new SyntaxHighlightingComponent();

      await expect(component.registerCodeBlockLanguage({
        editorMode: EDITOR_MODE,
        language: TEST_LANGUAGE
      })).rejects.toThrow('Component is not loaded');
      expect(TEST_LANGUAGE in mocks.modes).toBe(false);
    });
  });
});

function createGetModeMock(): ReturnType<typeof vi.fn<(config: Cm5EditorConfiguration, modeSpec: string) => Cm5Mode<unknown>>> {
  return vi.fn<(config: Cm5EditorConfiguration, modeSpec: string) => Cm5Mode<unknown>>(() => createModeMock());
}

function createLoadedComponent(): SyntaxHighlightingComponent {
  const component = new SyntaxHighlightingComponent();
  component.load();
  return component;
}

/**
 * Builds the two Obsidian runtime globals the component talks to.
 *
 * Neither is modeled by `obsidian-test-mocks` — its `loadPrism` resolves to an empty object and there is no
 * `window.CodeMirror` at all — so supplementing them here is the sanctioned test double. `strictProxy` is
 * deliberately NOT used: it recursively wraps nested plain objects and throws on an unknown key, but reading
 * a NOT-yet-registered language/mode as `undefined` is exactly the behavior under test.
 *
 * @returns The mocked registries.
 */
function createMocks(): Mocks {
  const modes: CodeMirrorModule['modes'] = {};
  const getMode = createGetModeMock();

  window.CodeMirror = castTo<CodeMirrorModule>({
    defineMode: (name: string, modeFactory: Cm5ModeFactory<unknown>): void => {
      modes[name] = modeFactory;
    },
    getMode,
    modes
  });

  const prism = castTo<PrismModule>({ languages: {} });
  loadPrismMock.mockReset();
  loadPrismMock.mockResolvedValue(prism);

  return { getMode, modes, prism };
}

function createModeFactoryMock(): Cm5ModeFactory<unknown> {
  return () => createModeMock();
}

function createModeMock(): Cm5Mode<unknown> {
  return castTo<Cm5Mode<unknown>>({});
}
