import {
  describe,
  expect,
  it
} from 'vitest';

import type {
  MemberInfo,
  TypeInfo
} from './api-doc-types.ts';

import {
  computeOverloadKey,
  escapeMdxProse,
  foldTsDocParagraphs,
  getDisplayName,
  getImportStatement,
  memberRouteSegment,
  memberSlug,
  overloadRouteSegment,
  overloadSlug,
  segmentMarkdown,
  simplifyType,
  stripMarkdown,
  toRouteSegment,
  toRouteSegmentPreserveCase,
  truncateSignature
} from './api-doc-text-utils.ts';

describe('api-doc text utilities', () => {
  it('keys event-method overloads by literal event name', () => {
    expect(computeOverloadKey(createMemberInfo({ name: 'on', parameters: [{ description: '', name: 'event', type: '"changed"' }] }))).toBe('on(\'changed\')');
    expect(computeOverloadKey(createMemberInfo({ name: 'on', parameters: [{ description: '', name: 'event', type: 'string' }] }))).toBe('on');
  });

  it('escapes only MDX-unsafe prose characters', () => {
    expect(escapeMdxProse('A < B {value}; `C<D` and [link](<url>)')).toBe('A \\< B \\{value\\}; `C<D` and [link](<url>)');
  });

  it('preserves fenced code while folding prose paragraphs', () => {
    expect(foldTsDocParagraphs('first\nline\n\n```ts\nconst alpha = 1;\n```\n\nlast\nline')).toBe('first line\n\n```ts\nconst alpha = 1;\n```\n\nlast line');
    expect(segmentMarkdown('prose\n~~~js\nconst alpha = 1;\n~~~\nend')).toEqual([
      { text: 'prose', type: 'prose' },
      { lang: 'js', text: 'const alpha = 1;', type: 'code' },
      { text: 'end', type: 'prose' }
    ]);
  });

  it('generates stable case-preserved routes and lowercase filenames', () => {
    expect(memberRouteSegment('showNotice')).toBe('showNotice');
    expect(memberSlug('showNotice')).toBe('shownotice');
    expect(memberRouteSegment('index')).toBe('index-member');
    expect(overloadRouteSegment('on("changed")')).toBe('on-changed');
    expect(overloadSlug('on("changed")')).toBe('on-changed');
    expect(toRouteSegment('AbortSignalAny')).toBe('abortsignalany');
    expect(toRouteSegmentPreserveCase('Abort SignalAny!')).toBe('Abort-SignalAny');
  });

  it('renders API display and import metadata', () => {
    const typeInfo = createTypeInfo({ kind: 'interface', name: 'Alpha', namespace: 'obsidian/alpha', typeParameters: ['T extends Base', 'U'] });
    expect(getDisplayName('Alpha', typeInfo)).toBe('Alpha<T, U>');
    expect(getImportStatement(typeInfo)).toBe('import type { Alpha } from \'obsidian-dev-utils/obsidian/alpha\';');
    expect(getImportStatement(createTypeInfo({ kind: 'function', name: 'bravo', namespace: 'bravo' }))).toBe('import { bravo } from \'obsidian-dev-utils/bravo\';');
  });

  it('normalizes type and description text for generated pages', () => {
    expect(simplifyType('import("obsidian").App | import(\'node:fs\').Stats')).toBe('App | Stats');
    const REPEATED_WORD_COUNT = 40;
    const MAX_SIGNATURE_LENGTH = 160;
    expect(truncateSignature(`  ${'alpha '.repeat(REPEATED_WORD_COUNT)}  `)).toHaveLength(MAX_SIGNATURE_LENGTH);
    expect(stripMarkdown('**Alpha** {@link Bravo | Bravo label} [Charlie](https://example.com)')).toBe('Alpha Bravo label Charlie');
  });
});

function createMemberInfo(overrides: Partial<MemberInfo> = {}): MemberInfo {
  return {
    description: '',
    examples: [],
    inheritedFrom: '',
    isStatic: false,
    name: 'alpha',
    overloadKey: 'alpha',
    parameters: [],
    remarks: '',
    returnDescription: '',
    returnType: '',
    signature: 'alpha()',
    since: '',
    type: '',
    ...overrides
  };
}

function createTypeInfo(overrides: Partial<TypeInfo> = {}): TypeInfo {
  return {
    baseTypes: [],
    description: '',
    enumMembers: [],
    examples: [],
    implementsTypes: [],
    kind: 'class',
    methods: [],
    name: 'alpha',
    namespace: 'alpha',
    properties: [],
    remarks: '',
    typeParameters: [],
    ...overrides
  };
}
