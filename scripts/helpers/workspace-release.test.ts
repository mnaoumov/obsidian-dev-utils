import {
  describe,
  expect,
  it
} from 'vitest';

import {
  pinSiblingDependencies,
  SOURCE_EXPORT_CONDITION,
  toPublishedManifest
} from './workspace-release.ts';

describe('pinSiblingDependencies', () => {
  it('pins every sibling in every dependency map and leaves third-party ranges alone', () => {
    const manifest = {
      dependencies: { '@mnaoumov/typescript-lib': '107.4.1', 'debug': '^4.4.3' },
      devDependencies: { '@mnaoumov/typescript-test-toolkit': '107.4.1' },
      peerDependencies: { vitest: '^5.0.1' }
    };

    pinSiblingDependencies(manifest, new Set(['@mnaoumov/typescript-lib', '@mnaoumov/typescript-test-toolkit']), '108.0.0');

    expect(manifest).toEqual({
      dependencies: { '@mnaoumov/typescript-lib': '108.0.0', 'debug': '^4.4.3' },
      devDependencies: { '@mnaoumov/typescript-test-toolkit': '108.0.0' },
      peerDependencies: { vitest: '^5.0.1' }
    });
  });

  it('accepts a manifest with no dependency maps', () => {
    const manifest = {};
    pinSiblingDependencies(manifest, new Set(['@mnaoumov/typescript-lib']), '108.0.0');
    expect(manifest).toEqual({});
  });
});

describe('toPublishedManifest', () => {
  it('strips the source condition at every depth and keeps everything else', () => {
    const manifest = {
      exports: {
        '.': {
          import: { default: './dist/lib/esm/index.mjs', types: './dist/lib/esm/index.d.mts' },
          [SOURCE_EXPORT_CONDITION]: './src/index.ts'
        },
        './@types/*': {
          import: { types: './dist/lib/esm/@types/*.d.mts' }
        },
        './list': [{ [SOURCE_EXPORT_CONDITION]: './src/list.ts' }, './dist/list.mjs']
      },
      name: '@mnaoumov/typescript-lib',
      version: '108.0.0'
    };

    expect(toPublishedManifest(manifest)).toEqual({
      exports: {
        '.': {
          import: { default: './dist/lib/esm/index.mjs', types: './dist/lib/esm/index.d.mts' }
        },
        './@types/*': {
          import: { types: './dist/lib/esm/@types/*.d.mts' }
        },
        './list': [{}, './dist/list.mjs']
      },
      name: '@mnaoumov/typescript-lib',
      version: '108.0.0'
    });
    expect(manifest.exports['.'][SOURCE_EXPORT_CONDITION]).toBe('./src/index.ts');
  });

  it('copies a manifest that has no exports map', () => {
    const manifest = { name: 'x' };
    const published = toPublishedManifest(manifest);
    expect(published).toEqual(manifest);
    expect(published).not.toBe(manifest);
  });
});
