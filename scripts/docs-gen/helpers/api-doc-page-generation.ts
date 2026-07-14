/**
 * @file
 *
 * MDX page + sidebar emission: renders module index pages, per-type overview pages, per-member pages,
 * backlinks, and the Starlight sidebar JSON.
 */

import { writeFile } from 'node:fs/promises';
import { join } from 'node:path';

import type {
  MemberInfo,
  PageContent,
  SidebarEntry,
  SidebarLink,
  SidebarTreeNode,
  TypeInfo
} from './api-doc-types.ts';

import {
  BASE_PATH,
  EVENT_METHODS,
  OUTPUT_DIR,
  SIDEBAR_FILE
} from './api-doc-constants.ts';
import {
  linkBaseType,
  markdownToHtml,
  memberHref,
  renderExampleMdx,
  renderMdxProse,
  renderTypeWithLinks,
  resolveLinks,
  toTypeFileSegment,
  toTypeRouteSegment,
  typeLink
} from './api-doc-link-rendering.ts';
import {
  ensureDir,
  escapeJsString,
  escapeJsxAttr,
  escapeMarkdown,
  escapeMdxAngleBrackets,
  escapeMdxBraces,
  escapeYaml,
  getComponentImportPath,
  getDisplayName,
  getImportStatement,
  getNamespaceDir,
  memberRouteSegment,
  memberSlug,
  overloadRouteSegment,
  overloadSlug,
  stripMarkdown,
  truncateSignature
} from './api-doc-text-utils.ts';

const JSON_INDENT = 2;

/** Append backlinks to overview pages and write all files. Keyed by qualified `${namespace}#${name}`. */
export async function appendBacklinksAndWrite(
  pageContents: Map<string, PageContent>,
  allTypes: Map<string, TypeInfo>
): Promise<void> {
  const backlinks = buildBacklinksFromContent(pageContents, allTypes);

  for (const [key, { content, filePath }] of pageContents) {
    const typeBacklinks = backlinks.get(key) ?? [];
    const lines = [content];
    if (typeBacklinks.length > 0) {
      const sortedBacklinks = [...typeBacklinks].sort((a, b) => a.localeCompare(b));
      lines.push('');
      lines.push('---');
      lines.push('');
      lines.push('**Links to this page:**');
      lines.push('');
      for (const blKey of sortedBacklinks) {
        const blInfo = allTypes.get(blKey);
        if (blInfo) {
          const blNsDir = getNamespaceDir(blInfo.namespace);
          lines.push(`- [${blInfo.name}](${BASE_PATH}/api/${blNsDir}/${toTypeRouteSegment(blInfo.namespace, blInfo.name)}/)`);
        }
      }
    }
    await writeFile(filePath, lines.join('\n'), 'utf-8');
  }
}

/** Build backlinks by scanning generated page content for internal API links. Keyed by qualified id. */
export function buildBacklinksFromContent(
  pageContents: Map<string, PageContent>,
  allTypes: Map<string, TypeInfo>
): Map<string, string[]> {
  const backlinks = new Map<string, string[]>();
  // Emitted URLs lowercase the type segment (see toRouteSegment), so map each lowercased route
  // identity back to its original qualified type key.
  const routeKeyToTypeKey = new Map<string, string>();
  for (const [typeKey, info] of allTypes) {
    routeKeyToTypeKey.set(`${getNamespaceDir(info.namespace)}#${toTypeRouteSegment(info.namespace, info.name)}`, typeKey);
  }
  const escapedBase = BASE_PATH.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const linkPattern = new RegExp(`${escapedBase}/api/(?<path>(?:[a-zA-Z0-9_@-]+/)+)`, 'g');
  for (const [sourceKey, { content }] of pageContents) {
    const referenced = new Set<string>();

    for (const match of content.matchAll(linkPattern)) {
      const path = match.groups?.['path'] ?? '';
      const segments = path.split('/').filter(Boolean);
      if (segments.length < 1) {
        continue;
      }
      const typeName = segments[segments.length - 1] ?? '';
      const namespace = segments.slice(0, -1).join('/');
      const routeKey = `${namespace}#${typeName}`;
      const resolvedKey = routeKeyToTypeKey.get(routeKey);
      if (resolvedKey !== undefined && resolvedKey !== sourceKey) {
        referenced.add(resolvedKey);
      }
    }

    for (const ref of referenced) {
      if (!backlinks.has(ref)) {
        backlinks.set(ref, []);
      }
      backlinks.get(ref)?.push(sourceKey);
    }
  }

  return backlinks;
}

export function buildSidebarTree(types: Map<string, TypeInfo>): SidebarTreeNode {
  const root: SidebarTreeNode = { children: new Map(), types: [] };
  for (const [, info] of types) {
    const parts = info.namespace.split('/');
    let node = root;
    for (const part of parts) {
      if (!node.children.has(part)) {
        node.children.set(part, { children: new Map(), types: [] });
      }
      node = node.children.get(part) ?? node;
    }
    node.types.push(info);
  }
  return root;
}

export async function generateMemberPages(name: string, info: TypeInfo, allTypes: Map<string, TypeInfo>): Promise<void> {
  const nsDir = getNamespaceDir(info.namespace);
  const typeFileDir = toTypeFileSegment(info.namespace, name);
  const typeRouteDir = toTypeRouteSegment(info.namespace, name);
  const componentImport = `import { MemberDetail } from "${getComponentImportPath(nsDir, typeFileDir)}";`;

  // Property pages (skip inherited — they live on the parent type)
  const props = info.properties.filter((p) => !p.inheritedFrom);
  for (const prop of props) {
    const filePath = join(OUTPUT_DIR, nsDir, typeFileDir, `${memberSlug(prop.name)}.mdx`);
    await ensureDir(filePath);

    const lines: string[] = [];
    const propTitle = `${name}.${prop.name}`;
    lines.push('---');
    lines.push(`title: "${escapeYaml(propTitle)}"`);
    lines.push(`slug: "api/${nsDir}/${typeRouteDir}/${memberRouteSegment(prop.name)}"`);
    lines.push(`signature: "${escapeYaml(truncateSignature(`${prop.signature}: ${prop.type}`))}"`);
    lines.push('editUrl: false');
    lines.push('sidebar:');
    lines.push(`  label: "${escapeYaml(propTitle)}"`);
    lines.push('---');
    lines.push('');
    lines.push(componentImport);
    lines.push('');

    // Breadcrumb
    lines.push(`[${name}](${BASE_PATH}/api/${nsDir}/${typeRouteDir}/) › ${prop.name}`);
    lines.push('');

    const staticAttr = prop.isStatic ? ' isStatic={true}' : '';
    const typeAttr = ` type="${escapeJsxAttr(markdownToHtml(renderTypeWithLinks(prop.type, allTypes, name, info.namespace)))}"`;
    const descAttr = prop.description ? ` description="${escapeJsxAttr(markdownToHtml(resolveLinks(prop.description, allTypes, info.namespace)))}"` : '';
    const remarksAttr = prop.remarks ? ` remarks="${escapeJsxAttr(markdownToHtml(resolveLinks(prop.remarks, allTypes, info.namespace)))}"` : '';
    const sinceAttr = prop.since ? ` since="${escapeJsxAttr(prop.since)}"` : '';
    const examplesAttr = prop.examples.length > 0 ? ` examples={${JSON.stringify(prop.examples)}}` : '';

    lines.push(`<MemberDetail${staticAttr}${typeAttr}${descAttr}${remarksAttr}${sinceAttr}${examplesAttr} />`);
    lines.push('');

    await writeFile(filePath, lines.join('\n'), 'utf-8');
  }

  // Method pages — each overload key gets its own page (skip inherited)
  const methods = info.methods.filter((m) => !m.inheritedFrom);
  const overloadGroups = new Map<string, MemberInfo[]>();
  for (const method of methods) {
    const key = method.overloadKey;
    if (!overloadGroups.has(key)) {
      overloadGroups.set(key, []);
    }
    overloadGroups.get(key)?.push(method);
  }

  for (const [overloadKey, overloads] of overloadGroups) {
    const fileSlug = overloadSlug(overloadKey);
    const filePath = join(OUTPUT_DIR, nsDir, typeFileDir, `${fileSlug}.mdx`);
    await ensureDir(filePath);

    const displayName = `${name}.${overloadKey} method`;
    const firstOverload = overloads[0];

    const lines: string[] = [];
    lines.push('---');
    lines.push(`title: "${escapeYaml(displayName)}"`);
    lines.push(`slug: "api/${nsDir}/${typeRouteDir}/${overloadRouteSegment(overloadKey)}"`);
    if (firstOverload) {
      lines.push(`signature: "${escapeYaml(truncateSignature(`${firstOverload.signature}: ${firstOverload.returnType}`))}"`);
    }
    lines.push('editUrl: false');
    lines.push('sidebar:');
    lines.push(`  label: "${escapeYaml(`${name}.${overloadKey}`)}"`);
    lines.push('---');
    lines.push('');
    lines.push(componentImport);
    lines.push('');

    // Breadcrumb
    lines.push(`[${name}](${BASE_PATH}/api/${nsDir}/${typeRouteDir}/) › ${overloadKey}`);
    lines.push('');

    for (const overload of overloads) {
      renderMethodOverloadMdx(lines, overload, name, info.namespace, allTypes);
      if (overloads.length > 1) {
        lines.push('---');
        lines.push('');
      }
    }

    await writeFile(filePath, lines.join('\n'), 'utf-8');
  }
}

export async function generateNamespaceIndexPages(
  types: Map<string, TypeInfo>,
  allTypes: Map<string, TypeInfo>,
  moduleOverviews: Map<string, string>
): Promise<void> {
  const namespaces = new Map<string, TypeInfo[]>();
  for (const [, info] of types) {
    if (!namespaces.has(info.namespace)) {
      namespaces.set(info.namespace, []);
    }
    namespaces.get(info.namespace)?.push(info);
  }

  for (const [namespace, nsTypes] of namespaces) {
    const nsDir = getNamespaceDir(namespace);
    const filePath = join(OUTPUT_DIR, nsDir, 'index.mdx');
    await ensureDir(filePath);

    const lines: string[] = [];
    lines.push('---');
    lines.push(`title: "${namespace}"`);
    lines.push(`slug: "api/${nsDir}"`);
    lines.push('editUrl: false');
    lines.push('sidebar:');
    lines.push(`  label: "${namespace}"`);
    lines.push('---');
    lines.push('');

    // Module @file overview text
    const overview = moduleOverviews.get(namespace);
    if (overview) {
      lines.push(renderMdxProse(overview, allTypes, namespace));
      lines.push('');
    }

    renderNamespaceTable(lines, 'Classes', 'Class', nsTypes.filter((t) => t.kind === 'class'), allTypes, namespace);
    renderNamespaceTable(lines, 'Interfaces', 'Interface', nsTypes.filter((t) => t.kind === 'interface'), allTypes, namespace);
    renderNamespaceTable(lines, 'Functions', 'Function', nsTypes.filter((t) => t.kind === 'function'), allTypes, namespace);
    renderNamespaceTable(lines, 'Types', 'Type', nsTypes.filter((t) => t.kind === 'type'), allTypes, namespace);
    renderNamespaceTable(lines, 'Enums', 'Enum', nsTypes.filter((t) => t.kind === 'enum'), allTypes, namespace);
    renderNamespaceTable(lines, 'Variables', 'Variable', nsTypes.filter((t) => t.kind === 'variable'), allTypes, namespace);

    await writeFile(filePath, lines.join('\n'), 'utf-8');
  }

  // Root API index page listing every module.
  const rootLines: string[] = [];
  rootLines.push('---');
  rootLines.push('title: "API reference"');
  rootLines.push('slug: "api"');
  rootLines.push('editUrl: false');
  rootLines.push('sidebar:');
  rootLines.push('  label: "Overview"');
  rootLines.push('---');
  rootLines.push('');
  rootLines.push('The complete API reference for `obsidian-dev-utils`, generated from the library\'s TSDoc. Each module below maps to an import subpath (e.g. the `string` module is `obsidian-dev-utils/string`).');
  rootLines.push('');
  rootLines.push('## Modules');
  rootLines.push('');
  const sortedNamespaces = [...namespaces.keys()].sort((a, b) => a.localeCompare(b));
  for (const namespace of sortedNamespaces) {
    rootLines.push(`- [${namespace}](${BASE_PATH}/api/${getNamespaceDir(namespace)}/)`);
  }
  rootLines.push('');
  const rootFilePath = join(OUTPUT_DIR, 'index.mdx');
  await ensureDir(rootFilePath);
  await writeFile(rootFilePath, rootLines.join('\n'), 'utf-8');
}

export async function generateOverviewPage(name: string, info: TypeInfo, allTypes: Map<string, TypeInfo>): Promise<PageContent> {
  const nsDir = getNamespaceDir(info.namespace);
  const typeFileSlug = toTypeFileSegment(info.namespace, name);
  const typeRouteSlug = toTypeRouteSegment(info.namespace, name);
  const filePath = join(OUTPUT_DIR, nsDir, typeFileSlug, 'index.mdx');
  await ensureDir(filePath);

  const lines: string[] = [];

  // Frontmatter
  const displayName = getDisplayName(name, info);
  lines.push('---');
  lines.push(`title: "${displayName}"`);
  lines.push(`slug: "api/${nsDir}/${typeRouteSlug}"`);
  if (info.description) {
    lines.push(`description: "${escapeYaml(stripMarkdown(info.description))}"`);
  }
  const pageSignature = computeOverviewSignature(name, info);
  if (pageSignature) {
    lines.push(`signature: "${escapeYaml(truncateSignature(pageSignature))}"`);
  }
  lines.push('editUrl: false');
  lines.push('sidebar:');
  lines.push(`  label: "${displayName}"`);
  lines.push('---');
  lines.push('');

  // Component imports — compute relative path from generated page to components
  const componentPath = getComponentImportPath(nsDir, typeFileSlug);
  lines.push(
    `import { TypeSignature, ImportStatement, ConstructorBlock, PropertyTable, MethodTable } from "${componentPath}";`
  );
  lines.push('');

  // Description
  if (info.description) {
    lines.push(renderMdxProse(info.description, allTypes, info.namespace));
    lines.push('');
  }

  // Remarks
  if (info.remarks) {
    const remarksBlock = renderMdxProse(info.remarks, allTypes, info.namespace);
    lines.push(remarksBlock.split('\n').map((line) => (line.length > 0 ? `> ${line}` : '>')).join('\n'));
    lines.push('');
  }

  // Import statement
  const importStatement = getImportStatement(info);
  if (importStatement) {
    lines.push(`<ImportStatement text="${escapeJsxAttr(importStatement)}" />`);
    lines.push('');
  }

  // Examples
  for (const example of info.examples) {
    lines.push('**Example:**');
    lines.push('');
    lines.push(renderExampleMdx(example, allTypes, info.namespace));
    lines.push('');
  }

  // Functions render like method detail pages — signature, params, returns
  if (info.kind === 'function') {
    renderFunctionPage(lines, info, allTypes);
    return { content: lines.join('\n'), filePath };
  }

  // Variables render with declaration keyword and type
  if (info.kind === 'variable') {
    renderVariablePage(lines, name, info, allTypes);
    return { content: lines.join('\n'), filePath };
  }

  // Enums render their members list
  if (info.kind === 'enum') {
    renderEnumPage(lines, info, allTypes);
    return { content: lines.join('\n'), filePath };
  }

  // Type aliases render their right-hand-side signature
  if (info.kind === 'type') {
    renderTypeAliasPage(lines, info, allTypes);
    return { content: lines.join('\n'), filePath };
  }

  // Classes / interfaces: signature + extends/implements + constructor + member tables
  const typeParamsAttr = info.typeParameters.length > 0 ? ` typeParams={${JSON.stringify(info.typeParameters)}}` : '';
  const extendsAttr = info.baseTypes.length > 0 ? ` extends={${JSON.stringify(info.baseTypes)}}` : '';
  const implementsAttr = info.implementsTypes.length > 0 ? ` implements={${JSON.stringify(info.implementsTypes)}}` : '';
  lines.push(`<TypeSignature kind="${info.kind}" name="${name}"${typeParamsAttr}${extendsAttr}${implementsAttr} />`);
  lines.push('');

  if (info.baseTypes.length > 0) {
    const linkedTypes = info.baseTypes.map((t) => linkBaseType(t, allTypes, info.namespace));
    lines.push(`**Extends:** ${linkedTypes.join(', ')}`);
    lines.push('');
  }

  if (info.implementsTypes.length > 0) {
    const linkedTypes = info.implementsTypes.map((t) => linkBaseType(t, allTypes, info.namespace));
    lines.push(`**Implements:** ${linkedTypes.join(', ')}`);
    lines.push('');
  }

  renderConstructorMdx(lines, name, info, allTypes);
  renderPropertyTableMdx(lines, info, allTypes);
  renderMethodTableMdx(lines, info, allTypes);

  return { content: lines.join('\n'), filePath };
}

export async function generateSidebarJson(types: Map<string, TypeInfo>): Promise<void> {
  const root = buildSidebarTree(types);

  const groups: SidebarEntry[] = [];
  const topLevels = [...root.children.keys()].sort((a, b) => a.localeCompare(b));
  for (const topLevel of topLevels) {
    const child = root.children.get(topLevel);
    if (child) {
      groups.push(sidebarTreeToEntries(child, topLevel));
    }
  }

  const wrappedSidebar: SidebarEntry[] = [{
    collapsed: false,
    items: groups,
    label: 'API reference'
  }];

  await writeFile(SIDEBAR_FILE, JSON.stringify(wrappedSidebar, null, JSON_INDENT), 'utf-8');
  console.warn(`Generated sidebar with ${String(groups.length)} top-level module groups`);
}

export function renderConstructorMdx(lines: string[], name: string, info: TypeInfo, allTypes: Map<string, TypeInfo>): void {
  const constructor = info.constructorInfo;
  if (!constructor) {
    return;
  }
  const ctorSig = `new ${name}${constructor.signature}`;
  const ctorDesc = constructor.description
    ? ` description="${escapeJsxAttr(markdownToHtml(resolveLinks(constructor.description, allTypes, info.namespace)))}"`
    : '';
  lines.push(`<ConstructorBlock signature="${escapeJsxAttr(ctorSig)}"${ctorDesc} />`);
  lines.push('');
}

export function renderEnumPage(lines: string[], info: TypeInfo, allTypes: Map<string, TypeInfo>): void {
  lines.push(`<TypeSignature kind="enum" name="${info.name}" />`);
  lines.push('');

  if (info.enumMembers.length === 0) {
    return;
  }

  lines.push('**Members:**');
  lines.push('');
  lines.push('| Member | Value | Description |');
  lines.push('| :-- | :-- | :-- |');
  for (const member of info.enumMembers) {
    const value = member.value ? `\`${escapeMarkdown(member.value)}\`` : '';
    lines.push(`| \`${member.name}\` | ${value} | ${escapeMarkdown(resolveLinks(member.description, allTypes, info.namespace))} |`);
  }
  lines.push('');
}

/**
 * The raw code signature shown on a type-overview page's OG card, for the kinds that render a single
 * signature line (function / type alias / variable). Classes, interfaces and enums render member
 * tables instead, so they get no signature block.
 */
export function computeOverviewSignature(name: string, info: TypeInfo): string | undefined {
  if (info.kind === 'function') {
    const fn = info.methods[0];
    return fn ? `function ${fn.signature}: ${fn.returnType}` : undefined;
  }
  if (info.kind === 'type') {
    return `type ${getDisplayName(info.name, info)} = ${info.typeAliasText ?? 'unknown'}`;
  }
  if (info.kind === 'variable') {
    return `${info.variableKeyword ?? 'let'} ${name}: ${info.variableType ?? 'unknown'}`;
  }
  return undefined;
}

export function renderFunctionPage(lines: string[], info: TypeInfo, allTypes: Map<string, TypeInfo>): void {
  const fn = info.methods[0];
  if (!fn) {
    return;
  }

  lines.push('**Signature:**');
  lines.push('');
  lines.push('```ts');
  lines.push(`function ${fn.signature}: ${fn.returnType}`);
  lines.push('```');
  lines.push('');

  if (fn.parameters.length > 0) {
    lines.push('**Parameters:**');
    lines.push('');
    lines.push('| Parameter | Type | Description |');
    lines.push('| :-- | :-- | :-- |');
    for (const param of fn.parameters) {
      lines.push(
        `| \`${param.name}\` | ${escapeMarkdown(escapeMdxAngleBrackets(renderTypeWithLinks(param.type, allTypes, info.name, info.namespace)))} | ${escapeMarkdown(resolveLinks(param.description, allTypes, info.namespace))} |`
      );
    }
    lines.push('');
  }

  const returnDesc = fn.returnDescription ? ` — ${escapeMdxAngleBrackets(resolveLinks(fn.returnDescription, allTypes, info.namespace))}` : '';
  lines.push(`**Returns:** ${escapeMdxAngleBrackets(renderTypeWithLinks(fn.returnType, allTypes, info.name, info.namespace))}${returnDesc}`);
  lines.push('');

  for (const example of fn.examples) {
    lines.push('**Example:**');
    lines.push('');
    lines.push(renderExampleMdx(example, allTypes, info.namespace));
    lines.push('');
  }
}

export function renderMethodOverloadMdx(lines: string[], overload: MemberInfo, typeName: string, namespace: string, allTypes: Map<string, TypeInfo>): void {
  const sig = `${overload.signature}: ${overload.returnType}`;
  const staticAttr = overload.isStatic ? ' isStatic={true}' : '';
  const descAttr = overload.description ? ` description="${escapeJsxAttr(markdownToHtml(resolveLinks(overload.description, allTypes, namespace)))}"` : '';
  const remarksAttr = overload.remarks ? ` remarks="${escapeJsxAttr(markdownToHtml(resolveLinks(overload.remarks, allTypes, namespace)))}"` : '';
  const sinceAttr = overload.since ? ` since="${escapeJsxAttr(overload.since)}"` : '';
  const returnTypeAttr = ` returnType="${escapeJsxAttr(markdownToHtml(renderTypeWithLinks(overload.returnType, allTypes, typeName, namespace)))}"`;
  const returnDescAttr = overload.returnDescription
    ? ` returnDescription="${escapeJsxAttr(markdownToHtml(resolveLinks(overload.returnDescription, allTypes, namespace)))}"`
    : '';
  const examplesAttr = overload.examples.length > 0 ? ` examples={${JSON.stringify(overload.examples)}}` : '';

  const params = overload.parameters.map((p) => ({
    description: markdownToHtml(p.description || (p.name.endsWith('?') ? '*(Optional)*' : '')),
    name: p.name,
    type: markdownToHtml(renderTypeWithLinks(p.type, allTypes, typeName, namespace))
  }));
  const paramsAttr = params.length > 0 ? ` parameters={${JSON.stringify(params)}}` : '';

  lines.push(
    `<MemberDetail${staticAttr} signature="${escapeJsxAttr(sig)}"${descAttr}${remarksAttr}${sinceAttr}${returnTypeAttr}${returnDescAttr}${paramsAttr}${examplesAttr} />`
  );
  lines.push('');
}

export function renderMethodTableMdx(lines: string[], info: TypeInfo, allTypes: Map<string, TypeInfo>): void {
  const methods = [...info.methods].sort((a, b) => {
    if (a.isStatic !== b.isStatic) {
      return a.isStatic ? 1 : -1;
    }
    return a.name.localeCompare(b.name);
  });
  if (methods.length === 0) {
    return;
  }
  lines.push('<MethodTable rows={[');
  for (const method of methods) {
    const desc = escapeJsString(markdownToHtml(resolveLinks(method.description, allTypes, info.namespace)));
    const staticPrefix = method.isStatic ? 'static ' : '';
    const shortParams = method.parameters.map((p, i) => {
      if (i === 0 && EVENT_METHODS.has(method.name) && (p.type.startsWith('"') || p.type.startsWith('\''))) {
        return p.type.replace(/"/g, '\'');
      }
      return p.name;
    }).join(', ');
    const shortSig = `${staticPrefix}${method.name}(${shortParams})`;
    const sig = escapeJsString(shortSig);
    const slug = overloadRouteSegment(method.overloadKey);
    const returnType = markdownToHtml(renderTypeWithLinks(method.returnType, allTypes, info.name, info.namespace));
    const inheritedAttr = method.inheritedFrom
      ? `, inheritedFrom: "${escapeJsString(markdownToHtml(typeLink(method.inheritedFrom, allTypes, info.namespace)))}"`
      : '';
    const href = memberHref(slug, method.inheritedFrom, allTypes, info.namespace);
    lines.push(
      `  { signature: "${sig}", href: "${escapeJsString(href)}", returns: "${escapeJsString(returnType)}", description: "${desc}"${inheritedAttr} },`
    );
  }
  lines.push(']} />');
  lines.push('');
}

export function renderPropertyTableMdx(lines: string[], info: TypeInfo, allTypes: Map<string, TypeInfo>): void {
  const props = info.properties;
  if (props.length === 0) {
    return;
  }
  lines.push('<PropertyTable rows={[');
  for (const prop of props) {
    const desc = escapeJsString(markdownToHtml(resolveLinks(prop.description, allTypes, info.namespace)));
    const type = markdownToHtml(renderTypeWithLinks(prop.type, allTypes, info.name, info.namespace));
    const inheritedAttr = prop.inheritedFrom
      ? `, inheritedFrom: "${escapeJsString(markdownToHtml(typeLink(prop.inheritedFrom, allTypes, info.namespace)))}"`
      : '';
    const href = memberHref(memberRouteSegment(prop.name), prop.inheritedFrom, allTypes, info.namespace);
    lines.push(
      `  { name: "${escapeJsString(prop.name)}", href: "${escapeJsString(href)}", type: "${escapeJsString(type)}", description: "${desc}"${inheritedAttr} },`
    );
  }
  lines.push(']} />');
  lines.push('');
}

export function renderTypeAliasPage(lines: string[], info: TypeInfo, allTypes: Map<string, TypeInfo>): void {
  const typeParamsAttr = info.typeParameters.length > 0 ? ` typeParams={${JSON.stringify(info.typeParameters)}}` : '';
  lines.push(`<TypeSignature kind="type" name="${info.name}"${typeParamsAttr} />`);
  lines.push('');

  const rhs = info.typeAliasText ?? 'unknown';
  lines.push('**Signature:**');
  lines.push('');
  lines.push('```ts');
  lines.push(`type ${getDisplayName(info.name, info)} = ${rhs}`);
  lines.push('```');
  lines.push('');
  lines.push(`**Type:** ${escapeMdxBraces(escapeMdxAngleBrackets(renderTypeWithLinks(rhs, allTypes, info.name, info.namespace)))}`);
  lines.push('');
}

export function renderVariablePage(lines: string[], name: string, info: TypeInfo, allTypes: Map<string, TypeInfo>): void {
  const keyword = info.variableKeyword ?? 'let';
  const varType = info.variableType ?? 'unknown';
  lines.push('**Signature:**');
  lines.push('');
  lines.push('```ts');
  lines.push(`${keyword} ${name}: ${varType}`);
  lines.push('```');
  lines.push('');
  lines.push(`**Type:** ${escapeMdxBraces(escapeMdxAngleBrackets(renderTypeWithLinks(varType, allTypes, name, info.namespace)))}`);
  lines.push('');
}

export function sidebarTreeToEntries(node: SidebarTreeNode, label: string): SidebarEntry {
  const items: (SidebarEntry | SidebarLink)[] = [];

  // Child directory groups first (before this module's own pages)
  const sortedChildren = [...node.children.keys()].sort((a, b) => a.localeCompare(b));
  for (const childName of sortedChildren) {
    const child = node.children.get(childName);
    if (child) {
      items.push(sidebarTreeToEntries(child, childName));
    }
  }

  // This module's own overview page + type/function pages (individual members are not listed).
  // Sidebar `link` fields must NOT embed BASE_PATH: Starlight prepends the config `base` to every
  // sidebar link itself, so including it here would double the base (e.g. `/base/base/api/...` → 404).
  // This differs from in-content links, which are raw anchors that Starlight does not base-prepend.
  if (node.types.length > 0) {
    const namespace = node.types[0]?.namespace ?? '';
    items.push({ label: 'Overview', link: `/api/${namespace}/` });
    const sortedTypes = [...node.types].sort((a, b) => a.name.localeCompare(b.name));
    for (const t of sortedTypes) {
      items.push({ label: t.name, link: `/api/${t.namespace}/${toTypeRouteSegment(t.namespace, t.name)}/` });
    }
  }

  return { collapsed: true, items, label };
}

function renderNamespaceTable(
  lines: string[],
  heading: string,
  columnLabel: string,
  entries: TypeInfo[],
  allTypes: Map<string, TypeInfo>,
  namespace: string
): void {
  if (entries.length === 0) {
    return;
  }
  const sorted = [...entries].sort((a, b) => a.name.localeCompare(b.name));
  lines.push(`## ${heading}`);
  lines.push('');
  lines.push(`| ${columnLabel} | Description |`);
  lines.push('| :-- | :-- |');
  for (const entry of sorted) {
    lines.push(`| [${entry.name}](./${toTypeRouteSegment(entry.namespace, entry.name)}/) | ${escapeMarkdown(resolveLinks(entry.description, allTypes, namespace))} |`);
  }
  lines.push('');
}
