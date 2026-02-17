import type { Reference } from 'obsidian';

import {
  describe,
  expect,
  it
} from 'vitest';

import { castTo } from '../../src/ObjectUtils.ts';
import {
  isCanvasFileNodeReference,
  isCanvasReference,
  isCanvasTextNodeReference,
  referenceToFileChange,
  sortReferences
} from '../../src/obsidian/Reference.ts';

function makeCanvasReference(type: 'file' | 'text', key: string): Reference {
  return castTo<Reference>({
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
  return castTo<Reference>({
    displayText: original,
    key,
    link: original,
    original
  });
}

function makeFrontmatterLinkWithOffsets(original: string, key: string, startOffset: number, endOffset: number): Reference {
  return castTo<Reference>({
    displayText: original,
    endOffset,
    key,
    link: original,
    original,
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
    const ref = makeCanvasReference('file', 'k');
    expect(isCanvasReference(ref)).toBe(true);
  });

  it('should return false for a regular reference cache', () => {
    const ref = makeReferenceCache('[[link]]', 0);
    expect(isCanvasReference(ref)).toBe(false);
  });

  it('should return false for a frontmatter link without isCanvas', () => {
    const ref = makeFrontmatterLink('link', 'aliases');
    expect(isCanvasReference(ref)).toBe(false);
  });
});

describe('isCanvasFileNodeReference', () => {
  it('should return true for a canvas file node reference', () => {
    const ref = makeCanvasReference('file', 'k');
    expect(isCanvasFileNodeReference(ref)).toBe(true);
  });

  it('should return false for a canvas text node reference', () => {
    const ref = makeCanvasReference('text', 'k');
    expect(isCanvasFileNodeReference(ref)).toBe(false);
  });

  it('should return false for a regular reference', () => {
    const ref = makeReferenceCache('[[link]]', 0);
    expect(isCanvasFileNodeReference(ref)).toBe(false);
  });
});

describe('isCanvasTextNodeReference', () => {
  it('should return true for a canvas text node reference', () => {
    const ref = makeCanvasReference('text', 'k');
    expect(isCanvasTextNodeReference(ref)).toBe(true);
  });

  it('should return false for a canvas file node reference', () => {
    const ref = makeCanvasReference('file', 'k');
    expect(isCanvasTextNodeReference(ref)).toBe(false);
  });

  it('should return false for a regular reference', () => {
    const ref = makeReferenceCache('[[link]]', 0);
    expect(isCanvasTextNodeReference(ref)).toBe(false);
  });
});

describe('referenceToFileChange', () => {
  it('should use full original for a regular reference cache', () => {
    const ref = makeReferenceCache('[[link]]', 10);
    const change = referenceToFileChange(ref, '[[new]]');
    expect(change.oldContent).toBe('[[link]]');
    expect(change.newContent).toBe('[[new]]');
    expect(change.reference).toBe(ref);
  });

  it('should use full original for a frontmatter link without offsets', () => {
    const ref = makeFrontmatterLink('link', 'aliases');
    const change = referenceToFileChange(ref, 'new');
    expect(change.oldContent).toBe('link');
    expect(change.newContent).toBe('new');
  });

  it('should slice original using offsets for frontmatter link with offsets', () => {
    const ref = makeFrontmatterLinkWithOffsets('hello world', 'aliases', 6, 11);
    const change = referenceToFileChange(ref, 'replaced');
    expect(change.oldContent).toBe('world');
    expect(change.newContent).toBe('replaced');
  });
});

describe('sortReferences', () => {
  it('should sort reference caches by position offset', () => {
    const ref1 = makeReferenceCache('[[a]]', 50);
    const ref2 = makeReferenceCache('[[b]]', 10);
    const ref3 = makeReferenceCache('[[c]]', 30);
    const sorted = sortReferences([ref1, ref2, ref3]);
    expect(sorted).toEqual([ref2, ref3, ref1]);
  });

  it('should sort frontmatter links by key', () => {
    const ref1 = makeFrontmatterLink('link1', 'beta');
    const ref2 = makeFrontmatterLink('link2', 'alpha');
    const sorted = sortReferences([ref1, ref2]);
    expect(sorted).toEqual([ref2, ref1]);
  });

  it('should place frontmatter links after reference caches', () => {
    const refCache = makeReferenceCache('[[link]]', 0);
    const fmLink = makeFrontmatterLink('link', 'aliases');
    const sorted = sortReferences([fmLink, refCache]);
    expect(sorted).toEqual([refCache, fmLink]);
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
    const ref1 = makeReferenceCache('[[a]]', 100);
    const ref2 = makeReferenceCache('[[b]]', 50);
    const fm1 = makeFrontmatterLink('link1', 'z');
    const fm2 = makeFrontmatterLink('link2', 'a');
    const sorted = sortReferences([fm1, ref1, fm2, ref2]);
    expect(sorted[0]).toBe(ref2);
    expect(sorted[1]).toBe(ref1);
    expect(sorted[2]).toBe(fm2);
    expect(sorted[3]).toBe(fm1);
  });
});
