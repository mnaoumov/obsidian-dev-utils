/**
 * @file
 *
 * Text/markdown/escaping utilities and identifier helpers for the API documentation generator.
 */

import { mkdir } from 'node:fs/promises';
import { dirname } from 'node:path';

import type {
  MarkdownSegment,
  MemberInfo,
  TypeInfo
} from './api-doc-types.ts';

import { EVENT_METHODS } from './api-doc-constants.ts';

/** Compute an overload key for methods with distinguishing first param (e.g. on('changed',...)) */
export function computeOverloadKey(method: MemberInfo): string {
  if (EVENT_METHODS.has(method.name) && method.parameters.length > 0) {
    const firstParam = method.parameters[0];
    if (firstParam?.type.startsWith('"') || firstParam?.type.startsWith('\'')) {
      const normalizedType = firstParam.type.replace(/"/g, '\'');
      return `${method.name}(${normalizedType})`;
    }
  }
  return method.name;
}

export async function ensureDir(filePath: string): Promise<void> {
  await mkdir(dirname(filePath), { recursive: true });
}

/** Escape text for use inside a JS string within a JSX expression: {...{key: "..."}} */
export function escapeJsString(text: string): string {
  return text.replace(/\\/g, '\\\\').replace(/"/g, '\\"').replace(/\n/g, ' ');
}

/** Escape text for use inside a JSX attribute: attr="..." (MDX uses HTML-style parsing) */
export function escapeJsxAttr(text: string): string {
  return text.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/\n/g, ' ');
}

export function escapeMarkdown(text: string): string {
  return text.replace(/\|/g, '\\|').replace(/\n/g, ' ').replace(/\{/g, '\\{').replace(/\}/g, '\\}');
}

export function escapeMdxAngleBrackets(text: string): string {
  return text.replace(/</g, '\\<').replace(/>/g, '\\>');
}

/** Escape curly braces in MDX markdown content to prevent JSX expression parsing */
export function escapeMdxBraces(text: string): string {
  return text.replace(/\{/g, '\\{').replace(/\}/g, '\\}');
}

export function escapeYaml(text: string): string {
  return text.replace(/"/g, '\\"');
}

const SIGNATURE_MAX_LENGTH = 160;

/**
 * Escape MDX-unsafe characters (`<`, `{`, `}`) in prose text, while leaving inline code spans
 * (`` `code` ``) and markdown links (`[text](url)`) untouched. MDX parses bare `<`/`{` in prose as
 * JSX/expressions, so they must be backslash-escaped to render as literal text.
 */
export function escapeMdxProse(text: string): string {
  const protectedPattern = /`[^`]*`|\[[^\]]*\]\([^)]*\)/g;
  let result = '';
  let lastIndex = 0;
  for (const match of text.matchAll(protectedPattern)) {
    const index = match.index;
    result += escapeMdxProseChars(text.slice(lastIndex, index));
    result += match[0];
    lastIndex = index + match[0].length;
  }
  result += escapeMdxProseChars(text.slice(lastIndex));
  return result;

  function escapeMdxProseChars(chunk: string): string {
    return chunk.replace(/[<{}]/g, (char) => `\\${char}`);
  }
}

/**
 * Collapse single newlines within paragraphs to spaces, preserve double newlines as paragraph breaks.
 * Fenced code blocks (``` / ~~~) are preserved verbatim — their internal newlines are NOT folded,
 * so embedded code survives to be re-emitted as a real code fence downstream.
 */
export function foldTsDocParagraphs(text: string): string {
  const segments = segmentMarkdown(text);
  return segments
    .map((seg) => {
      if (seg.type === 'code') {
        return `\`\`\`${seg.lang ?? ''}\n${seg.text}\n\`\`\``;
      }
      return seg.text
        .split(/\n{2,}/)
        .map((paragraph) => paragraph.replace(/\n/g, ' '))
        .join('\n\n');
    })
    .map((segment) => segment.trim())
    .filter(Boolean)
    .join('\n\n');
}

/**
 * Compute the relative import path from a generated page to the components directory.
 *
 * Page is at:       docs/src/content/docs/api/{nsDir}/{typeDir}/index.mdx
 * Components are at: docs/src/components/api/
 *
 * So we walk up from content/docs/api/{nsDir}/{typeDir}/ to docs/src/, then into components/api.
 */
export function getComponentImportPath(nsDir: string, typeDir: string): string {
  const segments = ['content', 'docs', 'api', ...nsDir.split('/'), ...typeDir.split('/')].filter(Boolean);
  const ups = '../'.repeat(segments.length);
  return `${ups}components/api`;
}

export function getDisplayName(name: string, info: TypeInfo): string {
  if (info.typeParameters.length === 0) {
    return name;
  }
  const bareParams = info.typeParameters.map((tp) => tp.replace(/\s+extends\s+.*$/, ''));
  return `${name}<${bareParams.join(', ')}>`;
}

/**
 * Emit the import statement for a documented export.
 *
 * The subpath equals the type's namespace (its source path relative to `src`), so
 * `src/string.ts` → `obsidian-dev-utils/string`, `src/obsidian/modals/alert.ts` →
 * `obsidian-dev-utils/obsidian/modals/alert`.
 *
 * Interfaces / type aliases / enums are imported with `import type`; classes / functions /
 * variables with a value `import`.
 */
export function getImportStatement(info: TypeInfo): string | undefined {
  const isTypeOnly = info.kind === 'interface' || info.kind === 'type' || info.kind === 'enum';
  const importKeyword = isTypeOnly ? 'import type' : 'import';
  return `${importKeyword} { ${info.name} } from 'obsidian-dev-utils/${info.namespace}';`;
}

export function getNamespaceDir(namespace: string): string {
  return namespace;
}

/** Sanitize a member name for use in a case-PRESERVED URL/route segment (e.g. `showNotice`). */
export function memberRouteSegment(name: string): string {
  return slugifyMemberName(name);
}

/** Sanitize a member name for use as an on-disk FILENAME (lowercased, collision-safe). */
export function memberSlug(name: string): string {
  return toRouteSegment(slugifyMemberName(name));
}

/** Slugify an overload key for a case-PRESERVED URL/route segment: on("changed") -> on-changed. */
export function overloadRouteSegment(overloadKey: string): string {
  return slugifyOverloadKey(overloadKey);
}

/** Slugify an overload key for an on-disk FILENAME: on("changed") -> on-changed (lowercased). */
export function overloadSlug(overloadKey: string): string {
  return toRouteSegment(slugifyOverloadKey(overloadKey));
}

/**
 * Split markdown text into an ordered list of prose and fenced-code segments.
 * A fenced-code segment is delimited by a line of 3+ backticks or tildes; its content is captured
 * raw (never escaped) so it can be re-emitted as a literal MDX code fence.
 */
export function segmentMarkdown(text: string): MarkdownSegment[] {
  const lines = text.split('\n');
  const segments: MarkdownSegment[] = [];
  let proseBuffer: string[] = [];
  let i = 0;
  while (i < lines.length) {
    const line = lines[i] ?? '';
    const openMatch = /^\s*(?<fence>`{3,}|~{3,})(?<lang>.*)$/.exec(line);
    if (openMatch?.groups) {
      const fenceChars = openMatch.groups['fence'] ?? '```';
      const fenceChar = fenceChars[0] ?? '`';
      const fenceLen = fenceChars.length;
      const lang = (openMatch.groups['lang'] ?? '').trim();
      const closeRe = new RegExp(`^\\s*\\${fenceChar}{${String(fenceLen)},}\\s*$`);
      const codeLines: string[] = [];
      i++;
      while (i < lines.length && !closeRe.test(lines[i] ?? '')) {
        codeLines.push(lines[i] ?? '');
        i++;
      }
      if (i < lines.length) {
        i++;
      }
      flushProse();
      segments.push({ lang, text: codeLines.join('\n'), type: 'code' });
      continue;
    }
    proseBuffer.push(line);
    i++;
  }
  flushProse();
  return segments;

  function flushProse(): void {
    if (proseBuffer.length > 0) {
      segments.push({ text: proseBuffer.join('\n'), type: 'prose' });
      proseBuffer = [];
    }
  }
}

export function simplifyType(typeText: string): string {
  return typeText
    .replace(/import\("[^"]+"\)\./g, '')
    .replace(/import\('[^']+'\)\./g, '');
}

/**
 * Lowercase a path segment for use in an ON-DISK file/dir name. The routes themselves are
 * case-preserved via an explicit `slug:` frontmatter (see toRouteSegmentPreserveCase), but the files
 * stay lowercase (and numerically disambiguated) so two type names differing only by case cannot
 * collide on Windows' case-insensitive filesystem.
 */
export function toRouteSegment(segment: string): string {
  return segment.toLowerCase();
}

/**
 * Slugify a path segment (type name) for a URL/route while PRESERVING case: collapse runs of
 * non-alphanumeric characters to `-` and trim. Used for the case-preserved `slug:` frontmatter and
 * the internal links that point at it, so URLs read as pretty PascalCase (e.g. `/api/.../TypeName/`).
 */
export function toRouteSegmentPreserveCase(segment: string): string {
  const cleaned = segment.replace(/[^a-zA-Z0-9]+/g, '-').replace(/^-|-$/g, '');
  return cleaned || 'unnamed';
}

/**
 * Normalize a code signature for the `signature:` frontmatter / OG card: collapse whitespace to
 * single spaces and truncate to a card-friendly length with an ellipsis.
 */
export function truncateSignature(signature: string): string {
  const collapsed = signature.replace(/\s+/g, ' ').trim();
  if (collapsed.length <= SIGNATURE_MAX_LENGTH) {
    return collapsed;
  }
  return `${collapsed.slice(0, SIGNATURE_MAX_LENGTH - 1).trimEnd()}…`;
}

function slugifyMemberName(name: string): string {
  const cleaned = name
    .replace(/^["']|["']$/g, '')
    .replace(/[^a-zA-Z0-9]/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
  if (cleaned === 'index') {
    // A member literally named `index` would write `index.mdx`, colliding with the type-overview
    // `index.mdx` in the same directory (one silently overwrites the other, 404-ing the loser).
    return 'index-member';
  }
  return cleaned || 'unnamed';
}

function slugifyOverloadKey(overloadKey: string): string {
  return overloadKey
    .replace(/["'()]/g, ' ')
    .replace(/[^a-zA-Z0-9\s]/g, '')
    .trim()
    .replace(/\s+/g, '-');
}

const OG_DESCRIPTION_MAX_LENGTH = 160;

/** Strip markdown formatting to plain text for use in meta descriptions */
export function stripMarkdown(text: string): string {
  return text
    .replace(/\{@link\s+(?:[^|}]+?)(?:\s*\|\s*(?<display>[^}]+?))?\}/g, (...args) => {
      const groups = args[args.length - 1] as Record<string, string | undefined>;
      return groups['display'] ?? '';
    })
    .replace(/\[(?<text>[^\]]+)\]\([^)]+\)/g, '$<text>')
    .replace(/[`*_~]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, OG_DESCRIPTION_MAX_LENGTH);
}
