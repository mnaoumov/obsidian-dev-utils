import type { PageMetadata } from "../../data-model/markdown.d.ts";
import type { CachedMetadata, FileStats } from "obsidian";
export declare function runImport(path: string, contents: string, stats: FileStats, metadata: CachedMetadata): Partial<PageMetadata>;
