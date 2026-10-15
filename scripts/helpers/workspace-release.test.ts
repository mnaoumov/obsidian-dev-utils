import {
  describe,
  expect,
  it
} from 'vitest';

import {
  SOURCE_EXPORT_CONDITION,
  toPublishedManifest
} from './workspace-release.ts';

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
