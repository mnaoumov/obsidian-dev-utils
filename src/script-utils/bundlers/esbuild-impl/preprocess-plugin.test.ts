import type {
  Plugin,
  PluginBuild
} from 'esbuild';

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
    // eslint-disable-next-line @typescript-eslint/no-implied-eval, no-new-func, obsidianmd/rule-custom-message -- Evaluating the emitted banner is the point of this check.
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
