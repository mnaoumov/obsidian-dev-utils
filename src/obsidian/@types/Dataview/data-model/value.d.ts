import type { DateTime,
  Duration } from "luxon";
import type { QuerySettings } from "../settings.d.ts";
/** Shorthand for a mapping from keys to values. */
export type DataObject = {
  [key: string]: Literal;
};
/** The literal types supported by the query engine. */
export type LiteralType = "boolean" | "number" | "string" | "date" | "duration" | "link" | "array" | "object" | "function" | "null" | "html" | "widget";
/** The raw values that a literal can take on. */
export type Literal = boolean | number | string | DateTime | Duration | Link | Array<Literal> | DataObject | Function | null | HTMLElement | Widget;
/** A grouping on a type which supports recursively-nested groups. */
export type GroupElement<T> = {
  key: Literal;
  rows: Grouping<T>;
};
export type Grouping<T> = T[] | GroupElement<T>[];
/** Maps the string type to it's external, API-facing representation. */
export type LiteralRepr<T extends LiteralType> = T extends "boolean" ? boolean : T extends "number" ? number : T extends "string" ? string : T extends "duration" ? Duration : T extends "date" ? DateTime : T extends "null" ? null : T extends "link" ? Link : T extends "array" ? Array<Literal> : T extends "object" ? Record<string, Literal> : T extends "function" ? Function : T extends "html" ? HTMLElement : T extends "widget" ? Widget : unknown;
/** A wrapped literal value which can be switched on. */
export type WrappedLiteral = LiteralWrapper<"string"> | LiteralWrapper<"number"> | LiteralWrapper<"boolean"> | LiteralWrapper<"date"> | LiteralWrapper<"duration"> | LiteralWrapper<"link"> | LiteralWrapper<"array"> | LiteralWrapper<"object"> | LiteralWrapper<"html"> | LiteralWrapper<"widget"> | LiteralWrapper<"function"> | LiteralWrapper<"null">;
export interface LiteralWrapper<T extends LiteralType> {
  type: T;
  value: LiteralRepr<T>;
}
export declare namespace Values {
  /** Convert an arbitrary value into a reasonable, Markdown-friendly string if possible. */
  function toString(field: unknown, setting?: QuerySettings, recursive?: boolean): string;
  /** Wrap a literal value so you can switch on it easily. */
  function wrapValue(val: Literal): WrappedLiteral | undefined;
  /** Recursively map complex objects at the leaves. */
  function mapLeaves(val: Literal, func: (t: Literal) => Literal): Literal;
  /** Compare two arbitrary JavaScript values. Produces a total ordering over ANY possible dataview value. */
  function compareValue(val1: Literal, val2: Literal, linkNormalizer?: (link: string) => string): number;
  /** Find the corresponding Dataview type for an arbitrary value. */
  function typeOf(val: unknown): LiteralType | undefined;
  /** Determine if the given value is "truthy" (i.e., is non-null and has data in it). */
  function isTruthy(field: Literal): boolean;
  /** Deep copy a field. */
  function deepCopy<T extends Literal>(field: T): T;
  function isString(val: unknown): val is string;
  function isNumber(val: unknown): val is number;
  function isDate(val: unknown): val is DateTime;
  function isDuration(val: unknown): val is Duration;
  function isNull(val: unknown): val is null | undefined;
  function isArray(val: unknown): val is unknown[];
  function isBoolean(val: unknown): val is boolean;
  function isLink(val: unknown): val is Link;
  function isWidget(val: unknown): val is Widget;
  function isHtml(val: unknown): val is HTMLElement;
  /** Checks if the given value is an object (and not unknown other dataview-recognized object-like type). */
  function isObject(val: unknown): val is Record<string, unknown>;
  function isFunction(val: unknown): val is Function;
}
export declare namespace Groupings {
  /** Determines if the given group entry is a standalone value, or a grouping of sub-entries. */
  function isElementGroup<T>(entry: T | GroupElement<T>): entry is GroupElement<T>;
  /** Determines if the given array is a grouping array. */
  function isGrouping<T>(entry: Grouping<T>): entry is GroupElement<T>[];
  /** Count the total number of elements in a recursive grouping. */
  function count<T>(elements: Grouping<T>): number;
}
/** The Obsidian 'link', used for uniquely describing a file, header, or block. */
export declare class Link {
  /** The file path this link points to. */
  public path: string;
  /** The display name associated with the link. */
  public display?: string;
  /** The block ID or header this link points to within a file, if relevant. */
  public subpath?: string;
  /** Is this link an embedded link (!)? */
  public embed: boolean;
  /** The type of this link, which determines what 'subpath' refers to, if anything. */
  public type: "file" | "header" | "block";
  /** Create a link to a specific file. */
  public static file(path: string, embed?: boolean, display?: string): Link;
  public static infer(linkpath: string, embed?: boolean, display?: string): Link;
  /** Create a link to a specific file and header in that file. */
  public static header(path: string, header: string, embed?: boolean, display?: string): Link;
  /** Create a link to a specific file and block in that file. */
  public static block(path: string, blockId: string, embed?: boolean, display?: string): Link;
  public static fromObject(object: Record<string, unknown>): Link;
  private constructor();
  /** Checks for link equality (i.e., that the links are pointing to the same exact location). */
  public equals(other: Link): boolean;
  /** Convert this link to it's markdown representation. */
  public toString(): string;
  /** Convert this link to a raw object which is serialization-friendly. */
  public toObject(): Record<string, unknown>;
  /** Update this link with a new path. */
  public withPath(path: string): unknown;
  /** Return a new link which points to the same location but with a new display value. */
  public withDisplay(display?: string): Link;
  /** Convert a file link into a link to a specific header. */
  public withHeader(header: string): Link;
  /** Convert any link into a link to its file. */
  public toFile(): Link;
  /** Convert this link into an embedded link. */
  public toEmbed(): Link;
  /** Convert this link into a non-embedded link. */
  public fromEmbed(): Link;
  /** Convert this link to markdown so it can be rendered. */
  public markdown(): string;
  /** Convert the inner part of the link to something that Obsidian can open / understand. */
  public obsidianLink(): string;
  /** The stripped name of the file this link points to. */
  public fileName(): string;
}
/**
 * A trivial base class which just defines the '$widget' identifier type. Subtypes of
 * widget are responsible for adding whatever metadata is relevant. If you want your widget
 * to have rendering functionality (which you probably do), you should extend `RenderWidget`.
 */
export declare abstract class Widget {
  $widget: string;
  public constructor($widget: string);
  /**
     * Attempt to render this widget in markdown, if possible; if markdown is not possible,
     * then this will attempt to render as HTML. Note that many widgets have interactive
     * components or difficult functional components and the `markdown` function can simply
     * return a placeholder in this case (such as `<function>` or `<task-list>`).
     */
  public abstract markdown(): string;
}
/** A trivial widget which renders a (key, value) pair, and allows accessing the key and value. */
export declare class ListPairWidget extends Widget {
  public key: Literal;
  public value: Literal;
  public constructor(key: Literal, value: Literal);
  public markdown(): string;
}
/** A simple widget which renders an external link. */
export declare class ExternalLinkWidget extends Widget {
  public url: string;
  public display?: string | undefined;
  public constructor(url: string, display?: string | undefined);
  public markdown(): string;
}
export declare namespace Widgets {
  /** Create a list pair widget matching the given key and value. */
  function listPair(key: Literal, value: Literal): ListPairWidget;
  /** Create an external link widget which renders an external Obsidian link. */
  function externalLink(url: string, display?: string): ExternalLinkWidget;
  /** Checks if the given widget is a list pair widget. */
  function isListPair(widget: Widget): widget is ListPairWidget;
  function isExternalLink(widget: Widget): widget is ExternalLinkWidget;
  /** Determines if the given widget is unknown kind of built-in widget with special rendering handling. */
  function isBuiltin(widget: Widget): boolean;
}
