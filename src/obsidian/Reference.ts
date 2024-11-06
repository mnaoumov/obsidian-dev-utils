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
      startIndex: reference.position.start.offset,
      endIndex: reference.position.end.offset,
      oldContent: reference.original,
      newContent
    } as ContentChange;
  } else if (isFrontmatterLinkCache(reference)) {
    return {
      oldContent: reference.original,
      newContent,
      frontMatterKey: reference.key
    } as FrontmatterChange;
  }

  throw new Error('Unknown link type');
}
