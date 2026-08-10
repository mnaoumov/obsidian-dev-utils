import {
  describe,
  expect,
  it
} from 'vitest';

import type {
  MemberInfo,
  PageContent,
  TypeInfo
} from './api-doc-types.ts';

import { registerRouteSegments } from './api-doc-link-rendering.ts';
import {
  buildBacklinksFromContent,
  buildSidebarTree,
  computeOverviewSignature,
  renderFrontMatter,
  sidebarTreeToEntries
} from './api-doc-page-generation.ts';

describe('api-doc page generation', () => {
  it('builds backlinks using case-preserved route segments', () => {
    const alpha = createTypeInfo({ name: 'Alpha', namespace: 'alpha' });
    const bravo = createTypeInfo({ name: 'abortSignalAny', namespace: 'abort-controller' });
    const types = createTypes([alpha, bravo]);
    registerRouteSegments(types);
    const pages = new Map<string, PageContent>([
      ['abort-controller#abortSignalAny', { content: '', filePath: 'bravo.mdx' }],
      ['alpha#Alpha', { content: '[bravo](/obsidian-dev-utils/api/abort-controller/abortSignalAny/)', filePath: 'alpha.mdx' }]
    ]);

    expect(buildBacklinksFromContent(pages, types)).toEqual(new Map([['abort-controller#abortSignalAny', ['alpha#Alpha']]]));
  });

  it('creates sorted nested sidebar entries without a duplicated base path', () => {
    const types = createTypes([
      createTypeInfo({ name: 'Bravo', namespace: 'obsidian/charlie' }),
      createTypeInfo({ name: 'Alpha', namespace: 'obsidian/charlie' })
    ]);
    registerRouteSegments(types);

    const entries = sidebarTreeToEntries(buildSidebarTree(types), 'root');

    expect(entries).toMatchObject({
      items: [{ items: [{ items: [{ label: 'Overview', link: '/api/obsidian/charlie/' }, { label: 'Alpha', link: '/api/obsidian/charlie/Alpha/' }, { label: 'Bravo', link: '/api/obsidian/charlie/Bravo/' }], label: 'charlie' }], label: 'obsidian' }],
      label: 'root'
    });
  });

  it('emits description frontmatter whenever a page has one, so its OG card is never title-only', () => {
    expect(renderFrontMatter({ description: 'Array utilities.', sidebarLabel: 'array', slug: 'api/array', title: 'array' })).toEqual([
      '---',
      'title: "array"',
      'slug: "api/array"',
      'description: "Array utilities."',
      'editUrl: false',
      'sidebar:',
      '  label: "array"',
      '---',
      ''
    ]);
  });

  it('strips markdown and escapes quotes in frontmatter values', () => {
    expect(renderFrontMatter({
      description: 'Wraps `alpha` and the "bravo" [link](https://example.com).',
      sidebarLabel: 'Alpha.charlie',
      signature: 'function  charlie(value:   string): void',
      slug: 'api/alpha/charlie',
      title: 'Alpha.charlie method'
    })).toEqual([
      '---',
      'title: "Alpha.charlie method"',
      'slug: "api/alpha/charlie"',
      String.raw`description: "Wraps alpha and the \"bravo\" link."`,
      'signature: "function charlie(value: string): void"',
      'editUrl: false',
      'sidebar:',
      '  label: "Alpha.charlie"',
      '---',
      ''
    ]);
  });

  it('omits description and signature when the page has neither', () => {
    expect(renderFrontMatter({ sidebarLabel: 'Alpha', slug: 'api/alpha/Alpha', title: 'Alpha' })).toEqual([
      '---',
      'title: "Alpha"',
      'slug: "api/alpha/Alpha"',
      'editUrl: false',
      'sidebar:',
      '  label: "Alpha"',
      '---',
      ''
    ]);
  });

  it('computes overview signatures only for single-signature kinds', () => {
    expect(computeOverviewSignature('alpha', createTypeInfo({ kind: 'function', methods: [createMemberInfo({ returnType: 'Bravo', signature: 'alpha(value: Bravo)' })] }))).toBe('function alpha(value: Bravo): Bravo');
    expect(computeOverviewSignature('Alpha', createTypeInfo({ kind: 'type', name: 'Alpha', typeAliasText: 'Bravo' }))).toBe('type Alpha = Bravo');
    expect(computeOverviewSignature('alpha', createTypeInfo({ kind: 'variable', variableKeyword: 'const', variableType: 'Bravo' }))).toBe('const alpha: Bravo');
    expect(computeOverviewSignature('Alpha', createTypeInfo())).toBeUndefined();
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
