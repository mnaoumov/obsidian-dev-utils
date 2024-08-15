import {
  type App,
  Platform
} from "obsidian";
import { toPosixPath } from "../Path.ts";

export function relativePathToResourceUrl(app: App, relativePath: string, notePath: string): string {
  const noteFullPath = toPosixPath(app.vault.adapter.getFullRealPath(notePath));
  const noteUrl = `${Platform.resourcePathPrefix}${noteFullPath}`;
  const relativeUrl = new URL(relativePath, noteUrl);
  return relativeUrl.toString();
}
