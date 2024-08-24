/**
 * @packageDocumentation ResourceUrl
 * This module provides utility functions for working with resource URLs in Obsidian.
 */

import {
  type App,
  Platform
} from "obsidian";
import { toPosixPath } from "../Path.ts";

/**
 * Converts a relative path to a resource URL.
 *
 * @param app - The Obsidian application instance.
 * @param relativePath - The relative path to the resource.
 * @param notePath - The path of the note.
 * @returns The resource URL.
 */
export function relativePathToResourceUrl(app: App, relativePath: string, notePath: string): string {
  const noteFullPath = toPosixPath(app.vault.adapter.getFullRealPath(notePath));
  const noteUrl = `${Platform.resourcePathPrefix}${noteFullPath}`;
  const relativeUrl = new URL(relativePath, noteUrl);
  return relativeUrl.toString();
}
