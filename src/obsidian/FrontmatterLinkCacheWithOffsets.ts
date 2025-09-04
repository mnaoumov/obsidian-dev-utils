/**
 * @packageDocumentation
 *
 * This module provides a type for frontmatter link cache with offsets.
 */

import type {
  FrontmatterLinkCache,
  Reference
} from 'obsidian';

import { isFrontmatterLinkCache } from 'obsidian-typings/implementations';

/**
 * Type for frontmatter link cache with offsets.
 */
export interface FrontmatterLinkCacheWithOffsets extends FrontmatterLinkCache {
  /**
   * An end offset of the link in the property value.
   */
  endOffset: number;

  /**
   * A start offset of the link in the property value.
   */
  startOffset: number;
}

/**
 * Checks if the reference is a frontmatter link cache with offsets.
 *
 * @param reference - The reference to check.
 * @returns Whether the reference is a frontmatter link cache with offsets.
 */
export function isFrontmatterLinkCacheWithOffsets(reference: Reference): reference is FrontmatterLinkCacheWithOffsets {
  if (!isFrontmatterLinkCache(reference)) {
    return false;
  }

  const frontmatterLinkCacheWithOffsets = reference as Partial<FrontmatterLinkCacheWithOffsets>;
  return frontmatterLinkCacheWithOffsets.startOffset !== undefined && frontmatterLinkCacheWithOffsets.endOffset !== undefined;
}

/**
 * Converts a frontmatter link cache to a frontmatter link cache with offsets.
 *
 * @param reference - The reference to convert.
 * @returns The converted reference.
 */
export function toFrontmatterLinkCacheWithOffsets(reference: FrontmatterLinkCache): FrontmatterLinkCacheWithOffsets {
  if (isFrontmatterLinkCacheWithOffsets(reference)) {
    return reference;
  }

  return {
    ...reference,
    endOffset: reference.original.length,
    startOffset: 0
  };
}
