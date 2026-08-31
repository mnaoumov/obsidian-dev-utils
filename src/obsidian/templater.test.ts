/**
 * @file
 *
 * Tests for the Templater internal-API wrapper.
 */

import type {
  App as AppOriginal,
  Plugin as PluginOriginal,
  TFile
} from 'obsidian';

import { App } from 'obsidian-test-mocks/obsidian';
import {
  beforeEach,
  describe,
  expect,
  it
} from 'vitest';

import type { GenericObject } from '../type-guards.ts';
import type {
  TemplaterApi,
  TemplaterRunningConfig
} from './templater.ts';

import { castTo } from '../object-utils.ts';
import { strictProxy } from '../strict-proxy.ts';
import { ensureNonNullable } from '../type-guards.ts';
import {
  getTemplaterFunctions,
  getTemplaterRenderTargetFile,
  parseTemplate,
  requireTemplaterApi,
  resolveTemplaterApi,
  TEMPLATER_PLUGIN_ID,
  TemplaterActiveFileProvider,
  TemplaterRunMode,
  TemplaterUnavailabilityReason,
  TemplaterUnavailableError
} from './templater.ts';

/* eslint-disable camelcase -- Templater API. */

const FILES = {
  'Notes/Other.md': '',
  'Notes/Target.md': '',
  'Templates/Template.md': 'rendered'
};

const OTHER_PATH = 'Notes/Other.md';
const TARGET_PATH = 'Notes/Target.md';
const TEMPLATE_PATH = 'Templates/Template.md';

/**
 * Options for {@link createTemplaterApiRecorder}.
 */
interface CreateTemplaterApiRecorderOptions {
  /**
   * The `current_functions_object` the fake reports, or `undefined` for a Templater with no render in
   * flight.
   *
   * @default `undefined`
   */
  readonly currentFunctionsObject?: object;

  /**
   * What `read_and_parse_template` does once it has recorded the call — resolve with text, or reject.
   *
   * @default resolves with `'rendered'`
   * @returns The rendered text.
   */
  parse?(): Promise<string>;
}

/**
 * Records what a fake Templater was asked to do, so the calls can be asserted on.
 */
interface TemplaterApiRecorder {
  /**
   * The fake API itself.
   */
  readonly api: TemplaterApi;

  /**
   * Every config handed to `create_running_config`.
   */
  readonly createdConfigs: TemplaterRunningConfig[];

  /**
   * Every config handed to `generate_object`.
   */
  readonly generatedFor: TemplaterRunningConfig[];

  /**
   * Every config handed to `read_and_parse_template`.
   */
  readonly parsedConfigs: TemplaterRunningConfig[];

  /**
   * What {@link getTemplaterRenderTargetFile} reported from inside each render.
   */
  readonly renderTargetsSeen: (null | TFile)[];
}

let app: AppOriginal;

/**
 * Builds a fake Templater API that passes every check the guard makes, and records what it is asked to
 * do.
 *
 * @param options - The {@link CreateTemplaterApiRecorderOptions}.
 * @returns The {@link TemplaterApiRecorder}.
 */
function createTemplaterApiRecorder(options: CreateTemplaterApiRecorderOptions = {}): TemplaterApiRecorder {
  const createdConfigs: TemplaterRunningConfig[] = [];
  const generatedFor: TemplaterRunningConfig[] = [];
  const parsedConfigs: TemplaterRunningConfig[] = [];
  const renderTargetsSeen: (null | TFile)[] = [];

  const api: TemplaterApi = {
    create_running_config: (templateFile: TFile | undefined, targetFile: TFile, runMode: TemplaterRunMode): TemplaterRunningConfig => {
      const config: TemplaterRunningConfig = {
        run_mode: runMode,
        target_file: targetFile,
        template_file: templateFile
      };
      createdConfigs.push(config);
      return config;
    },
    functions_generator: {
      generate_object: (config: TemplaterRunningConfig): Promise<object> => {
        generatedFor.push(config);
        return Promise.resolve({ generated: true });
      }
    },
    read_and_parse_template: async (config: TemplaterRunningConfig): Promise<string> => {
      parsedConfigs.push(config);
      renderTargetsSeen.push(getTemplaterRenderTargetFile());
      return await (options.parse ?? ((): Promise<string> => Promise.resolve('rendered')))();
    }
  };

  if (options.currentFunctionsObject) {
    api.current_functions_object = options.currentFunctionsObject;
  }

  return {
    api,
    createdConfigs,
    generatedFor,
    parsedConfigs,
    renderTargetsSeen
  };
}

/**
 * Names a file in the fixture vault.
 *
 * @param path - The file's path.
 * @returns The file.
 */
function getFixtureFile(path: string): TFile {
  return ensureNonNullable(app.vault.getFileByPath(path));
}

/**
 * Points the fixture app's plugin registry at the given `templater-obsidian` plugin.
 *
 * @param plugin - What `getPlugin('templater-obsidian')` returns. `null` means Templater is not loaded.
 */
function setTemplaterPlugin(plugin: unknown): void {
  // `app.plugins` always exists in Obsidian, so it is seeded unconditionally; what varies is whether a
  // Templater is among the loaded ones. The registry is typed to return a `Plugin` and most shapes under
  // Test are deliberately NOT one — that is the point, since these are another plugin's internals.
  castTo<GenericObject>(app)['plugins'] = {
    getPlugin: (id: string): null | PluginOriginal => id === TEMPLATER_PLUGIN_ID ? castTo<null | PluginOriginal>(plugin) : null
  };
}

beforeEach(() => {
  app = App.createConfigured__({ files: FILES }).asOriginalType__();
  setTemplaterPlugin(null);
});

describe('resolveTemplaterApi', () => {
  it('should return the internal API of a loaded Templater', () => {
    const { api } = createTemplaterApiRecorder();
    setTemplaterPlugin({ templater: api });
    expect(resolveTemplaterApi(app)).toBe(api);
  });

  it('should return null when Templater is not loaded', () => {
    expect(resolveTemplaterApi(app)).toBeNull();
  });

  it('should return null when the plugin exposes no templater member at all', () => {
    setTemplaterPlugin({});
    expect(resolveTemplaterApi(app)).toBeNull();
  });

  /*
   * Every shape below is a Templater too old, too new or too broken to talk to. Each has to read as
   * "not there" rather than throw, because the alternative is an exception raised from inside a render.
   */
  it.each([
    ['a non-object templater', 'not an api'],
    ['a null templater', null],
    ['no create_running_config', {
      functions_generator: { generate_object: (): void => undefined },
      read_and_parse_template: (): void => undefined
    }],
    ['a non-callable create_running_config', {
      create_running_config: 'nope',
      functions_generator: { generate_object: (): void => undefined },
      read_and_parse_template: (): void => undefined
    }],
    ['no read_and_parse_template', {
      create_running_config: (): void => undefined,
      functions_generator: { generate_object: (): void => undefined }
    }],
    ['a non-callable read_and_parse_template', {
      create_running_config: (): void => undefined,
      functions_generator: { generate_object: (): void => undefined },
      read_and_parse_template: 'nope'
    }],
    ['no functions_generator', {
      create_running_config: (): void => undefined,
      read_and_parse_template: (): void => undefined
    }],
    ['a non-object functions_generator', {
      create_running_config: (): void => undefined,
      functions_generator: 'nope',
      read_and_parse_template: (): void => undefined
    }],
    ['a null functions_generator', {
      create_running_config: (): void => undefined,
      functions_generator: null,
      read_and_parse_template: (): void => undefined
    }],
    ['a functions_generator with no generate_object', {
      create_running_config: (): void => undefined,
      functions_generator: {},
      read_and_parse_template: (): void => undefined
    }],
    ['a functions_generator whose generate_object is not callable', {
      create_running_config: (): void => undefined,
      functions_generator: { generate_object: 'nope' },
      read_and_parse_template: (): void => undefined
    }]
  ])('should return null for %s', (_description: string, templater: unknown) => {
    setTemplaterPlugin({ templater });
    expect(resolveTemplaterApi(app)).toBeNull();
  });
});

describe('requireTemplaterApi', () => {
  it('should return the internal API of a loaded Templater', () => {
    const { api } = createTemplaterApiRecorder();
    setTemplaterPlugin({ templater: api });
    expect(requireTemplaterApi(app)).toBe(api);
  });

  it('should throw NotLoaded when Templater is not loaded', () => {
    let thrown: unknown;
    try {
      requireTemplaterApi(app);
    } catch (error) {
      thrown = error;
    }

    expect(thrown).toBeInstanceOf(TemplaterUnavailableError);
    const error = castTo<TemplaterUnavailableError>(thrown);
    expect(error.name).toBe('TemplaterUnavailableError');
    expect(error.reason).toBe(TemplaterUnavailabilityReason.NotLoaded);
    expect(error.message).toBe(`The internal API of the plugin "${TEMPLATER_PLUGIN_ID}" is unavailable: notLoaded.`);
  });

  it('should throw ShapeChanged when a loaded Templater no longer exposes the internals', () => {
    setTemplaterPlugin({ templater: 'reshaped' });

    let thrown: unknown;
    try {
      requireTemplaterApi(app);
    } catch (error) {
      thrown = error;
    }

    expect(thrown).toBeInstanceOf(TemplaterUnavailableError);
    const error = castTo<TemplaterUnavailableError>(thrown);
    expect(error.reason).toBe(TemplaterUnavailabilityReason.ShapeChanged);
    expect(error.message).toBe(`The internal API of the plugin "${TEMPLATER_PLUGIN_ID}" is unavailable: shapeChanged.`);
  });
});

describe('parseTemplate', () => {
  it('should render the template against the target and return the text', async () => {
    const recorder = createTemplaterApiRecorder();
    setTemplaterPlugin({ templater: recorder.api });

    const text = await parseTemplate({
      app,
      targetPathOrFile: TARGET_PATH,
      templatePathOrFile: TEMPLATE_PATH
    });

    expect(text).toBe('rendered');
    expect(recorder.parsedConfigs).toHaveLength(1);
    const config = ensureNonNullable(recorder.parsedConfigs[0]);
    expect(config.run_mode).toBe(TemplaterRunMode.DynamicProcessor);
    expect(config.target_file).toBe(getFixtureFile(TARGET_PATH));
    expect(config.template_file).toBe(getFixtureFile(TEMPLATE_PATH));
  });

  it('should report the target as the render target for the duration of the render', async () => {
    const recorder = createTemplaterApiRecorder();
    setTemplaterPlugin({ templater: recorder.api });

    expect(getTemplaterRenderTargetFile()).toBeNull();
    await parseTemplate({
      app,
      targetPathOrFile: TARGET_PATH,
      templatePathOrFile: TEMPLATE_PATH
    });

    expect(recorder.renderTargetsSeen).toEqual([getFixtureFile(TARGET_PATH)]);
    expect(getTemplaterRenderTargetFile()).toBeNull();
  });

  it('should report the innermost target while renders are nested', async () => {
    const innerRecorder = createTemplaterApiRecorder();
    const seenAroundInner: (null | TFile)[] = [];

    const outerApi: TemplaterApi = {
      ...createTemplaterApiRecorder().api,
      read_and_parse_template: async (): Promise<string> => {
        seenAroundInner.push(getTemplaterRenderTargetFile());
        setTemplaterPlugin({ templater: innerRecorder.api });
        const inner = await parseTemplate({
          app,
          targetPathOrFile: OTHER_PATH,
          templatePathOrFile: TEMPLATE_PATH
        });
        seenAroundInner.push(getTemplaterRenderTargetFile());
        return inner;
      }
    };
    setTemplaterPlugin({ templater: outerApi });

    await parseTemplate({
      app,
      targetPathOrFile: TARGET_PATH,
      templatePathOrFile: TEMPLATE_PATH
    });

    expect(innerRecorder.renderTargetsSeen).toEqual([getFixtureFile(OTHER_PATH)]);
    expect(seenAroundInner).toEqual([getFixtureFile(TARGET_PATH), getFixtureFile(TARGET_PATH)]);
    expect(getTemplaterRenderTargetFile()).toBeNull();
  });

  it('should clear the render target when the render throws', async () => {
    const recorder = createTemplaterApiRecorder({ parse: (): Promise<string> => Promise.reject(new Error('Template is broken')) });
    setTemplaterPlugin({ templater: recorder.api });

    await expect(parseTemplate({
      app,
      targetPathOrFile: TARGET_PATH,
      templatePathOrFile: TEMPLATE_PATH
    })).rejects.toThrow('Template is broken');

    expect(getTemplaterRenderTargetFile()).toBeNull();
  });

  it('should throw when Templater is not loaded', async () => {
    await expect(parseTemplate({
      app,
      targetPathOrFile: TARGET_PATH,
      templatePathOrFile: TEMPLATE_PATH
    })).rejects.toBeInstanceOf(TemplaterUnavailableError);
  });
});

describe('getTemplaterFunctions', () => {
  it('should reuse the functions object of the render in flight', async () => {
    const currentFunctionsObject = { current: true };
    const recorder = createTemplaterApiRecorder({ currentFunctionsObject });
    setTemplaterPlugin({ templater: recorder.api });

    const functions = await getTemplaterFunctions({
      app,
      targetPathOrFile: TARGET_PATH
    });

    expect(functions).toBe(currentFunctionsObject);
    expect(recorder.createdConfigs).toEqual([]);
    expect(recorder.generatedFor).toEqual([]);
  });

  it('should generate a functions object when there is no render in flight', async () => {
    const recorder = createTemplaterApiRecorder();
    setTemplaterPlugin({ templater: recorder.api });

    const functions = await getTemplaterFunctions({
      app,
      targetPathOrFile: TARGET_PATH
    });

    expect(functions).toEqual({ generated: true });
    expect(recorder.createdConfigs).toHaveLength(1);
    const config = ensureNonNullable(recorder.createdConfigs[0]);
    expect(config.run_mode).toBe(TemplaterRunMode.StartupTemplate);
    expect(config.target_file).toBe(getFixtureFile(TARGET_PATH));
    expect(config.template_file).toBeUndefined();
    expect(recorder.generatedFor).toEqual([config]);
  });

  it('should generate a fresh functions object when reuse is declined', async () => {
    const recorder = createTemplaterApiRecorder({ currentFunctionsObject: { current: true } });
    setTemplaterPlugin({ templater: recorder.api });

    const functions = await getTemplaterFunctions({
      app,
      shouldReuseCurrent: false,
      targetPathOrFile: TARGET_PATH
    });

    expect(functions).toEqual({ generated: true });
    expect(recorder.generatedFor).toHaveLength(1);
  });

  it('should throw when Templater is not loaded', async () => {
    await expect(getTemplaterFunctions({
      app,
      targetPathOrFile: TARGET_PATH
    })).rejects.toBeInstanceOf(TemplaterUnavailableError);
  });
});

describe('TemplaterActiveFileProvider', () => {
  it('should report the render target while a render is in flight', async () => {
    const seen: (null | TFile)[] = [];
    const provider = new TemplaterActiveFileProvider(createProviderApp());

    const recorder = createTemplaterApiRecorder({
      parse: (): Promise<string> => {
        seen.push(provider.getActiveFile());
        return Promise.resolve('rendered');
      }
    });
    setTemplaterPlugin({ templater: recorder.api });

    await parseTemplate({
      app,
      targetPathOrFile: TARGET_PATH,
      templatePathOrFile: TEMPLATE_PATH
    });

    expect(seen).toEqual([getFixtureFile(TARGET_PATH)]);
  });

  it('should fall back to the workspace active file when no render is in flight', () => {
    expect(new TemplaterActiveFileProvider(createProviderApp()).getActiveFile()).toBe(getFixtureFile(OTHER_PATH));
  });
});

/**
 * Builds the app a {@link TemplaterActiveFileProvider} falls back to — one whose workspace has
 * {@link OTHER_PATH} open, which is deliberately NOT the render target.
 *
 * @returns The app.
 */
function createProviderApp(): AppOriginal {
  const workspaceActiveFile = getFixtureFile(OTHER_PATH);
  return strictProxy<AppOriginal>({ workspace: { getActiveFile: (): null | TFile => workspaceActiveFile } });
}

/* eslint-enable camelcase -- Templater API. */
