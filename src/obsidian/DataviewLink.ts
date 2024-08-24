/**
 * @packageDocumentation DataviewLink
 * This module provides utility functions for working with Dataview links in Obsidian
 */

import { dirname } from "path";
import {
  basename,
  extname
} from "../Path.ts";
import type {
  DataviewInlineApi,
  Link
} from "./Dataview.ts";
import type { PathOrFile } from "./TFile.ts";
import { getPath } from "./TAbstractFile.ts";

/**
 * Fixes the title of a file or folder note by generating a `Link` object with a proper title.
 *
 * @function fixTitle
 * @param {DataviewInlineApi} dv - The DataviewInlineApi instance used to create the file link.
 * @param {PathOrFile} pathOrFile - The file path for which the title is to be fixed.
 * @param {boolean} [isFolderNote=false] - A boolean indicating whether the file is a folder note.
 * If true, the title is derived from the folder name. Defaults to `false`.
 * @returns {Link} A Link object with the corrected title.
 */
export function fixTitle(dv: DataviewInlineApi, pathOrFile: PathOrFile, isFolderNote?: boolean): Link {
  const path = getPath(pathOrFile);
  const ext = extname(path);
  const title = isFolderNote ? basename(dirname(path)) : basename(path, ext);
  return dv.fileLink(path, false, title);
}

/**
 * Generates a string representation of a `Link` object that includes both the link text and the file path.
 *
 * @function makeLinkWithPath
 * @param {Link} link - The Link object to be converted to a string with its path.
 * @returns {string} A string representing the link in the format: "linkText (linkPath)".
 */
export function makeLinkWithPath(link: Link): string {
  return `${link.toString()} (${link.path})`;
}
