/**
 * @packageDocumentation Reference
 * Contains utility functions for handling references in Obsidian.
 */

import type { Reference } from 'obsidian';

import {
  isFrontmatterLinkCache,
  isReferenceCache
} from 'obsidian-typings/implementations';

import type {
  ContentChange,
  FileChange,
  FrontmatterChange
} from './FileChange.ts';

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
