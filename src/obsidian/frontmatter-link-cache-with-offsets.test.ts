import type {
  FrontmatterLinkCache,
  Reference
} from 'obsidian';

import {
  describe,
  expect,
  it
} from 'vitest';

import type { FrontmatterLinkCacheWithOffsets } from './frontmatter-link-cache-with-offsets.ts';

import { castTo } from '../object-utils.ts';
import { strictProxy } from '../test-helpers/mock-implementation.ts';
import {
  isFrontmatterLinkCacheWithOffsets,
  toFrontmatterLinkCacheWithOffsets
} from './frontmatter-link-cache-with-offsets.ts';

function makeFrontmatterLink(original: string, key: string): FrontmatterLinkCache {
  return {
    displayText: original,
    key,
    link: original,
    original
  } as FrontmatterLinkCache;
}

describe('isFrontmatterLinkCacheWithOffsets', () => {
  it('should return true when startOffset and endOffset are present', () => {
    const ref = strictProxy<FrontmatterLinkCacheWithOffsets>({
      ...makeFrontmatterLink('link', 'aliases'),
      endOffset: 4,
      startOffset: 0
    });
    expect(isFrontmatterLinkCacheWithOffsets(ref)).toBe(true);
  });

  it('should return false for a frontmatter link without offsets', () => {
    const ref = castTo<Reference>(makeFrontmatterLink('link', 'aliases'));
    expect(isFrontmatterLinkCacheWithOffsets(ref)).toBe(false);
  });

  it('should return false for a reference cache (no key)', () => {
    const ref = {
      link: '[[link]]',
      original: '[[link]]',
      position: { end: { col: 0, line: 0, offset: 8 }, start: { col: 0, line: 0, offset: 0 } }
    } as Reference;
    expect(isFrontmatterLinkCacheWithOffsets(ref)).toBe(false);
  });

  it('should return false when only startOffset is present', () => {
    const ref = castTo<Reference>({
      ...makeFrontmatterLink('link', 'aliases'),
      startOffset: 0
    });
    expect(isFrontmatterLinkCacheWithOffsets(ref)).toBe(false);
  });
});

describe('toFrontmatterLinkCacheWithOffsets', () => {
  it('should return the same reference if already has offsets', () => {
    const ref = {
      ...makeFrontmatterLink('link', 'aliases'),
      endOffset: 4,
      startOffset: 0
    };
    const result = toFrontmatterLinkCacheWithOffsets(castTo<FrontmatterLinkCache>(ref));
    expect(result).toBe(ref);
  });

  it('should add offsets spanning the full original string when not present', () => {
    const ref = makeFrontmatterLink('hello', 'aliases');
    const result = toFrontmatterLinkCacheWithOffsets(ref);
    expect(result.startOffset).toBe(0);
    expect(result.endOffset).toBe(5);
  });

  it('should preserve all original properties', () => {
    const ref = makeFrontmatterLink('link', 'aliases');
    const result = toFrontmatterLinkCacheWithOffsets(ref);
    expect(result.key).toBe('aliases');
    expect(result.original).toBe('link');
    expect(result.link).toBe('link');
  });
});
