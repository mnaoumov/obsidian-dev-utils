import type {
  Plugin,
  PluginBuild
} from 'esbuild';

import { build as bundle } from 'esbuild';
import { join } from 'node:path';
import {
  createContext,
  runInContext
} from 'node:vm';
import {
  afterEach,
  describe,
  expect,
  it,
  vi
} from 'vitest';

import type { GenericObject } from '../../../type-guards.ts';

import { ensureGenericObject } from '../../../type-guards.ts';
import {
  ensureBrowserProcess,
  ensureDisposeSymbols,
  keepName,
  preprocessPlugin
} from './preprocess-plugin.ts';

function getHostProcess(): GenericObject {
  // eslint-disable-next-line obsidianmd/no-global-this, unicorn/no-unnecessary-global-this -- The shim under test reads and writes `globalThis.process`; the tests stub that same property.
  return ensureGenericObject(globalThis.process);
}

function makeBuildStub(banner?: string): PluginBuild {
  const partialBuild: Partial<PluginBuild> = {
    initialOptions: banner === undefined ? {} : { banner: { js: banner } },
    onLoad(): void {
      // The tests never trigger a load; only the banner matters here.
    }
  };
  return partialBuild as PluginBuild;
}

function stubProcess(value: unknown): GenericObject {
  vi.stubGlobal('process', value);
  return getHostProcess();
}

describe('ensureBrowserProcess', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('installs the shim when the host has no process at all', () => {
    stubProcess(undefined);

    ensureBrowserProcess();

    const shimmedProcess = getHostProcess();
    expect(shimmedProcess['browser']).toBe(true);
    expect(shimmedProcess['platform']).toBe('android');
    expect(shimmedProcess['env']).toEqual({});
    expect((shimmedProcess['cwd'] as () => string)()).toBe('/');
  });

  it('fills in the missing keys of a partial host process instead of skipping it', () => {
    const partialProcess = stubProcess({});

    ensureBrowserProcess();

    expect(getHostProcess()).toBe(partialProcess);
    expect(partialProcess['browser']).toBe(true);
    expect(partialProcess['platform']).toBe('android');
    expect(partialProcess['env']).toEqual({});
    expect((partialProcess['cwd'] as () => string)()).toBe('/');
  });

  it('keeps the keys the host process already provides', () => {
    function hostCwd(): string {
      return '/host';
    }

    const hostEnv = { DEBUG: 'foo' };
    const partialProcess = stubProcess({
      cwd: hostCwd,
      env: hostEnv,
      platform: 'ios',
      unrelated: 'untouched'
    });

    ensureBrowserProcess();

    expect(partialProcess['cwd']).toBe(hostCwd);
    expect(partialProcess['env']).toBe(hostEnv);
    expect(partialProcess['platform']).toBe('ios');
    expect(partialProcess['unrelated']).toBe('untouched');
    expect(partialProcess['browser']).toBe(true);
  });

  it('overrides an explicit browser: false, which a nullish-assignment merge would leave in place', () => {
    const partialProcess = stubProcess({ browser: false });

    ensureBrowserProcess();

    expect(partialProcess['browser']).toBe(true);
  });

  it('leaves a real Node process completely untouched', () => {
    const nodeProcess = stubProcess({
      platform: 'win32',
      type: 'renderer',
      versions: { node: '22.14.0' }
    });

    ensureBrowserProcess();

    expect(nodeProcess).toEqual({
      platform: 'win32',
      type: 'renderer',
      versions: { node: '22.14.0' }
    });
  });

  it('treats a versions bag without a node entry as a browser process', () => {
    const partialProcess = stubProcess({ versions: {} });

    ensureBrowserProcess();

    expect(partialProcess['browser']).toBe(true);
  });

  it('is idempotent on an already shimmed process', () => {
    const partialProcess = stubProcess({});

    ensureBrowserProcess();
    const afterFirstCall = { ...partialProcess };
    ensureBrowserProcess();

    expect({ ...partialProcess }).toEqual(afterFirstCall);
  });
});

describe('keepName', () => {
  it('returns its argument unchanged', () => {
    function target(): void {
      // Only its identity matters.
    }

    expect(keepName(target)).toBe(target);
  });
});

describe('preprocessPlugin', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  function getBanner(isEsm: boolean): string {
    const plugin: Plugin = preprocessPlugin(isEsm);
    const build = makeBuildStub();
    expect(plugin.setup(build)).toBeUndefined();
    return build.initialOptions.banner?.['js'] ?? '';
  }

  /**
   * Runs the emitted banner the way a built bundle does, against a host `process` of our choosing.
   *
   * This is the only check that exercises what actually ships: the banner is a serialized copy of the
   * module's functions, so a shim that fails to serialize is invisible to every other assertion here.
   */
  function runBanner(isEsm: boolean, hostProcess: unknown): void {
    const banner = getBanner(isEsm);
    vi.stubGlobal('process', hostProcess);
    vi.stubGlobal('__name', undefined);
    vi.stubGlobal('__extractDefault', undefined);
    // eslint-disable-next-line @typescript-eslint/no-implied-eval, no-new-func -- Evaluating the emitted banner is the point of this check.
    const runEmittedBanner = new Function('require', banner);
    // eslint-disable-next-line @typescript-eslint/no-unsafe-call -- `Function` is untyped by construction; the banner takes a single `require` argument.
    runEmittedBanner(() => undefined);
  }

  describe.each([
    ['esm', true],
    ['cjs', false]
  ])('%s banner', (_format, isEsm) => {
    it('shims a host that has no process at all', () => {
      runBanner(isEsm, undefined);

      expect(getHostProcess()['browser']).toBe(true);
    });

    it('fills in a partial host process rather than skipping it', () => {
      runBanner(isEsm, {});

      expect(getHostProcess()['browser']).toBe(true);
      expect(getHostProcess()['platform']).toBe('android');
    });

    it('leaves a real Node process untouched', () => {
      runBanner(isEsm, { versions: { node: '22.14.0' } });

      expect(getHostProcess()['browser']).toBeUndefined();
    });
  });

  it('serializes the __name shim into the cjs banner, so __name holds a function and not window.name', () => {
    runBanner(false, {});

    // eslint-disable-next-line obsidianmd/no-global-this -- The banner assigns onto `globalThis`, which is what this asserts on.
    expect(ensureGenericObject(globalThis)['__name']).toBeTypeOf('function');
  });

  it('omits the __name shim from the esm banner, which never references it', () => {
    expect(getBanner(true)).not.toContain('function keepName(');
  });

  it('appends the banner instead of replacing an existing one', () => {
    const plugin: Plugin = preprocessPlugin(true);
    const build = makeBuildStub('// existing');

    expect(plugin.setup(build)).toBeUndefined();

    expect(build.initialOptions.banner?.['js']).toMatch(/^\/\/ existing/);
  });
});

describe('ensureDisposeSymbols', () => {
  type DisposeSymbolHost = NonNullable<Parameters<typeof ensureDisposeSymbols>[0]>;

  function makeSymbolWithoutDisposeSymbols(): DisposeSymbolHost {
    return { for: (key: string) => Symbol.for(key) };
  }

  it('fills in the registry symbols esbuild looks up when the engine lacks the well-known ones', () => {
    const symbolConstructor = makeSymbolWithoutDisposeSymbols();

    ensureDisposeSymbols(symbolConstructor);

    expect(symbolConstructor.dispose).toBe(Symbol.for('Symbol.dispose'));
    expect(symbolConstructor.asyncDispose).toBe(Symbol.for('Symbol.asyncDispose'));
  });

  it('keeps well-known symbols the engine already has', () => {
    const hostDispose = Symbol('host dispose');
    const hostAsyncDispose = Symbol('host asyncDispose');
    const symbolConstructor = {
      ...makeSymbolWithoutDisposeSymbols(),
      asyncDispose: hostAsyncDispose,
      dispose: hostDispose
    };

    ensureDisposeSymbols(symbolConstructor);

    expect(symbolConstructor.dispose).toBe(hostDispose);
    expect(symbolConstructor.asyncDispose).toBe(hostAsyncDispose);
  });

  it('leaves the ambient Symbol untouched on an engine that has the well-known symbols', () => {
    const { asyncDispose, dispose } = Symbol;

    ensureDisposeSymbols();

    expect(Symbol.dispose).toBe(dispose);
    expect(Symbol.asyncDispose).toBe(asyncDispose);
  });
});

/*
 * Each case bundles a real slice of the library with esbuild, which takes from half a second alone to past vitest's
 * 5 s default under the full suite's load (measured 2026-09-24: 456 ms solo, a timeout in two full runs).
 */
const BUNDLING_TEST_TIMEOUT_IN_MILLISECONDS = 30_000;

describe('using a library disposable on an engine without Symbol.dispose', { timeout: BUNDLING_TEST_TIMEOUT_IN_MILLISECONDS }, () => {
  /**
   * Replaces the context's `Symbol` with a copy that lacks the two dispose symbols, which is how an engine
   * that has not shipped Explicit Resource Management looks to a bundle. The real well-known properties
   * are non-configurable, so they can be neither deleted nor hidden behind a `Proxy`.
   */
  const HIDE_DISPOSE_SYMBOLS = `
    const realSymbol = Symbol;
    const engineSymbol = function Symbol(description) {
      return realSymbol(description);
    };
    for (const key of Reflect.ownKeys(realSymbol)) {
      if (key !== 'dispose' && key !== 'asyncDispose' && key !== 'prototype') {
        Object.defineProperty(engineSymbol, key, { ...Object.getOwnPropertyDescriptor(realSymbol, key), configurable: true });
      }
    }
    globalThis.Symbol = engineSymbol;
  `;

  const ENTRY = `
    import { AsyncCallbackDisposable, CallbackDisposable } from './disposable.ts';
    globalThis.probe = { disposed: false, error: null, asyncDisposed: false, asyncError: null };
    try {
      using _disposable = new CallbackDisposable({ callback: () => { globalThis.probe.disposed = true; } });
    } catch (error) {
      globalThis.probe.error = String(error);
    }
    globalThis.probe.asyncDone = (async () => {
      try {
        await using _asyncDisposable = new AsyncCallbackDisposable({ callback: async () => { globalThis.probe.asyncDisposed = true; } });
      } catch (error) {
        globalThis.probe.asyncError = String(error);
      }
    })();
  `;

  interface Probe {
    asyncDisposed: boolean;
    asyncDone: Promise<void>;
    asyncError: null | string;
    disposed: boolean;
    error: null | string;
  }

  async function runOnEngineWithoutDisposeSymbols(plugins: Plugin[]): Promise<Probe> {
    const result = await bundle({
      bundle: true,
      format: 'iife',
      logLevel: 'silent',
      plugins,
      stdin: {
        contents: ENTRY,
        loader: 'ts',
        // eslint-disable-next-line unicorn/name-replacements -- esbuild's own option name.
        resolveDir: join(import.meta.dirname, '../../..')
      },
      target: 'es2022',
      write: false
    });
    // The cjs banner patches the module-scoped `require` a CommonJS bundle has, so the context supplies one.
    const context = createContext({ require: () => undefined });
    runInContext(HIDE_DISPOSE_SYMBOLS, context);
    runInContext(result.outputFiles[0]?.text ?? '', context);
    const probe = ensureGenericObject(context)['probe'] as Probe;
    await probe.asyncDone;
    return probe;
  }

  it('reproduces the failure without the banner, so the simulated engine really lacks the symbols', async () => {
    const probe = await runOnEngineWithoutDisposeSymbols([]);

    expect(probe.error).toContain('Object not disposable');
    expect(probe.asyncError).toContain('Object not disposable');
    expect(probe.disposed).toBe(false);
  });

  it.each([
    ['esm', true],
    ['cjs', false]
  ])('disposes through the %s banner', async (_format, isEsm) => {
    const probe = await runOnEngineWithoutDisposeSymbols([preprocessPlugin(isEsm)]);

    expect(probe.error).toBeNull();
    expect(probe.asyncError).toBeNull();
    expect(probe.disposed).toBe(true);
    expect(probe.asyncDisposed).toBe(true);
  });
});
