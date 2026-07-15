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
  buildTypeParamMap,
  parseTypeArguments,
  resolveInheritedMembers,
  substituteMemberTypes,
  substituteTypeParams
} from './api-doc-type-merging.ts';

describe('api-doc type merging', () => {
  it('parses nested generic arguments and maps parent parameters', () => {
    expect(parseTypeArguments('Alpha<Bravo<Charlie>, Delta>')).toEqual(['Bravo<Charlie>', 'Delta']);
    expect(buildTypeParamMap(createTypeInfo({ typeParameters: ['T extends Base', 'U'] }), ['Bravo', 'Charlie'])).toEqual(new Map([['T', 'Bravo'], ['U', 'Charlie']]));
  });

  it('substitutes only whole type-parameter identifiers', () => {
    const mapping = new Map([['T', 'Bravo']]);
    expect(substituteTypeParams('T | TExtra | Array<T>', mapping)).toBe('Bravo | TExtra | Array<Bravo>');
    expect(substituteMemberTypes(createMemberInfo({ parameters: [{ description: '', name: 'value', type: 'T' }], returnType: 'T', signature: 'alpha(value: T)', type: 'T' }), mapping)).toMatchObject({
      parameters: [{ type: 'Bravo' }],
      returnType: 'Bravo',
      signature: 'alpha(value: Bravo)',
      type: 'Bravo'
    });
  });

  it('copies inherited members once and annotates their origin', () => {
    const base = createTypeInfo({ methods: [createMemberInfo({ name: 'alpha', returnType: 'T', signature: 'alpha(value: T)' })], name: 'Base', properties: [createMemberInfo({ name: 'value', type: 'T' })], typeParameters: ['T'] });
    const child = createTypeInfo({ baseTypes: ['Base<Bravo>'], name: 'Child' });
    const types = new Map([
      ['base', base],
      ['child', child]
    ]);

    resolveInheritedMembers(types);
    resolveInheritedMembers(types);

    expect(child.properties).toMatchObject([{ inheritedFrom: 'Base', name: 'value', type: 'Bravo' }]);
    expect(child.methods).toMatchObject([{ inheritedFrom: 'Base', name: 'alpha', returnType: 'Bravo', signature: 'alpha(value: Bravo)' }]);
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
