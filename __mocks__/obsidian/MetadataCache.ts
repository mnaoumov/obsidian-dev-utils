import type { CachedMetadata } from 'obsidian';

import type { TFile } from './TFile.ts';

import { Events } from './Events.ts';

export class MetadataCache extends Events {
  resolvedLinks: Record<string, Record<string, number>> = {};
  unresolvedLinks: Record<string, Record<string, number>> = {};

  fileToLinktext(file: TFile, _sourcePath: string, _omitMdExtension?: boolean): string {
    return file.basename;
  }

  getCache(_path: string): CachedMetadata | null {
    return null;
  }

  getFileCache(_file: TFile): CachedMetadata | null {
    return null;
  }

  getFirstLinkpathDest(_linkpath: string, _sourcePath: string): null | TFile {
    return null;
  }
}
