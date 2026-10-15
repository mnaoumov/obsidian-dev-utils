import type {
  Plugin,
  PluginBuild
} from 'esbuild';

import {
  describe,
  expect,
  it
} from 'vitest';

import { preprocessPlugin } from './preprocess-plugin.ts';

function getBanner(isEsm?: boolean): string {
  const plugin: Plugin = preprocessPlugin(isEsm);
  const build = makeBuildStub();
  expect(plugin.setup(build)).toBeUndefined();
  return build.initialOptions.banner?.['js'] ?? '';
}

function makeBuildStub(): PluginBuild {
  const partialBuild: Partial<PluginBuild> = {
    initialOptions: {},
    onLoad(): void {
      // The tests never trigger a load; only the setup matters here.
    }
  };
  return partialBuild as PluginBuild;
}

describe('preprocessPlugin', () => {
  it('adds the Obsidian require patch to the cjs banner, after the shared shims', () => {
    const banner = getBanner();

    expect(banner).toContain('function patchObsidianRequire(');
    expect(banner).toContain('function ensureDisposeSymbols(');
    expect(banner.indexOf('function patchObsidianRequire(')).toBeGreaterThan(banner.indexOf('function ensureDisposeSymbols('));
  });

  it('leaves the require patch out of the esm banner', () => {
    expect(getBanner(true)).not.toContain('patchObsidianRequire');
  });

  it('defines import.meta.url only for a cjs build', () => {
    const cjsPlugin = preprocessPlugin(false);
    const cjsBuild = makeBuildStub();
    expect(cjsPlugin.setup(cjsBuild)).toBeUndefined();
    expect(Object.keys(cjsBuild.initialOptions.define ?? {})).toHaveLength(1);

    const esmPlugin = preprocessPlugin(true);
    const esmBuild = makeBuildStub();
    expect(esmPlugin.setup(esmBuild)).toBeUndefined();
    expect(esmBuild.initialOptions.define).toEqual({});
  });
});
