import type { DateTime } from 'luxon';
import type { Pos } from 'obsidian';
import type { FullIndex } from '../data-index/index.d.ts';
import type {
  SListItem,
  SMarkdownPage
} from '../data-model/serialized/markdown.d.ts';
import type {
  Link,
  Literal
} from '../data-model/value.d.ts';
import type { DataObject } from '../index.d.ts';
/** All extracted markdown file metadata obtained from a file. */
export declare class PageMetadata {
  /** The path this file exists at. */
  path: string;
  /** Obsidian-provided date this page was created. */
  ctime: DateTime;
  /** Obsidian-provided date this page was modified. */
  mtime: DateTime;
  /** Obsidian-provided size of this page in bytes. */
  size: number;
  /** The day associated with this page, if relevant. */
  day?: DateTime;
  /** The first H1/H2 header in the file. May not exist. */
  title?: string;
  /** All of the fields contained in this markdown file - both frontmatter AND in-file links. */
  fields: Map<string, Literal>;
  /** All of the exact tags (prefixed with '#') in this file overall. */
  tags: Set<string>;
  /** All of the aliases defined for this file. */
  aliases: Set<string>;
  /** All OUTGOING links (including embeds, header + block links) in this file. */
  links: Link[];
  /** All list items contained within this page. Filter for tasks to get just tasks. */
  lists: ListItem[];
  /** The raw frontmatter for this document. */
  frontmatter: Record<string, Literal>;
  constructor(path: string, init?: Partial<PageMetadata>);
  /** Canonicalize raw links and other data in partial data with normalizers, returning a completed object. */
  static canonicalize(data: Partial<PageMetadata>, linkNormalizer: (link: Link) => Link): PageMetadata;
  /** The name (based on path) of this file. */
  name(): string;
  /** The containing folder (based on path) of this file. */
  folder(): string;
  /** The extension of this file (likely 'md'). */
  extension(): string;
  /** Return a set of tags AND all of their parent tags (so #hello/yes would become #hello, #hello/yes). */
  fullTags(): Set<string>;
  /** Convert all links in this file to file links. */
  fileLinks(): Link[];
  /** Map this metadata to a full object; uses the index for additional data lookups.  */
  serialize(index: FullIndex, cache?: ListSerializationCache): SMarkdownPage;
}
/** A list item inside of a list. */
export declare class ListItem {
  /** The symbol ('*', '-', '1.') used to define this list item. */
  symbol: string;
  /** A link which points to this task, or to the closest block that this task is contained in. */
  link: Link;
  /** A link to the section that contains this list element; could be a file if this is not in a section. */
  section: Link;
  /** The text of this list item. This may be multiple lines of markdown. */
  text: string;
  /** The line that this list item starts on in the file. */
  line: number;
  /** The number of lines that define this list item. */
  lineCount: number;
  /** The line number for the first list item in the list this item belongs to. */
  list: number;
  /** Any links contained within this list item. */
  links: Link[];
  /** The tags contained within this list item. */
  tags: Set<string>;
  /** The raw Obsidian-provided position for where this task is. */
  position: Pos;
  /** The line number of the parent list item, if present; if this is undefined, this is a root item. */
  parent?: number;
  /** The line numbers of children of this list item. */
  children: number[];
  /** The block ID for this item, if one is present. */
  blockId?: string;
  /** Any fields defined in this list item. For tasks, this includes fields underneath the task. */
  fields: Map<string, Literal[]>;
  task?: {
    /** The text in between the brackets of the '[ ]' task indicator ('[X]' would yield 'X', for example.) */
    status: string;
    /** Whether or not this task has been checked in any way (it's status is not empty/space). */
    checked: boolean;
    /** Whether or not this task was completed; derived from 'status' by checking if the field 'X' or 'x'. */
    completed: boolean;
    /** Whether or not this task and all of it's subtasks are completed. */
    fullyCompleted: boolean;
  };
  constructor(init?: Partial<ListItem>);
  id(): string;
  file(): Link;
  markdown(): string;
  created(): Literal | undefined;
  due(): Literal | undefined;
  completed(): Literal | undefined;
  start(): Literal | undefined;
  scheduled(): Literal | undefined;
  /** Create an API-friendly copy of this list item. De-duplication is done via the provided cache. */
  serialize(cache: ListSerializationCache): SListItem;
}
/** De-duplicates list items across section metadata and page metadata. */
export declare class ListSerializationCache {
  listItems: Record<number, ListItem>;
  cache: Record<number, SListItem>;
  seen: Set<number>;
  constructor(listItems: ListItem[]);
  get(lineno: number): SListItem | undefined;
}
export declare function addFields(fields: Map<string, Literal[]>, target: DataObject): DataObject;
