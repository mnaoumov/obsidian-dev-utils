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

import { isFrontmatterLinkCache } from '@obsidian-typings/obsidian-public-latest/implementations';
import { remark } from 'remark';
import remarkParse from 'remark-parse';
import { wikiLinkPlugin } from 'remark-wiki-link';
import { visit } from 'unist-util-visit';

import type { GenericObject } from '../type-guards.ts';

import { normalizeOptionalProperties } from '../object-utils.ts';
import { replaceAll } from '../string.ts';
import { ensureNonNullable } from '../type-guards.ts';
import {
  encodeUrl,
  isFileUrl,
  isUrl
} from '../url.ts';

/**
 * Regular expression for special markdown link symbols.
 */
const SPECIAL_MARKDOWN_LINK_SYMBOLS_REGEX = /[\\[\]<>_*~=`$]/g;

const WIKILINK_DIVIDER = '|';

/**
 * Matches a candidate GFM extended `www.` autolink literal: `www.` at the start of the text or after
 * whitespace, `*`, `_`, `~`, `(` or `<`, running up to the next whitespace, `<` or `>`. GFM itself
 * keeps a closing `>` in the literal (Obsidian renders `<www.example.com>` with an href ending in
 * `%3E`); stopping before it is deliberate, so the brackets can be reported around the literal instead.
 */
const WWW_AUTOLINK_LITERAL_CANDIDATE_REG_EXP = /(?<=^|[\s(*<_~])www\.[^\s<>]*/g;

/**
 * Matches the domain of a GFM extended `www.` autolink literal: segments of letters, digits,
 * underscores and hyphens separated by periods.
 */
const WWW_AUTOLINK_LITERAL_DOMAIN_REG_EXP = /^www(?:\.[\p{L}\p{N}_-]+)+/u;

/**
 * The characters GFM drops from the end of an extended autolink.
 */
const WWW_AUTOLINK_LITERAL_TRAILING_PUNCTUATION = new Set(['_', ',', ':', '!', '?', '.', '*', '~']);

/**
 * Matches an entity reference at the end of an extended autolink, which GFM drops.
 */
const TRAILING_ENTITY_REFERENCE_REG_EXP = /&[\dA-Za-z]+;$/;

/**
 * The scheme Obsidian opens a GFM extended `www.` autolink literal with.
 */
const WWW_AUTOLINK_LITERAL_SCHEME = 'http://';

/**
 * The result of parsing the links from a note's frontmatter via {@link parseFrontmatterLinks}. Internal
 * single-link frontmatter values are omitted, as Obsidian natively caches them.
 */
export interface ParseFrontmatterLinksResult {
  /**
   * The external links parsed from single-link (single-value) frontmatter values.
   */
  readonly frontmatterExternalLinks: ParseLinkFrontmatterReference[];

  /**
   * The external links parsed from multi-link (multi-value) frontmatter values.
   */
  readonly multiValueFrontmatterExternalLinks: ParseLinkFrontmatterReferenceWithOffsets[];

  /**
   * The internal links parsed from multi-link (multi-value) frontmatter values.
   */
  readonly multiValueFrontmatterLinks: ParseLinkFrontmatterReferenceWithOffsets[];
}

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
 * Options for {@link parseLink}. The same as {@link ParseLinksOptions}.
 */
export type ParseLinkOptions = ParseLinksOptions;

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
 * Options for {@link parseLinks}.
 */
export interface ParseLinksOptions {
  /**
   * Whether to recognize GFM extended `www.` autolink literals (`www.example.com`, also inside
   * `<...>`) as external links, as Obsidian does in a note's body. Obsidian does not link them in
   * frontmatter values, so {@link parseFrontmatterLinks} turns this off.
   *
   * Defaults to `true`.
   */
  readonly shouldRecognizeWwwAutolinkLiterals?: boolean;
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
 * Params for {@link FrontmatterLinksParser.categorize}.
 */
interface CategorizeFrontmatterLinkParams {
  /**
   * Whether the whole frontmatter value is a single link.
   */
  readonly isSingleLink: boolean;

  /**
   * The key path of the frontmatter value.
   */
  readonly key: string;

  /**
   * The parsed link.
   */
  readonly parseLinkResult: ParseLinkResult;

  /**
   * The frontmatter value the link was parsed from.
   */
  readonly value: string;
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
   * A string to extract the alias from.
   */
  readonly $string: string;

  /**
   * An end offset of the alias in the string.
   */
  readonly aliasEndOffset: number;

  /**
   * A start offset of the alias in the string.
   */
  readonly aliasStartOffset: number;
}

/**
 * Params for {@link extractTextLinks}.
 */
interface ExtractTextLinksParams {
  /**
   * A string to extract the text links from.
   */
  readonly $string: string;

  /**
   * An end offset of the text part in the string.
   */
  readonly endOffset: number;

  /**
   * Whether to recognize GFM extended `www.` autolink literals.
   */
  readonly shouldRecognizeWwwAutolinkLiterals: boolean;

  /**
   * A start offset of the text part in the string.
   */
  readonly startOffset: number;

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

class FrontmatterLinksParser {
  private readonly frontmatterExternalLinks: ParseLinkFrontmatterReference[] = [];
  private readonly multiValueFrontmatterExternalLinks: ParseLinkFrontmatterReferenceWithOffsets[] = [];
  private readonly multiValueFrontmatterLinks: ParseLinkFrontmatterReferenceWithOffsets[] = [];

  public parse(frontmatter: unknown): ParseFrontmatterLinksResult {
    this.parseValue(frontmatter, '');
    return {
      frontmatterExternalLinks: this.frontmatterExternalLinks,
      multiValueFrontmatterExternalLinks: this.multiValueFrontmatterExternalLinks,
      multiValueFrontmatterLinks: this.multiValueFrontmatterLinks
    };
  }

  private categorize(params: CategorizeFrontmatterLinkParams): void {
    const { isSingleLink, key, parseLinkResult, value } = params;
    if (!parseLinkResult.isExternal && isSingleLink) {
      return;
    }

    const reference: ParseLinkFrontmatterReference = {
      displayText: parseLinkResult.alias ?? parseLinkResult.url,
      key,
      link: parseLinkResult.url,
      original: value,
      parseLinkResult
    };

    if (isSingleLink) {
      this.frontmatterExternalLinks.push(reference);
      return;
    }

    const referenceWithOffsets: ParseLinkFrontmatterReferenceWithOffsets = {
      ...reference,
      endOffset: parseLinkResult.endOffset,
      startOffset: parseLinkResult.startOffset
    };

    if (parseLinkResult.isExternal) {
      this.multiValueFrontmatterExternalLinks.push(referenceWithOffsets);
    } else {
      this.multiValueFrontmatterLinks.push(referenceWithOffsets);
    }
  }

  private parseValue(value: unknown, key: string): void {
    if (typeof value === 'string') {
      // Obsidian links a scheme-less `www.` literal in the body only, never in a frontmatter value.
      const parseLinkResults = parseLinks(value, { shouldRecognizeWwwAutolinkLiterals: false });
      const isSingleLink = parseLinkResults[0]?.raw === value;
      for (const parseLinkResult of parseLinkResults) {
        this.categorize({ isSingleLink, key, parseLinkResult, value });
      }
      return;
    }

    if (typeof value !== 'object' || value === null) {
      return;
    }

    for (const [childKey, childValue] of Object.entries(value as GenericObject)) {
      this.parseValue(childValue, key ? `${key}.${childKey}` : childKey);
    }
  }
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
    $string: alias,
    replacer: String.raw`\$&`,
    searchValue: SPECIAL_MARKDOWN_LINK_SYMBOLS_REGEX
  });
}

/**
 * Determines whether a reference is a {@link ParseLinkFrontmatterReference}.
 *
 * @param reference - The reference to check.
 * @returns `true` if the reference is a {@link ParseLinkFrontmatterReference}, otherwise `false`.
 */
export function isParseLinkFrontmatterReference(reference: Reference): reference is ParseLinkFrontmatterReference {
  return isFrontmatterLinkCache(reference) && 'parseLinkResult' in reference;
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
 * Parses the links from a note's frontmatter. Each string value is parsed via {@link parseLinks}: a value
 * that is a single link yields an entry without offsets, and a value that holds multiple links yields
 * offset-carrying entries. Internal single-link values are omitted, as Obsidian natively caches them.
 *
 * @param frontmatter - The frontmatter to parse (a value, object, or array).
 * @returns The parsed frontmatter links.
 */
export function parseFrontmatterLinks(frontmatter: unknown): ParseFrontmatterLinksResult {
  return new FrontmatterLinksParser().parse(frontmatter);
}

/**
 * Parses a link into its components.
 *
 * @param $string - The link to parse.
 * @param options - The parse options.
 * @returns The parsed link.
 */
export function parseLink($string: string, options?: ParseLinkOptions): null | ParseLinkResult {
  const links = parseLinks($string, options);
  return links[0]?.raw === $string ? links[0] : null;
}

/**
 * Parses all links in a string.
 *
 * Besides markdown links, wikilinks and autolinks, the plain text between them is scanned for bare
 * URLs with a scheme (`https://example.com`) and, unless turned off through
 * {@link ParseLinksOptions.shouldRecognizeWwwAutolinkLiterals}, for GFM extended `www.` autolink
 * literals (`www.example.com`). Such a literal is reported as an external link whose `url` carries the
 * `http://` scheme Obsidian opens it with, so a link rebuilt from it stays external: a scheme-less
 * `[alias](www.example.com)` is an internal link in Obsidian. A literal wrapped in `<...>` reports the
 * brackets as part of `raw`, so replacing `raw` leaves no stray bracket behind.
 *
 * @param $string - The string to parse the links in.
 * @param options - The parse options.
 * @returns The parsed links.
 */
export function parseLinks($string: string, options?: ParseLinksOptions): ParseLinkResult[] {
  const shouldRecognizeWwwAutolinkLiterals = options?.shouldRecognizeWwwAutolinkLiterals ?? true;
  const embedSymbolOffsets = new Set<number>();

  const EMBED_LINK_PREFIX = '![';
  const NO_EMBED_LINK_PREFIX = '@[';
  const DUMMY_CHARACTER = '@';

  const EMBED_INSIDE_LINK_REG_EXP = /\[(?<LinkAlias>!\[.*?\]\(.+?\))\]\((?<Link>.+?)\)/g;
  const noInsideEmbedsLinksString = replaceAll({
    $string,
    replacer: ({ capturedGroupArguments: [linkAlias = '', link = ''] }) => {
      const dummyAlias = DUMMY_CHARACTER.repeat(linkAlias.length);
      return `[${dummyAlias}](${link})`;
    },
    searchValue: EMBED_INSIDE_LINK_REG_EXP
  });

  const noEmbedString = replaceAll({
    $string: noInsideEmbedsLinksString,
    replacer: ($arguments) => {
      embedSymbolOffsets.add($arguments.offset);
      return NO_EMBED_LINK_PREFIX;
    },
    searchValue: EMBED_LINK_PREFIX
  });

  const processor = remark().use(remarkParse).use(wikiLinkPlugin, { aliasDivider: WIKILINK_DIVIDER });
  const root = processor.parse(noEmbedString);

  const links: ParseLinkResult[] = [];
  const textLinks: ParseLinkResult[] = [];

  visit(root, (node: Node) => {
    let link: ParseLinkResult;
    switch (node.type) {
      case 'link': {
        link = parseLinkNode(node as Link, $string);
        break;
      }
      case 'wikiLink': {
        link = parseWikilinkNode(node as WikiLinkNode, $string);
        break;
      }
      default: {
        return;
      }
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
      $string,
      endOffset: link.startOffset - 1,
      shouldRecognizeWwwAutolinkLiterals,
      startOffset: textStartOffset,
      textLinks
    });
    textStartOffset = link.endOffset + 1;
  }

  extractTextLinks({
    $string,
    endOffset: $string.length - 1,
    shouldRecognizeWwwAutolinkLiterals,
    startOffset: textStartOffset,
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
  return {
    ...(parseLinkResult.alias !== undefined && { displayText: parseLinkResult.alias }),
    link: parseLinkResult.url,
    original: parseLinkResult.raw,
    parseLinkResult,
    position: {
      end: offsetToLoc(content, parseLinkResult.endOffset),
      start: offsetToLoc(content, parseLinkResult.startOffset)
    }
  };
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
    $string: escapedAlias,
    replacer: ({ capturedGroupArguments: [backslashes = '', specialChar = ''] }) => {
      const ESCAPED_BACKSLASH_LENGTH = 2;
      const backslashCount = backslashes.length;
      const keepCount = Math.floor(backslashCount / ESCAPED_BACKSLASH_LENGTH);
      return '\\'.repeat(keepCount) + specialChar;
    },
    searchValue: /(?<Backslashes>\\+)(?<SpecialCharacter>[!"#$%&'()*+,-./:;<=>?@[\\\]^_`{|}~])/g
  });
}

function countOccurrences($string: string, character: string): number {
  return $string.split(character).length - 1;
}

function decodeUrlSafely(params: DecodeUrlSafelyParams): string {
  const { hasAngleBrackets, isExternal, url } = params;
  // `file://` URLs are external, but their percent-encoding is purely cosmetic, so decode them like
  // internal links. Every other external URL is left untouched (its encoding may be significant).
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
  const { $string, aliasEndOffset, aliasStartOffset } = params;
  return aliasStartOffset < aliasEndOffset
    ? $string.slice(aliasStartOffset, aliasEndOffset)
    : undefined;
}

function extractTextLinks(params: ExtractTextLinksParams): void {
  const { $string, endOffset, shouldRecognizeWwwAutolinkLiterals, startOffset, textLinks } = params;
  if (startOffset > endOffset) {
    return;
  }

  const textPart = $string.slice(startOffset, endOffset + 1);
  const schemeLinks: ParseLinkResult[] = [];
  replaceAll({
    $string: textPart,
    replacer: ({ capturedGroupArguments: [rawUrl = ''], offset }) => {
      if (!isUrl(rawUrl)) {
        return;
      }

      // Decode bare `file://` URLs like the bracketed path (`parseLinkNode`) does.
      // Offsets and `raw` stay based on the original (possibly percent-encoded) text.
      const url = decodeUrlSafely({
        hasAngleBrackets: false,
        isExternal: true,
        url: rawUrl
      });
      schemeLinks.push({
        encodedUrl: encodeUrl(url),
        endOffset: startOffset + offset + rawUrl.length,
        hasAngleBrackets: false,
        isEmbed: false,
        isExternal: true,
        isFileUrl: isFileUrl(url),
        isWikilink: false,
        raw: rawUrl,
        startOffset: startOffset + offset,
        url
      });
    },
    searchValue: /(?<Url>\S+)/g
  });
  textLinks.push(...schemeLinks);

  if (!shouldRecognizeWwwAutolinkLiterals) {
    return;
  }

  for (const match of textPart.matchAll(WWW_AUTOLINK_LITERAL_CANDIDATE_REG_EXP)) {
    const literal = trimWwwAutolinkLiteral(match[0]);
    if (!isValidWwwAutolinkLiteral(literal)) {
      continue;
    }

    const literalStartOffset = startOffset + match.index;
    const literalEndOffset = literalStartOffset + literal.length;
    if (schemeLinks.some((link) => link.startOffset < literalEndOffset && literalStartOffset < link.endOffset)) {
      continue;
    }

    const hasAngleBrackets = $string[literalStartOffset - 1] === '<' && $string[literalEndOffset] === '>';
    const linkStartOffset = hasAngleBrackets ? literalStartOffset - 1 : literalStartOffset;
    const linkEndOffset = hasAngleBrackets ? literalEndOffset + 1 : literalEndOffset;
    const url = WWW_AUTOLINK_LITERAL_SCHEME + literal;
    textLinks.push({
      encodedUrl: encodeUrl(url),
      endOffset: linkEndOffset,
      hasAngleBrackets,
      isEmbed: false,
      isExternal: true,
      isFileUrl: false,
      isWikilink: false,
      raw: $string.slice(linkStartOffset, linkEndOffset),
      startOffset: linkStartOffset,
      url
    });
  }
}

function getRawLink(node: Node, $string: string): string {
  const pos = ensureNonNullable(node.position);
  return $string.slice(pos.start.offset, pos.end.offset);
}

function hasAngleBracketsInLink(params: HasAngleBracketsInLinkParams): boolean {
  const { raw, rawUrl } = params;
  const OPEN_ANGLE_BRACKET = '<';
  return raw.startsWith(OPEN_ANGLE_BRACKET) || rawUrl.startsWith(OPEN_ANGLE_BRACKET);
}

function isValidWwwAutolinkLiteral(literal: string): boolean {
  const domain = WWW_AUTOLINK_LITERAL_DOMAIN_REG_EXP.exec(literal)?.[0];
  if (domain === undefined) {
    return false;
  }

  // GFM: no underscore in the last two segments of the domain.
  const LAST_SEGMENTS_COUNT = 2;
  return domain.split('.').slice(-LAST_SEGMENTS_COUNT).every((segment) => !segment.includes('_'));
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

function parseLinkNode(node: Link, $string: string): ParseLinkResult {
  const LINK_ALIAS_SUFFIX = '](';
  const LINK_SUFFIX = ')';
  const raw = getRawLink(node, $string);
  const position = ensureNonNullable(node.position);
  const nodeEndOffset = ensureNonNullable(position.end.offset);
  const nodeStartOffset = ensureNonNullable(position.start.offset);
  // An empty label (`[](...)`) has no children, so it starts and ends just after the node's own `[`. An embed's `!` is outside the node, since `parseLinks` masks it before parsing.
  const emptyAliasOffset = nodeStartOffset + 1;
  // eslint-disable-next-line unicorn/better-dom-traversing -- `node` is an mdast node, not a DOM node. It has no `firstElementChild`; the rule matches the `.children[0]` shape without checking what it is on.
  const aliasNodeStartOffset = node.children[0]?.position?.start.offset ?? emptyAliasOffset;
  const aliasNodeEndOffset = node.children.at(-1)?.position?.end.offset ?? emptyAliasOffset;
  const rawUrl = $string.slice(aliasNodeEndOffset + LINK_ALIAS_SUFFIX.length, nodeEndOffset - LINK_SUFFIX.length);
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
    $string,
    aliasEndOffset: aliasNodeEndOffset,
    aliasStartOffset: aliasNodeStartOffset
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

function parseWikilinkNode(node: WikiLinkNode, $string: string): ParseLinkResult {
  const position = ensureNonNullable(node.position);
  return normalizeOptionalProperties<ParseLinkResult>({
    alias: $string.includes(WIKILINK_DIVIDER) ? node.data.alias : undefined,
    endOffset: ensureNonNullable(position.end.offset),
    isEmbed: false,
    isExternal: false,
    isFileUrl: false,
    isWikilink: true,
    raw: getRawLink(node, $string),
    startOffset: ensureNonNullable(position.start.offset),
    url: node.value
  });
}

function trimWwwAutolinkLiteral(literal: string): string {
  const trimmed = trimWwwAutolinkLiteralEnd(literal);
  return trimmed === literal ? literal : trimWwwAutolinkLiteral(trimmed);
}

function trimWwwAutolinkLiteralEnd(literal: string): string {
  const lastCharacter = literal.slice(-1);
  if (WWW_AUTOLINK_LITERAL_TRAILING_PUNCTUATION.has(lastCharacter)) {
    return literal.slice(0, -1);
  }

  // GFM: a closing parenthesis with no opening one to match is not part of the literal.
  return lastCharacter === ')' && countOccurrences(literal, ')') > countOccurrences(literal, '(')
    ? literal.slice(0, -1)
    : literal.replace(TRAILING_ENTITY_REFERENCE_REG_EXP, '');
}
