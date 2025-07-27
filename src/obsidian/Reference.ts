/**
 * @packageDocumentation
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
} from 'obsidian-typings/implementations';

import type { FileChange } from './FileChange.ts';

import { isFrontmatterLinkCacheWithOffsets } from './FrontmatterLinkCacheWithOffsets.ts';

/**
 * Represents a reference within a file node in a canvas.
 */
export interface CanvasFileNodeReference extends CanvasReference {
  /**
   * The type of reference.
   */
  type: 'file';
}

/**
 * Represents a reference within a canvas.
 */
export interface CanvasReference extends FrontmatterLinkCache {
  /**
   * Whether the reference is a canvas reference.
   */
  isCanvas: true;

  /**
   * The index of the node in the canvas.
   */
  nodeIndex: number;

  /**
   * The type of reference.
   */
  type: 'file' | 'text';
}

/**
 * Represents a reference within a text node in a canvas.
 */
export interface CanvasTextNodeReference extends CanvasReference {
  /**
   * The original reference.
   */
  originalReference: Reference;

  /**
   * The type of reference.
   */
  type: 'text';
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
 * Converts a reference to a file change.
 *
 * @param reference - The reference to convert.
 * @param newContent - The new content for the reference.
 * @returns The file change.
 */
export function referenceToFileChange(reference: Reference, newContent: string): FileChange {
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
      const bStartOffset = isFrontmatterLinkCacheWithOffsets(b) ? b.startOffset : 0;
      return a.key.localeCompare(b.key) || Number(isFrontmatterLinkCacheWithOffsets(b)) - Number(isFrontmatterLinkCacheWithOffsets(a))
        || aStartOffset - bStartOffset;
    }

    if (isReferenceCache(a) && isReferenceCache(b)) {
      return a.position.start.offset - b.position.start.offset;
    }

    return isFrontmatterLinkCache(a) ? 1 : -1;
  });
}
