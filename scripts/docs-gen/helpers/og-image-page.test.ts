import {
  describe,
  expect,
  it
} from 'vitest';

import { getOgImagePageSlug } from './og-image-page.ts';

describe('getOgImagePageSlug', () => {
  it('preserves casing from an explicit public slug', () => {
    expect(
      getOgImagePageSlug(
        { slug: 'api/abort-controller/abortSignalAny' },
        'docs/src/content/docs/api/abort-controller/abortsignalany/index.mdx',
        'docs/src/content/docs'
      )
    ).toBe('api/abort-controller/abortSignalAny');
  });

  it('derives an index-page slug when no explicit slug is provided', () => {
    expect(
      getOgImagePageSlug(
        {},
        'docs/src/content/docs/guides/index.mdx',
        'docs/src/content/docs'
      )
    ).toBe('guides');
  });

  it('uses index for the documentation root page', () => {
    expect(
      getOgImagePageSlug(
        {},
        'docs/src/content/docs/index.mdx',
        'docs/src/content/docs'
      )
    ).toBe('index');
  });
});
