import {
  afterEach,
  describe,
  expect,
  it,
  vi
} from 'vitest';

import type {
  MemberInfo,
  TypeInfo
} from './api-doc-types.ts';

import {
  findType,
  markdownToHtml,
  memberHref,
  registerMemberPages,
  registerRouteSegments,
  renderMdxProse,
  renderTypeWithLinks,
  resolveLinks,
  toTypeFileSegment,
  toTypeRouteSegment
} from './api-doc-link-rendering.ts';

describe('api-doc link rendering', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('disambiguates case-only route collisions so slugs never collide on a case-insensitive filesystem', () => {
    const types = createTypes([
      createTypeInfo({ name: 'AbortSignalAny' }),
      createTypeInfo({ name: 'abortSignalAny' })
    ]);

    registerRouteSegments(types);

    // The two names lowercase to the same slug, so exactly one keeps the pretty case-preserved route
    // While the other is suffixed. Otherwise `/AbortSignalAny/` and `/abortSignalAny/` would overwrite
    // Each other when Astro writes to a case-insensitive filesystem (Windows/macOS), 404-ing links.
    const routeSegments = new Set([toTypeRouteSegment('alpha', 'AbortSignalAny'), toTypeRouteSegment('alpha', 'abortSignalAny')]);
    expect(routeSegments).toEqual(new Set(['abortSignalAny', 'AbortSignalAny-2']));
    expect(new Set([...routeSegments].map((segment) => segment.toLowerCase()))).toEqual(new Set(['abortsignalany', 'abortsignalany-2']));
    expect(new Set([
      toTypeFileSegment('alpha', 'AbortSignalAny'),
      toTypeFileSegment('alpha', 'abortSignalAny')
    ])).toEqual(new Set(['abortsignalany', 'abortsignalany-2']));
  });

  it('resolves same-namespace types but leaves ambiguous names unlinked', () => {
    const local = createTypeInfo({ name: 'Alpha', namespace: 'local' });
    const remote = createTypeInfo({ name: 'Alpha', namespace: 'remote' });
    const types = createTypes([local, remote]);
    registerRouteSegments(types);

    expect(findType(types, 'Alpha', 'local')).toBe(local);
    expect(findType(types, 'Alpha')).toBeUndefined();
    expect(renderTypeWithLinks('Alpha | Promise<string>', types, undefined, 'local')).toContain('[Alpha](/obsidian-dev-utils/api/local/Alpha/)');
    expect(renderTypeWithLinks('Alpha', types)).toBe('Alpha');
  });

  it('links only generated member pages and renders safe MDX prose', () => {
    const typeInfo = createTypeInfo({ methods: [createMemberInfo({ name: 'showNotice', overloadKey: 'showNotice' })], name: 'PluginNoticeComponent', properties: [createMemberInfo({ name: 'enabled' })] });
    const types = createTypes([typeInfo]);
    registerRouteSegments(types);
    registerMemberPages(types);

    expect(memberHref('showNotice', '', types, 'alpha')).toBe('./showNotice/');
    expect(resolveLinks('{@link PluginNoticeComponent.showNotice}', types, 'alpha')).toBe('[PluginNoticeComponent.showNotice](/obsidian-dev-utils/api/alpha/PluginNoticeComponent/showNotice/)');
    expect(renderMdxProse('Use <Alpha> and {@link PluginNoticeComponent}.', types, 'alpha')).toBe('Use \\<Alpha> and [PluginNoticeComponent](/obsidian-dev-utils/api/alpha/PluginNoticeComponent/).');
  });

  it('converts inline Markdown without emitting unsafe relative links', () => {
    expect(markdownToHtml('[Guide](/guide) [image](image.png) `code`')).toBe('<a href="/guide">Guide</a> <code>[image](image.png)</code> <code>code</code>');
  });
});

function createMemberInfo(overrides: Partial<MemberInfo> = {}): MemberInfo {
  return {
    description: '', examples: [], inheritedFrom: '', isStatic: false, name: 'alpha', overloadKey: 'alpha', parameters: [], remarks: '', returnDescription: '', returnType: '', signature: 'alpha()', since: '', type: '', ...overrides
  };
}

function createTypeInfo(overrides: Partial<TypeInfo> = {}): TypeInfo {
  return {
    baseTypes: [], description: '', enumMembers: [], examples: [], implementsTypes: [], kind: 'class', methods: [], name: 'alpha', namespace: 'alpha', properties: [], remarks: '', typeParameters: [], ...overrides
  };
}

function createTypes(types: TypeInfo[]): Map<string, TypeInfo> {
  return new Map(types.map((typeInfo) => [`${typeInfo.namespace}#${typeInfo.name}`, typeInfo]));
}
