/**
 * @file
 *
 * Type-link rendering: turns type text / `{@link}` tags into markdown links to generated pages
 * or external references (TypeScript handbook, MDN Web API, JS globals).
 */

import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import type {
  LinkMatchGroups,
  TypeInfo,
  WebApiEntry
} from './api-doc-types.ts';

import {
  BASE_PATH,
  GENERIC_TYPE_PARAMS,
  TS_GLOBAL_TYPES,
  TS_PRIMITIVE_TYPES,
  TS_UTILITY_TYPES
} from './api-doc-constants.ts';
import {
  escapeMdxAngleBrackets,
  escapeMdxProse,
  getNamespaceDir,
  memberRouteSegment,
  memberSlug,
  overloadRouteSegment,
  overloadSlug,
  segmentMarkdown,
  toRouteSegment,
  toRouteSegmentPreserveCase
} from './api-doc-text-utils.ts';

/** Loaded from typedoc-plugin-mdn-links data at runtime */
let webApiTypes: Record<string, unknown> = {};

/** Lowercased, collision-disambiguated ON-DISK segment per qualified type key (`${namespace}#${name}`). */
const typeFileSegments = new Map<string, string>();
/** Case-preserved URL/route segment per qualified type key (`${namespace}#${name}`). */
const typeRouteSegments = new Map<string, string>();

/**
 * Route-segment keys of the member pages that `generateMemberPages` will actually emit, as
 * `${namespace}#${TypeName}#${routeSegment}`. Only NON-inherited properties and non-inherited method
 * overload keys get a page, so this lets link emitters avoid pointing at a member page that is never
 * generated (an inherited member, an enum member, an options-interface member) — which would 404.
 */
const generatedMemberPages = new Set<string>();

/**
 * Resolve a bare type name to a documented `TypeInfo`.
 *
 * The model map is keyed by a qualified `${namespace}#${name}` identity, because obsidian-dev-utils
 * can export the same simple name from different modules. Resolution is best-effort:
 *   1. Prefer a type in `currentNamespace` (the referencing page's module).
 *   2. Otherwise, if exactly one type across all modules has that bare name, use it.
 *   3. If the bare name is ambiguous (multiple modules), give up (caller renders plain code).
 */
export function findType(allTypes: Map<string, TypeInfo>, name: string, currentNamespace?: string): TypeInfo | undefined {
  if (currentNamespace !== undefined) {
    const qualified = allTypes.get(`${currentNamespace}#${name}`);
    if (qualified) {
      return qualified;
    }
  }
  let found: TypeInfo | undefined;
  let matchCount = 0;
  for (const info of allTypes.values()) {
    if (info.name === name) {
      found = info;
      matchCount++;
      if (matchCount > 1) {
        return undefined;
      }
    }
  }
  return matchCount === 1 ? found : undefined;
}

/**
 * Link a base type expression for the "Extends:" line.
 * Simple type references (identifier + optional generics) use renderTypeWithLinks
 * so each type argument gets its own link.
 * Complex expressions (object types, intersections, etc.) fall back to typeLink
 * to avoid MDX parsing issues with `{`, `}`, `|` etc.
 */
export function linkBaseType(typeName: string, allTypes: Map<string, TypeInfo>, currentNamespace?: string): string {
  const isSimpleTypeRef = /^[a-zA-Z][a-zA-Z0-9]*(?:<.*>)?$/.test(typeName.trim());
  if (isSimpleTypeRef) {
    return escapeMdxAngleBrackets(renderTypeWithLinks(typeName, allTypes, undefined, currentNamespace));
  }
  return typeLink(typeName, allTypes, currentNamespace);
}

export function loadExternalTypeMaps(): void {
  try {
    const dataPath = join(process.cwd(), 'node_modules/typedoc-plugin-mdn-links/data/web-api.json');
    webApiTypes = JSON.parse(readFileSync(dataPath, 'utf-8')) as Record<string, unknown>;
    console.warn(`Loaded ${String(Object.keys(webApiTypes).length)} Web API type links`);
  } catch {
    console.warn('typedoc-plugin-mdn-links data not found — Web API links will be unavailable.');
  }
}

/** Convert inline markdown to HTML for use in component props with set:html */
export function markdownToHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/\[(?<text>[^\]]+)\]\((?<url>[^)]+)\)/g, (_match: string, linkText: string, url: string) => {
      if (/^(?:https?:\/\/|\/|#|mailto:)/.test(url)) {
        return `<a href="${url}">${linkText}</a>`;
      }
      // A relative URL here is an illustrative example path in TSDoc (e.g. `[foo](foo.png)`), not a
      // Real navigable link — render it as literal inline code so it neither 404s nor loses meaning.
      return `<code>[${linkText}](${url})</code>`;
    })
    .replace(/`(?<code>[^`]+)`/g, '<code>$<code></code>')
    .replace(/\n/g, '<br/>');
}

/** Build the href for a member, pointing to the parent type's page if inherited */
export function memberHref(memberSlugStr: string, inheritedFrom: string, allTypes: Map<string, TypeInfo>, currentNamespace?: string): string {
  if (!inheritedFrom) {
    // Own (non-inherited) member — `generateMemberPages` always emits its page on this same page.
    return `./${memberSlugStr}/`;
  }
  const parentInfo = findType(allTypes, inheritedFrom, currentNamespace);
  if (!parentInfo || !memberPageExists(parentInfo.namespace, parentInfo.name, memberSlugStr)) {
    // The declaring parent has no generated page for this member (it inherited the member too, or is
    // Undocumented). Return no href so the caller renders plain text instead of a broken link.
    return '';
  }
  const parentNsDir = getNamespaceDir(parentInfo.namespace);
  return `${BASE_PATH}/api/${parentNsDir}/${toTypeRouteSegment(parentInfo.namespace, parentInfo.name)}/${memberSlugStr}/`;
}

/** Whether a member page will be generated for `routeSegment` on the given type. */
export function memberPageExists(namespace: string, typeName: string, routeSegment: string): boolean {
  return generatedMemberPages.has(`${namespace}#${typeName}#${routeSegment}`);
}

/**
 * Populate {@link memberPageExists}. Mirrors `generateMemberPages`'s own filtering exactly (one page
 * per non-inherited property, one per non-inherited method overload key). Must run once before any
 * link is rendered.
 */
export function registerMemberPages(types: Map<string, TypeInfo>): void {
  generatedMemberPages.clear();
  for (const info of types.values()) {
    for (const prop of info.properties) {
      if (!prop.inheritedFrom) {
        generatedMemberPages.add(`${info.namespace}#${info.name}#${memberRouteSegment(prop.name)}`);
      }
    }
    const overloadKeys = new Set<string>();
    for (const method of info.methods) {
      if (!method.inheritedFrom) {
        overloadKeys.add(method.overloadKey);
      }
    }
    for (const overloadKey of overloadKeys) {
      generatedMemberPages.add(`${info.namespace}#${info.name}#${overloadRouteSegment(overloadKey)}`);
    }
  }
}

/**
 * For every documented type assign BOTH:
 *  - a lowercased, numerically-disambiguated FILE segment (so `TypeAsserter` vs `typeAsserter`, which
 *    both lowercase to `typeasserter`, become `typeasserter` / `typeasserter-2` on disk and never
 *    collide on Windows' case-insensitive filesystem), and
 *  - a case-PRESERVED ROUTE segment (`TypeAsserter` / `typeAsserter`) used for the explicit `slug:`
 *    frontmatter and every internal link, so the URLs stay pretty and naturally distinct.
 * The route decouples from the file path via the `slug:` frontmatter, so no `-2` suffix leaks into
 * URLs. Also warns about member-slug collisions within a type. Must run once before any page/link.
 */
export function registerRouteSegments(types: Map<string, TypeInfo>): void {
  typeFileSegments.clear();
  typeRouteSegments.clear();
  const byNamespace = new Map<string, TypeInfo[]>();
  for (const info of types.values()) {
    const list = byNamespace.get(info.namespace) ?? [];
    list.push(info);
    byNamespace.set(info.namespace, list);
  }
  for (const [namespace, infos] of byNamespace) {
    const usedFileSegments = new Set<string>();
    const usedRouteSegments = new Set<string>();
    const sorted = [...infos].sort((alpha, bravo) => alpha.name.localeCompare(bravo.name));
    for (const info of sorted) {
      typeFileSegments.set(`${namespace}#${info.name}`, disambiguate(toRouteSegment(info.name), usedFileSegments));

      const routeBase = toRouteSegmentPreserveCase(info.name);
      const routeSegment = disambiguate(routeBase, usedRouteSegments);
      typeRouteSegments.set(`${namespace}#${info.name}`, routeSegment);
      if (routeSegment !== routeBase) {
        console.warn(`Disambiguated ROUTE for "${namespace}#${info.name}": "${routeBase}" -> "${routeSegment}" (slug collision).`);
      }
      warnMemberSlugCollisions(info, namespace);
    }
  }

  function disambiguate(base: string, used: Set<string>): string {
    let segment = base;
    const FIRST_DISAMBIGUATION_SUFFIX = 2;
    let suffix = FIRST_DISAMBIGUATION_SUFFIX;
    while (used.has(segment)) {
      segment = `${base}-${String(suffix)}`;
      suffix++;
    }
    used.add(segment);
    return segment;
  }
}

/**
 * Render an `@example` block as MDX. If the example already contains a fenced code block, it is
 * normalized through {@link renderMdxProse} (code preserved raw, surrounding prose escaped);
 * otherwise the raw example text is wrapped in a `ts` code fence so it is emitted literally.
 */
export function renderExampleMdx(example: string, allTypes: Map<string, TypeInfo>, selfNamespace?: string): string {
  if (/(?:^|\n)\s*(?:```|~~~)/.test(example)) {
    return renderMdxProse(example, allTypes, selfNamespace);
  }
  return `\`\`\`ts\n${example}\n\`\`\``;
}

/**
 * Render markdown block text (a description, remarks, or module overview) as MDX-safe markdown.
 * Fenced code blocks are re-emitted verbatim (surrounded by blank lines, with a language); prose
 * segments have their `{@link}` tags resolved and their MDX-unsafe characters escaped.
 */
export function renderMdxProse(text: string, allTypes: Map<string, TypeInfo>, selfNamespace?: string): string {
  const out: string[] = [];
  for (const seg of segmentMarkdown(text)) {
    if (seg.type === 'code') {
      out.push('');
      out.push(`\`\`\`${seg.lang ?? 'ts'}`);
      out.push(seg.text);
      out.push('```');
      out.push('');
    } else {
      out.push(escapeMdxProse(resolveLinks(seg.text, allTypes, selfNamespace)));
    }
  }
  return out.join('\n').replace(/\n{3,}/g, '\n\n').trim();
}

/** Render a type string with clickable links for known types */
export function renderTypeWithLinks(typeText: string, allTypes: Map<string, TypeInfo>, selfTypeName?: string, selfNamespace?: string): string {
  // Pre-pass: link Object.method patterns to MDN before word-by-word linking
  const MDN_OBJECT_BASE = 'https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/Object';
  const withObjectMethods = typeText.replace(
    /\bObject\.(?<method>[a-zA-Z][a-zA-Z0-9]*)\b/g,
    (_fullMatch, method: string) => `[Object](${MDN_OBJECT_BASE}).[${method}](${MDN_OBJECT_BASE}/${method})`
  );
  // Main pass: link individual type names, skipping text already inside markdown links
  return withObjectMethods.replace(
    /\[(?<linkText>[^\]]+)\]\([^)]+\)|\b(?<typeName>[a-zA-Z][a-zA-Z0-9]*)\b/g,
    (match, _linkText: string | undefined, _unused: unknown, ...rest: unknown[]) => {
      const groups = rest[rest.length - 1] as Record<string, string | undefined>;
      if (groups['linkText']) {
        return match;
      }
      const typeName = groups['typeName'];
      if (!typeName) {
        return match;
      }
      // Link `this` return type to the current type's page
      if (typeName === 'this' && selfTypeName) {
        const selfInfo = findType(allTypes, selfTypeName, selfNamespace);
        if (selfInfo) {
          return `[${typeName}](${typeHref(selfInfo)})`;
        }
      }

      // Skip generic type parameters
      if (GENERIC_TYPE_PARAMS.has(typeName)) {
        return typeName;
      }

      // Check our own types first
      const info = findType(allTypes, typeName, selfNamespace);
      if (info) {
        return `[${typeName}](${typeHref(info)})`;
      }

      // TypeScript utility types
      const tsUrl = resolveTsUtilityUrl(typeName);
      if (tsUrl) {
        return `[${typeName}](${tsUrl})`;
      }

      // JS global types (Array, Promise, Map, etc.)
      const globalUrl = Object.hasOwn(TS_GLOBAL_TYPES, typeName) ? TS_GLOBAL_TYPES[typeName] : undefined;
      if (globalUrl) {
        return `[${typeName}](${globalUrl})`;
      }

      // Web API / MDN types
      const mdnUrl = resolveWebApiUrl(typeName);
      if (mdnUrl) {
        return `[${typeName}](${mdnUrl})`;
      }

      // TypeScript primitive types
      const primitiveUrl = Object.hasOwn(TS_PRIMITIVE_TYPES, typeName) ? TS_PRIMITIVE_TYPES[typeName] : undefined;
      if (primitiveUrl) {
        return `[${typeName}](${primitiveUrl})`;
      }

      return typeName;
    }
  );
}

/** Resolve {@link Name} and {@link Name | display text} tags in description text */
export function resolveLinks(text: string, allTypes: Map<string, TypeInfo>, selfNamespace?: string): string {
  return text.replace(/\{@link\s+(?<target>[^|}]+?)(?:\s*\|\s*(?<display>[^}]+?))?\}/g, (...args) => {
    const groups = args[args.length - 1] as LinkMatchGroups;
    const target = groups.target.trim();
    const display = (groups.display?.trim() ?? target).replace(/\\(?=[<>{}])/g, '');

    // Handle Type.member references (e.g., PluginNoticeComponent.showNotice)
    const dotMatch = /^(?<typeName>[A-Za-z]\w*)\.(?<memberName>\w+)$/.exec(target);
    if (dotMatch?.groups) {
      const typeName = dotMatch.groups['typeName'] ?? '';
      const memberName = dotMatch.groups['memberName'] ?? '';
      const typeInfo = findType(allTypes, typeName, selfNamespace);
      if (typeInfo && memberPageExists(typeInfo.namespace, typeInfo.name, memberRouteSegment(memberName))) {
        const targetNsDir = getNamespaceDir(typeInfo.namespace);
        return `[${display}](${BASE_PATH}/api/${targetNsDir}/${toTypeRouteSegment(typeInfo.namespace, typeInfo.name)}/${memberRouteSegment(memberName)}/)`;
      }
    }

    // Handle simple type references — if display contains generic args, link each type individually
    const info = findType(allTypes, target, selfNamespace);
    if (info) {
      if (display !== target && display.includes('<')) {
        return renderTypeWithLinks(display, allTypes, undefined, selfNamespace);
      }
      return `[${display}](${typeHref(info)})`;
    }
    return `\`${display}\``;
  });
}

export function resolveTsUtilityUrl(name: string): string | undefined {
  const hash = TS_UTILITY_TYPES.get(name);
  if (hash) {
    if (['Iterable'].includes(name)) {
      return `https://www.typescriptlang.org/docs/handbook/iterators-and-generators.html#${hash}`;
    }
    if (['Capitalize', 'Lowercase', 'Uncapitalize', 'Uppercase'].includes(name)) { // Cspell:disable-line
      return `https://www.typescriptlang.org/docs/handbook/2/template-literal-types.html#${hash}`;
    }
    return `https://www.typescriptlang.org/docs/handbook/utility-types.html#${hash}`;
  }
  return undefined;
}

export function resolveWebApiUrl(name: string): string | undefined {
  if (!Object.hasOwn(webApiTypes, name)) {
    return undefined;
  }
  const entry = webApiTypes[name];
  if (typeof entry === 'string') {
    return entry;
  }
  if (typeof entry === 'object' && entry !== null && 'url' in entry) {
    const typedEntry = entry as WebApiEntry;
    return typedEntry.url;
  }
  return undefined;
}

/** Resolve the lowercased ON-DISK segment for a type (file path + component-import relative path). */
export function toTypeFileSegment(namespace: string, name: string): string {
  return typeFileSegments.get(`${namespace}#${name}`) ?? toRouteSegment(name);
}

/** Resolve the case-preserved URL/ROUTE segment for a type (slug frontmatter + internal links). */
export function toTypeRouteSegment(namespace: string, name: string): string {
  return typeRouteSegments.get(`${namespace}#${name}`) ?? toRouteSegmentPreserveCase(name);
}

/** Absolute link to a type's overview page. */
export function typeHref(info: TypeInfo): string {
  return `${BASE_PATH}/api/${getNamespaceDir(info.namespace)}/${toTypeRouteSegment(info.namespace, info.name)}/`;
}

/** Create an absolute link to a type page */
export function typeLink(typeName: string, allTypes: Map<string, TypeInfo>, currentNamespace?: string): string {
  const cleanName = typeName.replace(/<.*>$/, '').trim();
  const info = findType(allTypes, cleanName, currentNamespace);
  if (!info) {
    return `\`${typeName}\``;
  }
  return `[${escapeMdxAngleBrackets(typeName)}](${typeHref(info)})`;
}

/**
 * Warn when two distinct members of a type produce the same member slug (URL/file segment). The
 * optional-`?` suffix is stripped first, so a property appearing as both required and optional is not
 * a false positive.
 */
function warnMemberSlugCollisions(info: TypeInfo, namespace: string): void {
  const seen = new Map<string, string>();
  function check(slug: string, original: string): void {
    const normalized = original.replace(/\?$/, '');
    const existing = seen.get(slug);
    if (existing !== undefined && existing !== normalized) {
      console.warn(`Member route collision in "${namespace}#${info.name}": "${existing}" and "${normalized}" both map to "/${slug}/".`);
      return;
    }
    seen.set(slug, normalized);
  }
  for (const prop of info.properties) {
    check(memberSlug(prop.name), prop.name);
  }
  for (const method of info.methods) {
    check(overloadSlug(method.overloadKey), method.overloadKey);
  }
}
