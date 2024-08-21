/** Importer for markdown documents. */
import type { InlineField } from "../data-import/inline-field.d.ts";
import type { ListItem, PageMetadata } from "../data-model/markdown.d.ts";
import type { Literal, Link } from "../data-model/value.d.ts";
import type { CachedMetadata, FileStats, FrontMatterCache, HeadingCache } from "obsidian";
/** Extract markdown metadata from the given Obsidian markdown file. */
export declare function parsePage(path: string, contents: string, stat: FileStats, metadata: CachedMetadata): PageMetadata;
/** Extract tags intelligently from frontmatter. Handles arrays, numbers, and strings. */
export declare function extractTags(metadata: FrontMatterCache): string[];
/** Extract aliases intelligently from frontmatter. Handles arrays, numbers, and strings.  */
export declare function extractAliases(metadata: FrontMatterCache): string[];
/** Split a frontmatter list into separate elements; handles actual lists, comma separated lists, and single elements. */
export declare function splitFrontmatterTagOrAlias(data: any, on: RegExp): string[];
/** Parse raw (newline-delimited) markdown, returning inline fields, list items, and other metadata. */
export declare function parseMarkdown(path: string, contents: string[], metadata: CachedMetadata, linksByLine: Record<number, Link[]>): {
    fields: Map<string, Literal[]>;
    lists: ListItem[];
};
export declare const LIST_ITEM_REGEX: RegExp;
/**
 * Parse list items from the page + metadata. This requires some additional parsing above whatever Obsidian provides,
 * since Obsidian only gives line numbers.
 */
export declare function parseLists(path: string, content: string[], metadata: CachedMetadata, linksByLine: Record<number, Link[]>): [ListItem[], Map<string, Literal[]>];
/** Recursively convert frontmatter into fields. We have to dance around YAML structure. */
export declare function parseFrontmatter(value: any): Literal;
/** Add a parsed inline field to the output map. */
export declare function addRawInlineField(field: InlineField, output: Map<string, Literal[]>): void;
/** Add a raw inline field to an output map, canonicalizing as needed. */
export declare function addInlineField(key: string, value: Literal, output: Map<string, Literal[]>): void;
/** Given a raw list of inline field values, add normalized keys and squash them. */
export declare function finalizeInlineFields(fields: Map<string, Literal[]>): Map<string, Literal>;
/** Copy all fields of 'source' into 'target'. */
export declare function mergeFieldGroups(target: Map<string, Literal[]>, source: Map<string, Literal[]>): void;
/** Find the header that is most immediately above the given line number. */
export declare function findPreviousHeader(line: number, headers: HeadingCache[]): string | undefined;
