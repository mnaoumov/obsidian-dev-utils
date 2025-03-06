/**
 * @packageDocumentation Reference
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

import type {
  CanvasFileNodeChange,
  CanvasTextNodeChange,
  ContentChange,
  FileChange,
  FrontmatterChange
} from './FileChange.ts';

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
   * The index of the link in the node.
   */
  linkIndex: number;

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
  if (isReferenceCache(reference)) {
    return {
      endIndex: reference.position.end.offset,
      newContent,
      oldContent: reference.original,
      startIndex: reference.position.start.offset
    } as ContentChange;
  }

  if (isCanvasFileNodeReference(reference)) {
    return {
      newContent,
      nodeIndex: reference.nodeIndex,
      oldContent: reference.original,
      type: 'file'
    } as CanvasFileNodeChange;
  }

  if (isCanvasTextNodeReference(reference)) {
    return {
      linkIndex: reference.linkIndex,
      newContent,
      oldContent: reference.original,
      type: 'text'
    } as CanvasTextNodeChange;
  }

  if (isFrontmatterLinkCache(reference)) {
    return {
      frontmatterKey: reference.key,
      newContent,
      oldContent: reference.original
    } as FrontmatterChange;
  }

  throw new Error('Unknown link type');
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
      return a.key.localeCompare(b.key);
    }

    if (isReferenceCache(a) && isReferenceCache(b)) {
      return a.position.start.offset - b.position.start.offset;
    }

    return isFrontmatterLinkCache(a) ? 1 : -1;
  });
}
