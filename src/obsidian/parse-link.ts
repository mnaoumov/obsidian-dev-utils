/**
 * @file
 *
 * This module provides utilities for parsing markdown and wiki links into structured data, and for
 * escaping, unescaping, and encoding link components.
 */

import type { Link } from 'mdast';
import type {
  FrontmatterLinkCache,
  Loc,
  Reference,
  ReferenceCache
} from 'obsidian';
import type { Node } from 'unist';

import { remark } from 'remark';
import remarkParse from 'remark-parse';
import { wikiLinkPlugin } from 'remark-wiki-link';
import { visit } from 'unist-util-visit';

import { normalizeOptionalProperties } from '../object-utils.ts';
import { replaceAll } from '../string.ts';
import { ensureNonNullable } from '../type-guards.ts';
import {
  isFileUrl,
  isUrl
} from '../url.ts';

/**
 * Regular expression for special link symbols.
 */
// eslint-disable-next-line no-control-regex -- The regular expression is written to capture control characters.
const SPECIAL_LINK_SYMBOLS_REGEXP = /[\\\x00\x08\x0B\x0C\x0E-\x1F ]/g;

/**
 * Regular expression for special markdown link symbols.
 */
const SPECIAL_MARKDOWN_LINK_SYMBOLS_REGEX = /[\\[\]<>_*~=`$]/g;

const WIKILINK_DIVIDER = '|';

/**
 * A {@link FrontmatterLinkCache} for a link parsed from a single-link frontmatter value via
 * {@link parseLinks}. It carries the full {@link ParseLinkResult} so consumers can inspect the parse
 * details without re-parsing the link. Use this when the whole frontmatter value is a single link.
 */
export interface ParseLinkFrontmatterReference extends FrontmatterLinkCache {
  /**
   * The result of parsing the link.
   */
  readonly parseLinkResult: ParseLinkResult;
}

/**
 * A {@link ParseLinkFrontmatterReference} for a link parsed from a multi-link frontmatter value via
 * {@link parseLinks}, additionally carrying the offsets of the link within the frontmatter value. Use
 * this when the frontmatter value holds multiple links.
 */
export interface ParseLinkFrontmatterReferenceWithOffsets extends ParseLinkFrontmatterReference {
  /**
   * An end offset of the link in the frontmatter value.
   */
  endOffset: number;

  /**
   * A start offset of the link in the frontmatter value.
   */
  startOffset: number;
}

/**
 * A {@link ReferenceCache} for a link parsed from content via {@link parseLinks}. It carries the full
 * {@link ParseLinkResult} so consumers can inspect the parse details without re-parsing the link.
 */
export interface ParseLinkReference extends ReferenceCache {
  /**
   * The result of parsing the link.
   */
  readonly parseLinkResult: ParseLinkResult;
}

/**
 * A result of parsing a link.
 */
export interface ParseLinkResult {
  /**
   * An alias of the link.
   *
   * @example
   * ```
   * [\*alias\*](link.md) -> \*alias\*
   * ```
   */
  readonly alias?: string;

  /**
   * An encoded URL of the link.
   *
   * @example
   * ```
   * [alias](<link with space.md>) -> link%20with%20space.md
   * ```
   */
  readonly encodedUrl?: string;

  /**
   * An end offset of the link in the original text.
   */
  readonly endOffset: number;

  /**
   * Indicates if the link has angle brackets.
   *
   * @example
   * ```
   * [alias](<link.md>) -> true
   * [alias](link.md) -> false
   * ```
   */
  readonly hasAngleBrackets?: boolean;

  /**
   * Indicates if the link is an embed link.
   *
   * @example
   * ```
   * ![[alias]] -> true
   * [[alias]] -> false
   * ```
   */
  readonly isEmbed: boolean;

  /**
   * Indicates if the link is external.
   *
   * @example
   * ```
   * [alias](https://example.com) -> true
   * [alias](file.md) -> false
   * ```
   */
  readonly isExternal: boolean;

  /**
   * Indicates if the link is a `file://` URL.
   *
   * @example
   * ```
   * [alias](file:///C:/x.txt) -> true
   * [alias](https://example.com) -> false
   * ```
   */
  readonly isFileUrl: boolean;

  /**
   * Indicates if the link is a wikilink.
   *
   * @example
   * ```
   * [[alias]] -> true
   * [alias](link.md) -> false
   * ```
   */
  readonly isWikilink: boolean;

  /**
   * A raw link text.
   *
   * @example
   * ```
   * [alias](link.md) -> [alias](link.md)
   * ```
   */
  readonly raw: string;

  /**
   * A start offset of the link in the original text.
   */
  readonly startOffset: number;

  /**
   * A title of the link.
   *
   * @example
   * ```
   * [alias](link.md "title") -> title
   * ```
   */
  readonly title?: string;

  /**
   * An unescaped alias of the link.
   *
   * @example
   * ```
   * [\*alias\*](link.md) -> *alias*
   * ```
   */
  readonly unescapedAlias?: string;

  /**
   * An URL of the link.
   *
   * @example
   * ```
   * [alias](link%20with%20space.md) -> link with space.md
   * ```
   */
  readonly url: string;
}

/**
 * Params for {@link toParseLinkReference}.
 */
export interface ToParseLinkReferenceParams {
  /**
   * The content the parsed link's offsets index into. Used to compute the line and column.
   */
  readonly content: string;

  /**
   * The parsed link to wrap.
   */
  readonly parseLinkResult: ParseLinkResult;
}

/**
 * Params for {@link decodeUrlSafely}.
 */
interface DecodeUrlSafelyParams {
  /**
   * Whether the link uses angle brackets.
   */
  readonly hasAngleBrackets: boolean;

  /**
   * Whether the link is external.
   */
  readonly isExternal: boolean;

  /**
   * A URL to decode.
   */
  readonly url: string;
}

/**
 * Params for {@link extractAlias}.
 */
interface ExtractAliasParams {
  /**
   * An end offset of the alias in the string.
   */
  readonly aliasEndOffset: number;

  /**
   * A start offset of the alias in the string.
   */
  readonly aliasStartOffset: number;

  /**
   * A string to extract the alias from.
   */
  readonly str: string;
}

/**
 * Params for {@link extractTextLinks}.
 */
interface ExtractTextLinksParams {
  /**
   * An end offset of the text part in the string.
   */
  readonly endOffset: number;

  /**
   * A start offset of the text part in the string.
   */
  readonly startOffset: number;

  /**
   * A string to extract the text links from.
   */
  readonly str: string;

  /**
   * A list of parsed links to append the extracted text links to.
   */
  readonly textLinks: ParseLinkResult[];
}

/**
 * Params for {@link hasAngleBracketsInLink}.
 */
interface HasAngleBracketsInLinkParams {
  /**
   * A raw link text.
   */
  readonly raw: string;

  /**
   * A raw URL of the link.
   */
  readonly rawUrl: string;
}

interface WikiLinkNode extends Node {
  data: WikiLinkNodeData;
  value: string;
}

interface WikiLinkNodeData extends Record<string, unknown> {
  alias: string;
}

/**
 * Encodes a URL.
 *
 * @param url - The URL to encode.
 * @returns The encoded URL.
 */
export function encodeUrl(url: string): string {
  return replaceAll({
    replacer: ({ substring: specialLinkSymbol }) => encodeURIComponent(specialLinkSymbol),
    searchValue: SPECIAL_LINK_SYMBOLS_REGEXP,
    str: url
  });
}

/**
 * Escapes the alias of a markdown link.
 *
 * @param alias - An alias of a markdown link.
 * @returns An escaped alias.
 *
 * @example
 * ```ts
 * escapeAlias('**alias**') // '\\*\\*alias\\*\\*'
 * ```
 */
export function escapeAlias(alias: string): string {
  return replaceAll({
    replacer: '\\$&',
    searchValue: SPECIAL_MARKDOWN_LINK_SYMBOLS_REGEX,
    str: alias
  });
}

/**
 * Determines whether a reference is a {@link ParseLinkReference}.
 *
 * @param reference - The reference to check.
 * @returns `true` if the reference is a {@link ParseLinkReference}, otherwise `false`.
 */
export function isParseLinkReference(reference: Reference): reference is ParseLinkReference {
  return 'parseLinkResult' in reference;
}

/**
 * Parses a link into its components.
 *
 * @param str - The link to parse.
 * @returns The parsed link.
 */
export function parseLink(str: string): null | ParseLinkResult {
  const links = parseLinks(str);
  return links[0]?.raw === str ? links[0] : null;
}

/**
 * Parses all links in a string.
 *
 * @param str - The string to parse the links in.
 * @returns The parsed links.
 */
export function parseLinks(str: string): ParseLinkResult[] {
  const embedSymbolOffsets = new Set<number>();

  const EMBED_LINK_PREFIX = '![';
  const NO_EMBED_LINK_PREFIX = '@[';
  const DUMMY_CHARACTER = '@';

  const EMBED_INSIDE_LINK_REG_EXP = /\[(?<LinkAlias>!\[.*?\]\(.+?\))\]\((?<Link>.+?)\)/g;
  const noInsideEmbedsLinksStr = replaceAll({
    replacer: ({ capturedGroupArgs: [linkAlias = '', link = ''] }) => {
      const dummyAlias = DUMMY_CHARACTER.repeat(linkAlias.length);
      return `[${dummyAlias}](${link})`;
    },
    searchValue: EMBED_INSIDE_LINK_REG_EXP,
    str
  });

  const noEmbedStr = replaceAll({
    replacer: (args) => {
      embedSymbolOffsets.add(args.offset);
      return NO_EMBED_LINK_PREFIX;
    },
    searchValue: EMBED_LINK_PREFIX,
    str: noInsideEmbedsLinksStr
  });

  const processor = remark().use(remarkParse).use(wikiLinkPlugin, { aliasDivider: WIKILINK_DIVIDER });
  const root = processor.parse(noEmbedStr);

  const links: ParseLinkResult[] = [];
  const textLinks: ParseLinkResult[] = [];

  visit(root, (node: Node) => {
    let link: ParseLinkResult;
    switch (node.type) {
      case 'link':
        link = parseLinkNode(node as Link, str);
        break;
      case 'wikiLink':
        link = parseWikilinkNode(node as WikiLinkNode, str);
        break;
      default:
        return;
    }

    if (embedSymbolOffsets.has(link.startOffset - 1)) {
      link = {
        ...link,
        isEmbed: true,
        raw: `!${link.raw}`,
        startOffset: link.startOffset - 1
      };
    }
    links.push(link);
  });

  links.sort((a, b) => a.startOffset - b.startOffset);

  let textStartOffset = 0;

  for (const link of links) {
    extractTextLinks({
      endOffset: link.startOffset - 1,
      startOffset: textStartOffset,
      str,
      textLinks
    });
    textStartOffset = link.endOffset + 1;
  }

  extractTextLinks({
    endOffset: str.length - 1,
    startOffset: textStartOffset,
    str,
    textLinks
  });

  links.push(...textLinks);
  links.sort((a, b) => a.startOffset - b.startOffset);

  return links;
}

/**
 * Wraps a {@link ParseLinkResult} into a {@link ParseLinkReference} so it can flow through the
 * reference-based file-change pipeline.
 *
 * @param params - The parameters for wrapping the parsed link.
 * @returns The {@link ParseLinkReference}.
 */
export function toParseLinkReference(params: ToParseLinkReferenceParams): ParseLinkReference {
  const { content, parseLinkResult } = params;
  const reference: ParseLinkReference = {
    link: parseLinkResult.url,
    original: parseLinkResult.raw,
    parseLinkResult,
    position: {
      end: offsetToLoc(content, parseLinkResult.endOffset),
      start: offsetToLoc(content, parseLinkResult.startOffset)
    }
  };

  if (parseLinkResult.alias !== undefined) {
    reference.displayText = parseLinkResult.alias;
  }

  return reference;
}

/**
 * Unescapes the alias of a markdown link.
 *
 * @param escapedAlias - An escaped alias.
 * @returns An unescaped alias.
 *
 * @example
 * ```ts
 * unescapeAlias('\\*\\*alias\\*\\*') // '**alias**'
 * ```
 */
export function unescapeAlias(escapedAlias: string): string {
  return replaceAll({
    replacer: ({ capturedGroupArgs: [backslashes = '', specialChar = ''] }) => {
      const ESCAPED_BACKSLASH_LENGTH = 2;
      const backslashCount = backslashes.length;
      const keepCount = Math.floor(backslashCount / ESCAPED_BACKSLASH_LENGTH);
      return '\\'.repeat(keepCount) + specialChar;
    },
    searchValue: /(?<Backslashes>\\+)(?<SpecialCharacter>[!"#$%&'()*+,-./:;<=>?@[\\\]^_`{|}~])/g,
    str: escapedAlias
  });
}

function decodeUrlSafely(params: DecodeUrlSafelyParams): string {
  const { hasAngleBrackets, isExternal, url } = params;
  // `file://` URLs are external, but their percent-encoding is purely cosmetic, so decode them like
  // Internal links. Every other external URL is left untouched (its encoding may be significant).
  if ((isExternal || hasAngleBrackets) && !isFileUrl(url)) {
    return url;
  }

  try {
    return decodeURIComponent(url);
  } catch (error) {
    console.error(`Failed to decode URL ${url}`, error);
    return url;
  }
}

function extractAlias(params: ExtractAliasParams): string | undefined {
  const { aliasEndOffset, aliasStartOffset, str } = params;
  return aliasStartOffset < aliasEndOffset
    ? str.slice(aliasStartOffset, aliasEndOffset)
    : undefined;
}

function extractTextLinks(params: ExtractTextLinksParams): void {
  const { endOffset, startOffset, str, textLinks } = params;
  if (startOffset > endOffset) {
    return;
  }

  const textPart = str.slice(startOffset, endOffset + 1);
  replaceAll({
    replacer: ({ capturedGroupArgs: [url = ''], offset }) => {
      if (!isUrl(url)) {
        return;
      }

      textLinks.push({
        encodedUrl: encodeUrl(url),
        endOffset: startOffset + offset + url.length,
        hasAngleBrackets: false,
        isEmbed: false,
        isExternal: true,
        isFileUrl: isFileUrl(url),
        isWikilink: false,
        raw: url,
        startOffset: startOffset + offset,
        url
      });
    },
    searchValue: /(?<Url>\S+)/g,
    str: textPart
  });
}

function getRawLink(node: Node, str: string): string {
  const pos = ensureNonNullable(node.position);
  return str.slice(pos.start.offset, pos.end.offset);
}

function hasAngleBracketsInLink(params: HasAngleBracketsInLinkParams): boolean {
  const { raw, rawUrl } = params;
  const OPEN_ANGLE_BRACKET = '<';
  return raw.startsWith(OPEN_ANGLE_BRACKET) || rawUrl.startsWith(OPEN_ANGLE_BRACKET);
}

function offsetToLoc(content: string, offset: number): Loc {
  const precedingContent = content.slice(0, offset);
  const line = (precedingContent.match(/\n/g) ?? []).length;
  const lastNewlineOffset = precedingContent.lastIndexOf('\n');
  return {
    col: offset - (lastNewlineOffset + 1),
    line,
    offset
  };
}

function parseLinkNode(node: Link, str: string): ParseLinkResult {
  const LINK_ALIAS_SUFFIX = '](';
  const LINK_SUFFIX = ')';
  const raw = getRawLink(node, str);
  const aliasNodeStartOffset = node.children[0]?.position?.start.offset ?? 1;
  const aliasNodeEndOffset = node.children.at(-1)?.position?.end.offset ?? 1;
  const position = ensureNonNullable(node.position);
  const nodeEndOffset = ensureNonNullable(position.end.offset);
  const nodeStartOffset = ensureNonNullable(position.start.offset);
  const rawUrl = str.slice(aliasNodeEndOffset + LINK_ALIAS_SUFFIX.length, nodeEndOffset - LINK_SUFFIX.length);
  const hasAngleBrackets = hasAngleBracketsInLink({
    raw,
    rawUrl
  });
  const isExternal = isUrl(node.url);
  const url = decodeUrlSafely({
    hasAngleBrackets,
    isExternal,
    url: node.url
  });
  const alias = extractAlias({
    aliasEndOffset: aliasNodeEndOffset,
    aliasStartOffset: aliasNodeStartOffset,
    str
  });
  return normalizeOptionalProperties<ParseLinkResult>({
    alias,
    encodedUrl: isExternal ? encodeUrl(url) : undefined,
    endOffset: nodeEndOffset,
    hasAngleBrackets,
    isEmbed: false,
    isExternal,
    isFileUrl: isFileUrl(url),
    isWikilink: false,
    raw,
    startOffset: nodeStartOffset,
    title: node.title ?? undefined,
    unescapedAlias: alias === undefined ? undefined : unescapeAlias(alias),
    url
  });
}

function parseWikilinkNode(node: WikiLinkNode, str: string): ParseLinkResult {
  const position = ensureNonNullable(node.position);
  return normalizeOptionalProperties<ParseLinkResult>({
    alias: str.includes(WIKILINK_DIVIDER) ? node.data.alias : undefined,
    endOffset: ensureNonNullable(position.end.offset),
    isEmbed: false,
    isExternal: false,
    isFileUrl: false,
    isWikilink: true,
    raw: getRawLink(node, str),
    startOffset: ensureNonNullable(position.start.offset),
    url: node.value
  });
}
