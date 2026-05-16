/**
 * @file
 *
 * ESLint rule: params-options-name-match
 *
 * Ensures that parameter-bag type names match the function or constructor they
 * belong to:
 *
 * - `fooBar(params: FooBarParams)` — PascalCase of function name + `Params`
 * - `class Baz { constructor(params: BazConstructorParams) }` — ClassName + `ConstructorParams`
 * - `class Baz { method(params: BazMethodParams) }` — ClassName + PascalCase(methodName) + `Params`
 *
 * Only checks parameters whose type annotation name ends with `Params` or
 * `Options`. Only checks exported functions and public/protected class members
 * to avoid false positives from internal options-passthrough helpers.
 */

/* eslint-disable @typescript-eslint/no-unnecessary-condition -- Rule.Node parent/property types are wider than what the type checker infers; defensive checks are appropriate for AST traversal. */

import type { Rule } from 'eslint';

const PARAMS_OPTIONS_SUFFIX_PATTERN = /^(?<prefix>.+?)(?<suffix>Params|Options)$/;

export const MESSAGE_ID = 'paramsOptionsNameMatch';

interface FunctionNodeWithParams {
  readonly params: Rule.Node[];
}

interface TypeAnnotationInfo {
  readonly name: string;
  readonly node: Rule.Node;
}

export const paramsOptionsNameMatch: Rule.RuleModule = {
  create(context) {
    return {
      ':function[params.length>0]'(node: Rule.Node): void {
        if (!isPublicOrExported(node)) {
          return;
        }

        const fnNode = node as FunctionNodeWithParams & Rule.Node;
        const expectedPrefix = getExpectedPrefix(node);
        if (!expectedPrefix) {
          return;
        }

        for (const param of fnNode.params) {
          const typeInfo = getTypeAnnotationInfo(param);
          if (!typeInfo) {
            continue;
          }

          const match = PARAMS_OPTIONS_SUFFIX_PATTERN.exec(typeInfo.name);
          if (!match?.groups) {
            continue;
          }

          const actualPrefix = match.groups['prefix'] ?? '';
          const suffix = match.groups['suffix'] ?? '';

          if (actualPrefix !== expectedPrefix) {
            context.report({
              data: {
                actualName: typeInfo.name,
                expectedName: `${expectedPrefix}${suffix}`
              },
              messageId: MESSAGE_ID,
              node: typeInfo.node
            });
          }
        }
      }
    };

    function isPublicOrExported(node: Rule.Node): boolean {
      // Class method or constructor: check accessibility AND that the class is exported
      const methodDef = node.parent;
      if (methodDef?.type === 'MethodDefinition') {
        const accessibility = 'accessibility' in methodDef ? methodDef.accessibility : undefined;
        if (accessibility === 'private') {
          return false;
        }
        // Check if the class itself is exported
        const classBody = methodDef.parent;
        const classNode = classBody?.parent;
        if (!classNode) {
          return false;
        }
        const classParent = classNode.parent;
        return classParent?.type === 'ExportNamedDeclaration' || classParent?.type === 'ExportDefaultDeclaration';
      }

      // Top-level function: check if exported
      if (node.type === 'FunctionDeclaration') {
        const parentNode = node.parent;
        return parentNode?.type === 'ExportNamedDeclaration' || parentNode?.type === 'ExportDefaultDeclaration';
      }

      // Arrow function in variable: check if the variable declaration is exported
      if (node.parent?.type === 'VariableDeclarator') {
        const varDecl = node.parent.parent;
        if (varDecl?.parent?.type === 'ExportNamedDeclaration') {
          return true;
        }
      }

      return false;
    }

    function getExpectedPrefix(node: Rule.Node): string | undefined {
      const methodPrefix = getMethodExpectedPrefix(node);
      if (methodPrefix !== undefined) {
        return methodPrefix;
      }

      return getFunctionExpectedPrefix(node);
    }

    function getMethodExpectedPrefix(node: Rule.Node): string | undefined {
      const methodDef = node.parent;
      if (methodDef?.type !== 'MethodDefinition') {
        return undefined;
      }

      if (
        !('key' in methodDef) || !methodDef.key || typeof methodDef.key !== 'object' || !('name' in methodDef.key) || typeof methodDef.key.name !== 'string'
      ) {
        return undefined;
      }

      const methodName = methodDef.key.name;
      const className = getClassName(methodDef);
      if (!className) {
        return undefined;
      }

      if (methodName === 'constructor') {
        return `${className}Constructor`;
      }

      return className + toPascalCase(methodName);
    }

    function getClassName(methodDef: Rule.Node): string | undefined {
      const classBody = methodDef.parent;
      const classNode = classBody?.parent;
      if (
        !classNode || !('id' in classNode) || !classNode.id || typeof classNode.id !== 'object' || !('name' in classNode.id)
        || typeof classNode.id.name !== 'string'
      ) {
        return undefined;
      }
      return classNode.id.name;
    }

    function getFunctionExpectedPrefix(node: Rule.Node): string | undefined {
      // Named function declaration: function fooBar(params: FooBarParams)
      if ('id' in node && node.id && typeof node.id === 'object' && 'name' in node.id && typeof node.id.name === 'string') {
        return toPascalCase(node.id.name);
      }

      // Arrow function assigned to a variable: const fooBar = (params: FooBarParams) => ...
      if (
        node.parent?.type === 'VariableDeclarator' && 'id' in node.parent && node.parent.id && typeof node.parent.id === 'object' && 'name' in node.parent.id
        && typeof node.parent.id.name === 'string'
      ) {
        return toPascalCase(node.parent.id.name);
      }

      return undefined;
    }

    function getTypeAnnotationInfo(param: Rule.Node): TypeAnnotationInfo | undefined {
      if (!('typeAnnotation' in param) || !param.typeAnnotation) {
        return undefined;
      }

      const annotation = param.typeAnnotation as Record<string, unknown>;
      const typeNode = annotation['typeAnnotation'];
      /* v8 ignore start -- Defensive guard: the TypeScript parser always produces an AST node for typeAnnotation. */
      if (!typeNode || typeof typeNode !== 'object') {
        return undefined;
      }
      /* v8 ignore stop */

      const typeNodeObj = typeNode as Record<string, unknown>;

      // Direct reference: FooBarParams
      if (typeNodeObj['type'] === 'TSTypeReference' && typeNodeObj['typeName'] && typeof typeNodeObj['typeName'] === 'object') {
        const typeName = typeNodeObj['typeName'] as Record<string, unknown>;
        if (typeName['type'] === 'Identifier' && typeof typeName['name'] === 'string') {
          return { name: typeName['name'], node: typeNode as Rule.Node };
        }
      }

      return undefined;
    }

    function toPascalCase(name: string): string {
      return name.charAt(0).toUpperCase() + name.slice(1);
    }
  },
  meta: {
    docs: {
      description: 'Require `*Params`/`*Options` type names to match the function or constructor they belong to'
    },
    messages: {
      [MESSAGE_ID]: 'Type "{{ actualName }}" does not match the expected name "{{ expectedName }}" for this function/constructor.'
    },
    schema: [],
    type: 'suggestion'
  }
};

/* eslint-enable @typescript-eslint/no-unnecessary-condition -- Re-enable after AST traversal code. */
