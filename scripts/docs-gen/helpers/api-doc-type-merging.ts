/**
 * @file
 *
 * Inheritance resolution: copies inherited members onto subtypes, substituting generic type args.
 *
 * (obsidian-dev-utils is a normal library, not an augmentation of `obsidian.d.ts`, so there is no
 * official-vs-unofficial merge machinery here — only the generic inheritance helpers.)
 */

import type {
  MemberInfo,
  TypeInfo
} from './api-doc-types.ts';

import { findType } from './api-doc-link-rendering.ts';

/**
 * Build a mapping from parent type parameter names to concrete type arguments.
 * E.g., parent has `typeParameters: ['Instance extends BaseInstance']` and
 * child extends `Parent<CanvasPluginInstance>` → `{Instance: 'CanvasPluginInstance'}`
 */
export function buildTypeParameterMap(baseInfo: TypeInfo, typeArguments: string[]): Map<string, string> {
  const mapping = new Map<string, string>();
  const count = Math.min(baseInfo.typeParameters.length, typeArguments.length);
  for (let index = 0; index < count; index++) {
    const parameter = baseInfo.typeParameters[index];
    const argument = typeArguments[index];
    if (parameter && argument) {
      const bareParameter = parameter.replace(/\s+extends\s+.*$/, '');
      mapping.set(bareParameter, argument);
    }
  }
  return mapping;
}

/**
 * Parse generic type arguments from a base type expression.
 * E.g., `InternalPlugin<CanvasPluginInstance>` → `['CanvasPluginInstance']`
 * Handles nested angle brackets: `Foo<Bar<Baz>, Qux>` → `['Bar<Baz>', 'Qux']`
 */
export function parseTypeArguments(baseTypeName: string): string[] {
  const openIndex = baseTypeName.indexOf('<');
  if (openIndex === -1) {
    return [];
  }
  const inner = baseTypeName.slice(openIndex + 1, -1);
  const $arguments: string[] = [];
  let depth = 0;
  let current = '';
  for (const ch of inner) {
    if (ch === '<') {
      depth++;
      current += ch;
    } else if (ch === '>') {
      depth--;
      current += ch;
    } else if (ch === ',' && depth === 0) {
      $arguments.push(current.trim());
      current = '';
    } else {
      current += ch;
    }
  }
  if (current.trim()) {
    $arguments.push(current.trim());
  }
  return $arguments;
}

export function resolveInheritedMembers(types: Map<string, TypeInfo>): void {
  for (const [, info] of types) {
    for (const baseTypeName of [...info.baseTypes, ...info.implementsTypes]) {
      const cleanBase = baseTypeName.replace(/<.*>$/, '').trim();
      const baseInfo = findType(types, cleanBase, info.namespace);
      if (!baseInfo) {
        continue;
      }

      const typeArguments = parseTypeArguments(baseTypeName);
      const typeParameterMap = buildTypeParameterMap(baseInfo, typeArguments);

      for (const property of baseInfo.properties) {
        if (info.properties.every((p) => p.name !== property.name)) {
          info.properties.push(substituteMemberTypes({ ...property, inheritedFrom: baseInfo.name }, typeParameterMap));
        }
      }

      for (const method of baseInfo.methods) {
        const hasOwnMethod = info.methods.some((m) => m.name === method.name && m.signature === method.signature);
        const hasInheritedMethod = info.methods.some((m) => m.inheritedFrom === baseInfo.name && m.overloadKey === method.overloadKey);
        if (!hasOwnMethod && !hasInheritedMethod) {
          info.methods.push(substituteMemberTypes({ ...method, inheritedFrom: baseInfo.name }, typeParameterMap));
        }
      }
    }
  }
}

/** Apply type parameter substitution to all type-bearing fields of a member */
export function substituteMemberTypes(member: MemberInfo, mapping: Map<string, string>): MemberInfo {
  if (mapping.size === 0) {
    return member;
  }
  return {
    ...member,
    parameters: member.parameters.map((p) => ({
      ...p,
      type: substituteTypeParams(p.type, mapping)
    })),
    returnType: substituteTypeParams(member.returnType, mapping),
    signature: substituteTypeParams(member.signature, mapping),
    type: substituteTypeParams(member.type, mapping)
  };
}

/** Substitute generic type parameters in a type string using a mapping */
export function substituteTypeParams(typeText: string, mapping: Map<string, string>): string {
  if (mapping.size === 0) {
    return typeText;
  }
  return typeText.replaceAll(/\b(?<typeName>[a-zA-Z][a-zA-Z0-9]*)\b/g, (match) => {
    return mapping.get(match) ?? match;
  });
}
