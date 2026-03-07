import type { CachedMetadata } from 'obsidian';

import type { TFile } from './t-file.ts';

import { Events } from './events.ts';

export class MetadataCache extends Events {
  public resolvedLinks: Record<string, Record<string, number>> = {};
  public unresolvedLinks: Record<string, Record<string, number>> = {};

  public fileToLinktext(file: TFile, _sourcePath: string, _omitMdExtension?: boolean): string {
    return file.basename;
  }

  public getCache(_path: string): CachedMetadata | null {
    return null;
  }

  public getFileCache(_file: TFile): CachedMetadata | null {
    return null;
  }

  public getFirstLinkpathDest(_linkpath: string, _sourcePath: string): null | TFile {
    return null;
  }
}
