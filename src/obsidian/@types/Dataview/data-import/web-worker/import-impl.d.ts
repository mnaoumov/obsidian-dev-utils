import type {
  CachedMetadata,
  FileStats
} from 'obsidian';
import type { PageMetadata } from '../../data-model/markdown.d.ts';
export declare function runImport(path: string, contents: string, stats: FileStats, metadata: CachedMetadata): Partial<PageMetadata>;
