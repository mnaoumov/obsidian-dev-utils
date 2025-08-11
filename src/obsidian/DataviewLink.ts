/**
 * @packageDocumentation
 *
 * This module provides utility functions for working with Dataview links in Obsidian
 */

import type {
  DataviewInlineApi,
  Link
} from './Dataview.ts';
import type { PathOrFile } from './FileSystem.ts';

import {
  basename,
  dirname,
  extname
} from '../Path.ts';
import { getPath } from './FileSystem.ts';

/**
 * Fixes the title of a file or folder note by generating a {@link Link} object with a proper title.
 *
 * @param dv - The DataviewInlineApi instance used to create the file link.
 * @param pathOrFile - The file path for which the title is to be fixed.
 * @param isFolderNote - A boolean indicating whether the file is a folder note. Defaults to `false`.
 * If true, the title is derived from the folder name. Defaults to `false`.
 * @returns A Link object with the corrected title.
 */
export function fixTitle(dv: DataviewInlineApi, pathOrFile: PathOrFile, isFolderNote?: boolean): Link {
  const path = getPath(dv.app, pathOrFile);
  const ext = extname(path);
  const title = isFolderNote ? basename(dirname(path)) : basename(path, ext);
  return dv.fileLink(path, false, title);
}

/**
 * Generates a string representation of a {@link Link} object that includes both the link text and the file path.
 *
 * @param link - The Link object to be converted to a string with its path.
 * @returns A string representing the link in the format: "linkText (linkPath)".
 */
export function makeLinkWithPath(link: Link): string {
  return `${String(link)} (${link.path})`;
}
