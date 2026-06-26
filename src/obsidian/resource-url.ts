/**
 * @file
 *
 * This module provides utility functions for working with resource URLs in Obsidian.
 */

import type { App } from 'obsidian';

import { getDataAdapterEx } from '@obsidian-typings/obsidian-public-latest/implementations';
import { Platform } from 'obsidian';

import { toPosixPath } from '../path.ts';

/**
 * Parameters for {@link relativePathToResourceUrl}.
 */
export interface RelativePathToResourceUrlParams {
  /**
   * The Obsidian application instance.
   */
  readonly app: App;

  /**
   * The path of the note.
   */
  readonly notePath: string;

  /**
   * The relative path to the resource.
   */
  readonly relativePath: string;
}

/**
 * Converts a relative path to a resource URL.
 *
 * @param params - The parameters for the conversion.
 * @returns The resource URL.
 */
export function relativePathToResourceUrl(params: RelativePathToResourceUrlParams): string {
  const {
    app,
    notePath,
    relativePath
  } = params;
  const noteFullPath = toPosixPath(getDataAdapterEx(app).getFullRealPath(notePath));
  const noteUrl = `${Platform.resourcePathPrefix}${noteFullPath}`;
  const relativeUrl = new URL(relativePath, noteUrl);
  return String(relativeUrl);
}
