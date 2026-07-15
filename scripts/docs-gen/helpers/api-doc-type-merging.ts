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
export function buildTypeParamMap(baseInfo: TypeInfo, typeArgs: string[]): Map<string, string> {
  const mapping = new Map<string, string>();
  const count = Math.min(baseInfo.typeParameters.length, typeArgs.length);
  for (let i = 0; i < count; i++) {
    const param = baseInfo.typeParameters[i];
    const arg = typeArgs[i];
    if (param && arg) {
      const bareParam = param.replace(/\s+extends\s+.*$/, '');
      mapping.set(bareParam, arg);
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
  const args: string[] = [];
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
      args.push(current.trim());
      current = '';
    } else {
      current += ch;
    }
  }
  if (current.trim()) {
    args.push(current.trim());
  }
  return args;
}

export function resolveInheritedMembers(types: Map<string, TypeInfo>): void {
  for (const [, info] of types) {
    for (const baseTypeName of [...info.baseTypes, ...info.implementsTypes]) {
      const cleanBase = baseTypeName.replace(/<.*>$/, '').trim();
      const baseInfo = findType(types, cleanBase, info.namespace);
      if (!baseInfo) {
        continue;
      }

      const typeArgs = parseTypeArguments(baseTypeName);
      const typeParamMap = buildTypeParamMap(baseInfo, typeArgs);

      for (const prop of baseInfo.properties) {
        if (!info.properties.some((p) => p.name === prop.name)) {
          info.properties.push(substituteMemberTypes({ ...prop, inheritedFrom: baseInfo.name }, typeParamMap));
        }
      }

      for (const method of baseInfo.methods) {
        const hasOwnMethod = info.methods.some((m) => m.name === method.name && m.signature === method.signature);
        const hasInheritedMethod = info.methods.some((m) => m.inheritedFrom === baseInfo.name && m.overloadKey === method.overloadKey);
        if (!hasOwnMethod && !hasInheritedMethod) {
          info.methods.push(substituteMemberTypes({ ...method, inheritedFrom: baseInfo.name }, typeParamMap));
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
  return typeText.replace(/\b(?<typeName>[a-zA-Z][a-zA-Z0-9]*)\b/g, (match) => {
    return mapping.get(match) ?? match;
  });
}
