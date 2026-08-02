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
import type { CanvasReference } from './reference.ts';

import { strictProxy } from '../strict-proxy.ts';
import {
  isCanvasFileNodeReference,
  isCanvasReference,
  isCanvasTextNodeReference,
  referenceToFileChange,
  sortReferences
} from './reference.ts';

interface FrontmatterLinkCacheEx extends FrontmatterLinkCache {
  endOffset?: undefined;
  isCanvas?: undefined;
  position?: undefined;
  startOffset?: undefined;
}

interface FrontmatterLinkCacheWithOffsetsEx extends FrontmatterLinkCacheWithOffsets {
  position?: undefined;
}

function makeCanvasReference(type: 'file' | 'text', key: string): Reference {
  return strictProxy<CanvasReference>({
    displayText: 'link',
    isCanvas: true,
    key,
    link: 'link',
    nodeIndex: 0,
    original: 'link',
    type
  });
}

function makeFrontmatterLink(original: string, key: string): Reference {
  return strictProxy<FrontmatterLinkCacheEx>({
    displayText: original,
    endOffset: undefined,
    isCanvas: undefined,
    key,
    link: original,
    original,
    position: undefined,
    startOffset: undefined
  });
}

function makeFrontmatterLinkWithOffsets(original: string, key: string, startOffset: number, endOffset: number): Reference {
  return strictProxy<FrontmatterLinkCacheWithOffsetsEx>({
    displayText: original,
    endOffset,
    key,
    link: original,
    original,
    position: undefined,
    startOffset
  });
}

function makeReferenceCache(original: string, startOffset: number): Reference {
  return {
    link: original,
    original,
    position: {
      end: { col: 0, line: 0, offset: startOffset + original.length },
      start: { col: 0, line: 0, offset: startOffset }
    }
  } as Reference;
}

describe('isCanvasReference', () => {
  it('should return true for a canvas reference', () => {
    const reference = makeCanvasReference('file', 'k');
    expect(isCanvasReference(reference)).toBe(true);
  });

  it('should return false for a regular reference cache', () => {
    const reference = makeReferenceCache('[[link]]', 0);
    expect(isCanvasReference(reference)).toBe(false);
  });

  it('should return false for a frontmatter link without isCanvas', () => {
    const reference = makeFrontmatterLink('link', 'aliases');
    expect(isCanvasReference(reference)).toBe(false);
  });
});

describe('isCanvasFileNodeReference', () => {
  it('should return true for a canvas file node reference', () => {
    const reference = makeCanvasReference('file', 'k');
    expect(isCanvasFileNodeReference(reference)).toBe(true);
  });

  it('should return false for a canvas text node reference', () => {
    const reference = makeCanvasReference('text', 'k');
    expect(isCanvasFileNodeReference(reference)).toBe(false);
  });

  it('should return false for a regular reference', () => {
    const reference = makeReferenceCache('[[link]]', 0);
    expect(isCanvasFileNodeReference(reference)).toBe(false);
  });
});

describe('isCanvasTextNodeReference', () => {
  it('should return true for a canvas text node reference', () => {
    const reference = makeCanvasReference('text', 'k');
    expect(isCanvasTextNodeReference(reference)).toBe(true);
  });

  it('should return false for a canvas file node reference', () => {
    const reference = makeCanvasReference('file', 'k');
    expect(isCanvasTextNodeReference(reference)).toBe(false);
  });

  it('should return false for a regular reference', () => {
    const reference = makeReferenceCache('[[link]]', 0);
    expect(isCanvasTextNodeReference(reference)).toBe(false);
  });
});

describe('referenceToFileChange', () => {
  it('should use full original for a regular reference cache', () => {
    const reference = makeReferenceCache('[[link]]', 10);
    const change = referenceToFileChange(reference, '[[new]]');
    expect(change.oldContent).toBe('[[link]]');
    expect(change.newContent).toBe('[[new]]');
    expect(change.reference).toBe(reference);
  });

  it('should use full original for a frontmatter link without offsets', () => {
    const reference = makeFrontmatterLink('link', 'aliases');
    const change = referenceToFileChange(reference, 'new');
    expect(change.oldContent).toBe('link');
    expect(change.newContent).toBe('new');
  });

  it('should slice original using offsets for frontmatter link with offsets', () => {
    const reference = makeFrontmatterLinkWithOffsets('hello world', 'aliases', 6, 11);
    const change = referenceToFileChange(reference, 'replaced');
    expect(change.oldContent).toBe('world');
    expect(change.newContent).toBe('replaced');
  });
});

describe('sortReferences', () => {
  it('should sort reference caches by position offset', () => {
    const reference1 = makeReferenceCache('[[a]]', 50);
    const reference2 = makeReferenceCache('[[b]]', 10);
    const reference3 = makeReferenceCache('[[c]]', 30);
    const sorted = sortReferences([reference1, reference2, reference3]);
    expect(sorted).toEqual([reference2, reference3, reference1]);
  });

  it('should sort frontmatter links by key', () => {
    const reference1 = makeFrontmatterLink('link1', 'beta');
    const reference2 = makeFrontmatterLink('link2', 'alpha');
    const sorted = sortReferences([reference1, reference2]);
    expect(sorted).toEqual([reference2, reference1]);
  });

  it('should place frontmatter links after reference caches', () => {
    const referenceCache = makeReferenceCache('[[link]]', 0);
    const fmLink = makeFrontmatterLink('link', 'aliases');
    const sorted = sortReferences([fmLink, referenceCache]);
    expect(sorted).toEqual([referenceCache, fmLink]);
  });

  it('should sort frontmatter links with offsets before those without for same key', () => {
    const withOffsets = makeFrontmatterLinkWithOffsets('link', 'aliases', 0, 4);
    const withoutOffsets = makeFrontmatterLink('link', 'aliases');
    const sorted = sortReferences([withoutOffsets, withOffsets]);
    expect(sorted).toEqual([withOffsets, withoutOffsets]);
  });

  it('should sort two frontmatter links without offsets by key only', () => {
    const fm1 = makeFrontmatterLink('link1', 'aliases');
    const fm2 = makeFrontmatterLink('link2', 'aliases');
    const sorted = sortReferences([fm1, fm2]);
    expect(sorted[0]).toBe(fm1);
    expect(sorted[1]).toBe(fm2);
  });

  it('should handle empty array', () => {
    expect(sortReferences([])).toEqual([]);
  });

  it('should handle mixed reference types', () => {
    const reference1 = makeReferenceCache('[[a]]', 100);
    const reference2 = makeReferenceCache('[[b]]', 50);
    const fm1 = makeFrontmatterLink('link1', 'z');
    const fm2 = makeFrontmatterLink('link2', 'a');
    const sorted = sortReferences([fm1, reference1, fm2, reference2]);
    expect(sorted[0]).toBe(reference2);
    expect(sorted[1]).toBe(reference1);
    expect(sorted[2]).toBe(fm2);
    expect(sorted[3]).toBe(fm1);
  });
});
