/**
 * @file
 *
 * Contains utility functions for handling references in Obsidian.
 */

import type {
  FrontmatterLinkCache,
  Reference
} from 'obsidian';

import {
  isFrontmatterLinkCache,
  isReferenceCache
} from '@obsidian-typings/obsidian-public-latest/implementations';

import type { FileChange } from './file-change.ts';

import { isFrontmatterLinkCacheWithOffsets } from './frontmatter-link-cache-with-offsets.ts';

/**
 * A reference within a file node in a canvas.
 */
export interface CanvasFileNodeReference extends CanvasReference {
  /**
   * A type of reference.
   */
  type: 'file';
}

/**
 * A reference within a canvas.
 */
export interface CanvasReference extends FrontmatterLinkCache {
  /**
   * Whether the reference is a canvas reference.
   */
  isCanvas: true;

  /**
   * An index of the node in the canvas.
   */
  nodeIndex: number;

  /**
   * A type of reference.
   */
  type: 'file' | 'text';
}

/**
 * A reference within a text node in a canvas.
 */
export interface CanvasTextNodeReference extends CanvasReference {
  /**
   * An original reference.
   */
  originalReference: Reference;

  /**
   * A type of reference.
   */
  type: 'text';
}

/**
 * A range within a file's content, expressed in character offsets.
 *
 * Both bounds are inclusive: a reference whose own offsets coincide exactly with
 * {@link OffsetRange.startOffset} / {@link OffsetRange.endOffset} is inside the range.
 */
export interface OffsetRange {
  /**
   * An end offset of the range within the file's content.
   */
  readonly endOffset: number;

  /**
   * A start offset of the range within the file's content.
   */
  readonly startOffset: number;
}

/**
 * Checks if a reference is a canvas file node reference.
 *
 * @param reference - The reference to check.
 * @returns Whether the reference is a canvas file node reference.
 */
export function isCanvasFileNodeReference(reference: Reference): reference is CanvasFileNodeReference {
  return isCanvasReference(reference) && reference.type === 'file';
}

/**
 * Checks if a reference is a canvas reference.
 *
 * @param reference - The reference to check.
 * @returns Whether the reference is a canvas reference.
 */
export function isCanvasReference(reference: Reference): reference is CanvasReference {
  return isFrontmatterLinkCache(reference) && !!(reference as Partial<CanvasReference>).isCanvas;
}

/**
 * Checks if a reference is a canvas text node reference.
 *
 * @param reference - The reference to check.
 * @returns Whether the reference is a canvas text node reference.
 */
export function isCanvasTextNodeReference(reference: Reference): reference is CanvasTextNodeReference {
  return isCanvasReference(reference) && reference.type === 'text';
}

/**
 * Checks if a reference is fully contained within an offset range.
 *
 * Only a reference that carries a position within the file's content can be in a range. A
 * {@link FrontmatterLinkCache} — a frontmatter link, a multi-link frontmatter value entry, or any canvas
 * reference — carries no such position and is therefore never in range. Its `startOffset` / `endOffset`,
 * where present, locate the link within its own property value rather than within the file, so they are
 * deliberately not compared against the range.
 *
 * Containment is full and both bounds are inclusive: a reference that only partially overlaps the range is
 * not in it, because rewriting part of a link corrupts it.
 *
 * @param reference - The reference to check.
 * @param offsetRange - The offset range to check against.
 * @returns Whether the reference is fully contained within the offset range.
 */
export function isReferenceInOffsetRange(reference: Reference, offsetRange: OffsetRange): boolean {
  if (!isReferenceCache(reference)) {
    return false;
  }

  return offsetRange.startOffset <= reference.position.start.offset && reference.position.end.offset <= offsetRange.endOffset;
}

/**
 * Converts a reference to a file change.
 *
 * @param reference - The reference to convert.
 * @param newContent - The new content for the reference.
 * @returns The file change.
 */
export function referenceToFileChange(reference: Reference, newContent: string): FileChange {
  if (isFrontmatterLinkCacheWithOffsets(reference)) {
    return {
      newContent,
      oldContent: reference.original.slice(reference.startOffset, reference.endOffset),
      reference
    };
  }

  return {
    newContent,
    oldContent: reference.original,
    reference
  };
}

/**
 * Sorts references by their type and position.
 *
 * @param references - The references to sort.
 * @returns The sorted references.
 */
export function sortReferences(references: Reference[]): Reference[] {
  return references.sort((a, b) => {
    if (isFrontmatterLinkCache(a) && isFrontmatterLinkCache(b)) {
      const aStartOffset = isFrontmatterLinkCacheWithOffsets(a) ? a.startOffset : 0;
      /* v8 ignore start -- v8 incorrectly reports this branch as uncovered, but it is covered by `should sort two frontmatter links without offsets` test. */
      const bStartOffset = isFrontmatterLinkCacheWithOffsets(b) ? b.startOffset : 0;
      /* v8 ignore stop */
      return a.key.localeCompare(b.key) || Number(isFrontmatterLinkCacheWithOffsets(b)) - Number(isFrontmatterLinkCacheWithOffsets(a))
        || aStartOffset - bStartOffset;
    }

    if (isReferenceCache(a) && isReferenceCache(b)) {
      return a.position.start.offset - b.position.start.offset;
    }

    return isFrontmatterLinkCache(a) ? 1 : -1;
  });
}
