/**
 * @file
 *
 * ESLint rule: params-options-name-match
 *
 * Ensures that parameter-bag type names match the function or constructor they
 * belong to, on two axes — a prefix derived from the owner and a suffix derived
 * from how the bag is passed.
 *
 * Prefix (owner):
 * - `fooBar(params: FooBar…)` — PascalCase of the function name
 * - `class Baz { constructor(params: BazConstructor…) }` — ClassName + `Constructor`
 * - `class Baz { method(params: BazMethod…) }` — ClassName + PascalCase(methodName)
 *
 * Suffix (whether the bag is a required sole argument):
 * - `Params` only when the bag is the SOLE and REQUIRED parameter —
 *   `fooBar(params: FooBarParams)`
 * - `Options` otherwise. That is: an OPTIONAL bag — `fooBar(options?: FooBarOptions)`
 *   or `fooBar(options: FooBarOptions = {})` — or a bag SUPPLEMENTARY to other
 *   parameters — `fooBar(baz: string, options: FooBarOptions)`.
 *
 * Only checks parameters whose type annotation name ends with `Params` or
 * `Options`. Only checks exported functions and members of exported classes
 * (regardless of accessibility — `public`, `protected`, and `private` are all
 * checked) to avoid false positives from internal options-passthrough helpers.
 */

/* eslint-disable @typescript-eslint/no-unnecessary-condition -- Rule.Node parent/property types are wider than what the type checker infers; defensive checks are appropriate for AST traversal. */

import type { Rule } from 'eslint';

const PARAMS_OPTIONS_SUFFIX_PATTERN = /(?:Params|Options)$/;
const PARAMS_SUFFIX = 'Params';
const OPTIONS_SUFFIX = 'Options';

/** Message ID reported when a parameter-bag type's name does not match the expected name (prefix and required/optional suffix) for its function or constructor. */
export const MESSAGE_ID = 'paramsOptionsNameMatch';

interface FunctionNodeWithParams {
  readonly params: Rule.Node[];
}

interface MaybeOptionalNode {
  readonly optional?: boolean;
}

interface TypeAnnotationInfo {
  readonly name: string;
  readonly node: Rule.Node;
}

export const paramsOptionsNameMatch: Rule.RuleModule = {
  create(context) {
    return {
      ':function[params.length>0]'(node: Rule.Node): void {
        if (!isInExportedScope(node)) {
          return;
        }

        const fnNode = node as FunctionNodeWithParams & Rule.Node;
        const expectedPrefix = getExpectedPrefix(node);
        if (!expectedPrefix) {
          return;
        }

        const isSoleParam = fnNode.params.length === 1;

        for (const param of fnNode.params) {
          const typeInfo = getTypeAnnotationInfo(param);
          if (!typeInfo) {
            continue;
          }

          if (!PARAMS_OPTIONS_SUFFIX_PATTERN.test(typeInfo.name)) {
            continue;
          }

          // A required sole-argument bag → `*Params`. An optional bag (`?` or a default
          // Value) or a bag supplementary to other parameters → `*Options`.
          const expectedSuffix = isSoleParam && !isOptionalParam(param) ? PARAMS_SUFFIX : OPTIONS_SUFFIX;
          const expectedName = `${expectedPrefix}${expectedSuffix}`;

          if (typeInfo.name !== expectedName) {
            context.report({
              data: {
                actualName: typeInfo.name,
                expectedName
              },
              messageId: MESSAGE_ID,
              node: typeInfo.node
            });
          }
        }
      }
    };

    function isInExportedScope(node: Rule.Node): boolean {
      // Class method or constructor: check that the class is exported, regardless of accessibility
      // (public/protected/private members are all checked).
      const methodDef = node.parent;
      if (methodDef?.type === 'MethodDefinition') {
        // Check if the class itself is exported
        const classBody = methodDef.parent;
        const classNode = classBody?.parent;
        /* v8 ignore start -- Defensive guard: ESLint AST always has parent chain for class methods. */
        if (!classNode) {
          return false;
        }
        /* v8 ignore stop */
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

      /* v8 ignore start -- Defensive guard: ESLint AST MethodDefinition always has a named key. */
      if (
        !('key' in methodDef) || !methodDef.key || typeof methodDef.key !== 'object' || !('name' in methodDef.key) || typeof methodDef.key.name !== 'string'
      ) {
        return undefined;
      }
      /* v8 ignore stop */

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

    function isOptionalParam(param: Rule.Node): boolean {
      // `options: FooOptions = {}` is an AssignmentPattern; `options?: FooOptions` carries an
      // `optional` flag. Both make the bag optional → `*Options`.
      if (param.type === 'AssignmentPattern') {
        return true;
      }
      return (param as MaybeOptionalNode).optional === true;
    }

    function getTypeAnnotationInfo(param: Rule.Node): TypeAnnotationInfo | undefined {
      // Unwrap a defaulted parameter such as `options: FooOptions = {}`.
      // Its type annotation lives on the AssignmentPattern's left-hand binding.
      const target = param.type === 'AssignmentPattern' ? param.left : param;

      /* v8 ignore start -- Defensive guard: TypeScript-parsed params always have typeAnnotation when typed. */
      if (!('typeAnnotation' in target) || !target.typeAnnotation) {
        return undefined;
      }
      /* v8 ignore stop */

      const annotation = target.typeAnnotation as Record<string, unknown>;
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
        /* v8 ignore start -- Defensive guard: TSTypeReference typeName is always an Identifier with a string name. */
        if (typeName['type'] === 'Identifier' && typeof typeName['name'] === 'string') {
          /* v8 ignore stop */
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
      description: 'Require `*Params`/`*Options` type names to match the owning function/constructor (prefix) and the sole-vs-supplementary argument convention (suffix)'
    },
    messages: {
      [MESSAGE_ID]: 'Type "{{ actualName }}" does not match the expected name "{{ expectedName }}" for this function/constructor.'
    },
    schema: [],
    type: 'suggestion'
  }
};

/* eslint-enable @typescript-eslint/no-unnecessary-condition -- Re-enable after AST traversal code. */
