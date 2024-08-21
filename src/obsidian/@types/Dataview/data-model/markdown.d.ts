import type { DateTime } from "luxon";
import type { FullIndex } from "../data-index/index.d.ts";
import type { Literal,
  Link } from "../data-model/value.d.ts";
import type { DataObject } from "../index.d.ts";
import type { SListItem,
  SMarkdownPage } from "../data-model/serialized/markdown.d.ts";
import type { Pos } from "obsidian";
/** All extracted markdown file metadata obtained from a file. */
export declare class PageMetadata {
  /** The path this file exists at. */
  public path: string;
  /** Obsidian-provided date this page was created. */
  public ctime: DateTime;
  /** Obsidian-provided date this page was modified. */
  public mtime: DateTime;
  /** Obsidian-provided size of this page in bytes. */
  public size: number;
  /** The day associated with this page, if relevant. */
  public day?: DateTime;
  /** The first H1/H2 header in the file. May not exist. */
  public title?: string;
  /** All of the fields contained in this markdown file - both frontmatter AND in-file links. */
  public fields: Map<string, Literal>;
  /** All of the exact tags (prefixed with '#') in this file overall. */
  public tags: Set<string>;
  /** All of the aliases defined for this file. */
  public aliases: Set<string>;
  /** All OUTGOING links (including embeds, header + block links) in this file. */
  public links: Link[];
  /** All list items contained within this page. Filter for tasks to get just tasks. */
  public lists: ListItem[];
  /** The raw frontmatter for this document. */
  public frontmatter: Record<string, Literal>;
  public constructor(path: string, init?: Partial<PageMetadata>);
  /** Canonicalize raw links and other data in partial data with normalizers, returning a completed object. */
  public static canonicalize(data: Partial<PageMetadata>, linkNormalizer: (link: Link) => Link): PageMetadata;
  /** The name (based on path) of this file. */
  public name(): string;
  /** The containing folder (based on path) of this file. */
  public folder(): string;
  /** The extension of this file (likely 'md'). */
  public extension(): string;
  /** Return a set of tags AND all of their parent tags (so #hello/yes would become #hello, #hello/yes). */
  public fullTags(): Set<string>;
  /** Convert all links in this file to file links. */
  public fileLinks(): Link[];
  /** Map this metadata to a full object; uses the index for additional data lookups.  */
  public serialize(index: FullIndex, cache?: ListSerializationCache): SMarkdownPage;
}
/** A list item inside of a list. */
export declare class ListItem {
  /** The symbol ('*', '-', '1.') used to define this list item. */
  public symbol: string;
  /** A link which points to this task, or to the closest block that this task is contained in. */
  public link: Link;
  /** A link to the section that contains this list element; could be a file if this is not in a section. */
  public section: Link;
  /** The text of this list item. This may be multiple lines of markdown. */
  public text: string;
  /** The line that this list item starts on in the file. */
  public line: number;
  /** The number of lines that define this list item. */
  public lineCount: number;
  /** The line number for the first list item in the list this item belongs to. */
  public list: number;
  /** Any links contained within this list item. */
  public links: Link[];
  /** The tags contained within this list item. */
  public tags: Set<string>;
  /** The raw Obsidian-provided position for where this task is. */
  public position: Pos;
  /** The line number of the parent list item, if present; if this is undefined, this is a root item. */
  public parent?: number;
  /** The line numbers of children of this list item. */
  public children: number[];
  /** The block ID for this item, if one is present. */
  public blockId?: string;
  /** Any fields defined in this list item. For tasks, this includes fields underneath the task. */
  public fields: Map<string, Literal[]>;
  public task?: {
    /** The text in between the brackets of the '[ ]' task indicator ('[X]' would yield 'X', for example.) */
    status: string;
    /** Whether or not this task has been checked in any way (it's status is not empty/space). */
    checked: boolean;
    /** Whether or not this task was completed; derived from 'status' by checking if the field 'X' or 'x'. */
    completed: boolean;
    /** Whether or not this task and all of it's subtasks are completed. */
    fullyCompleted: boolean;
  };
  public constructor(init?: Partial<ListItem>);
  public id(): string;
  public file(): Link;
  public markdown(): string;
  public created(): Literal | undefined;
  public due(): Literal | undefined;
  public completed(): Literal | undefined;
  public start(): Literal | undefined;
  public scheduled(): Literal | undefined;
  /** Create an API-friendly copy of this list item. De-duplication is done via the provided cache. */
  public serialize(cache: ListSerializationCache): SListItem;
}
/** De-duplicates list items across section metadata and page metadata. */
export declare class ListSerializationCache {
  public listItems: Record<number, ListItem>;
  public cache: Record<number, SListItem>;
  public seen: Set<number>;
  public constructor(listItems: ListItem[]);
  public get(lineno: number): SListItem | undefined;
}
export declare function addFields(fields: Map<string, Literal[]>, target: DataObject): DataObject;
